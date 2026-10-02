import { beforeEach, describe, expect, it, vi } from 'vitest'

const getCurrentUser = vi.fn()
const hasPermission = vi.fn()
const logAudit = vi.fn()
const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT ${url}`)
})
const create = vi.fn()
const findUnique = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect }))
vi.mock('@/lib/rbac', () => ({ getCurrentUser, hasPermission }))
vi.mock('@/lib/audit', () => ({ logAudit }))
vi.mock('@/lib/prisma', () => {
  const client = { invoice: { create }, customer: { findUnique } }
  return { prisma: client, default: client }
})

const { createInvoiceAction } = await import('@/app/admin/invoices/new/actions')

const form = (overrides: Record<string, string> = {}) => {
  const fd = new FormData()
  const values: Record<string, string> = {
    number: '',
    customerId: '',
    status: 'DRAFT',
    dueDate: '2026-10-15',
    notes: '',
    lines: JSON.stringify([{ description: 'Peach', quantity: '2', unitPrice: '5' }]),
    ...overrides,
  }
  for (const [key, value] of Object.entries(values)) fd.set(key, value)
  return fd
}

describe('createInvoiceAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCurrentUser.mockResolvedValue({ id: 'admin-1' })
    hasPermission.mockResolvedValue(true)
    create.mockResolvedValue({ id: 'inv-1', number: 'INV-20261015-1234' })
  })

  it('refuses users without financials:write', async () => {
    hasPermission.mockResolvedValue(false)
    const state = await createInvoiceAction({}, form())
    expect(hasPermission).toHaveBeenCalledWith({ id: 'admin-1' }, 'financials:write')
    expect(state.message).toMatch(/permission/)
    expect(create).not.toHaveBeenCalled()
  })

  it('returns field errors instead of writing', async () => {
    const state = await createInvoiceAction(
      {},
      form({ dueDate: '', lines: JSON.stringify([{ description: '', quantity: '1', unitPrice: '1' }]) }),
    )
    expect(state.errors).toMatchObject({ dueDate: expect.any(String), 'lines.0.description': 'Description is required' })
    expect(create).not.toHaveBeenCalled()
  })

  it('rejects an unknown customer', async () => {
    findUnique.mockResolvedValue(null)
    const state = await createInvoiceAction({}, form({ customerId: 'gone' }))
    expect(state.errors?.customerId).toBeDefined()
    expect(create).not.toHaveBeenCalled()
  })

  it('creates with a server-computed total, audits, and redirects to the invoice', async () => {
    await expect(createInvoiceAction({}, form())).rejects.toThrow('REDIRECT /admin/invoices/inv-1')
    expect(create.mock.calls[0][0].data.total.toString()).toBe('10')
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create', entityType: 'Invoice', entityId: 'inv-1' }),
    )
  })
})
