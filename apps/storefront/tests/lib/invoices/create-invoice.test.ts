import { beforeEach, describe, expect, it, vi } from 'vitest'

const create = vi.fn()
vi.mock('@/lib/prisma', () => {
  const client = { invoice: { create } }
  return { prisma: client, default: client }
})

const { createInvoice, createInvoiceFormSchema, generateInvoiceNumber, priceInvoiceLines } = await import(
  '@/lib/invoices/create-invoice'
)

const base = {
  number: null,
  customerId: null,
  status: 'DRAFT' as const,
  dueDate: new Date('2026-10-15T12:00:00.000Z'),
  notes: null,
  lines: [{ description: 'Peach', quantity: 3, unitPrice: 4.99 }],
}

describe('priceInvoiceLines', () => {
  it('stores a rounded amount per line and totals from the raw lines', () => {
    const { total, lines } = priceInvoiceLines([
      { description: 'Cases', quantity: 4, unitPrice: 42.5 },
      { description: 'Freight', quantity: 1, unitPrice: 18 },
    ])
    expect(total.toString()).toBe('188')
    expect(lines).toEqual([
      { description: 'Cases', quantity: 4, unitPrice: 42.5, amount: 170 },
      { description: 'Freight', quantity: 1, unitPrice: 18, amount: 18 },
    ])
  })
})

describe('generateInvoiceNumber', () => {
  it('is INV-<date>-<4 digits>', () => {
    expect(generateInvoiceNumber(new Date('2026-10-02T15:00:00Z'))).toMatch(/^INV-20261002-\d{4}$/)
  })
})

describe('createInvoice', () => {
  beforeEach(() => {
    create.mockReset()
    create.mockResolvedValue({ id: 'i1', number: 'INV-1' })
  })

  it('generates a number when none is given and stamps nothing for a draft', async () => {
    await createInvoice(base)
    const { data } = create.mock.calls[0][0]
    expect(data.number).toMatch(/^INV-\d{8}-\d{4}$/)
    expect(data.total.toString()).toBe('14.97')
    expect(data.sentAt).toBeNull()
    expect(data.paidAt).toBeNull()
  })

  it('keeps a typed number and stamps paidAt for a paid invoice', async () => {
    await createInvoice({ ...base, number: 'INV-42', status: 'PAID' })
    const { data } = create.mock.calls[0][0]
    expect(data.number).toBe('INV-42')
    expect(data.paidAt).toBeInstanceOf(Date)
    expect(data.sentAt).toBeNull()
  })
})

describe('createInvoiceFormSchema', () => {
  const valid = { status: 'DRAFT', dueDate: '2026-10-15', lines: [{ description: 'x', quantity: '2', unitPrice: '3' }] }

  it('pins the due date to midday UTC and blanks to null', () => {
    const parsed = createInvoiceFormSchema.parse({ ...valid, number: '  ', customerId: '' })
    expect(parsed.dueDate.toISOString()).toBe('2026-10-15T12:00:00.000Z')
    expect(parsed.number).toBeNull()
    expect(parsed.customerId).toBeNull()
    expect(parsed.lines[0]).toEqual({ description: 'x', quantity: 2, unitPrice: 3 })
  })

  it('rejects no lines, a zero quantity and a missing due date', () => {
    expect(createInvoiceFormSchema.safeParse({ ...valid, lines: [] }).success).toBe(false)
    const bad = createInvoiceFormSchema.safeParse({
      ...valid,
      dueDate: '',
      lines: [{ description: 'x', quantity: 0, unitPrice: 1 }],
    })
    expect(bad.success).toBe(false)
    const paths = bad.error?.issues.map((i) => i.path.join('.'))
    expect(paths).toEqual(expect.arrayContaining(['dueDate', 'lines.0.quantity']))
  })
})
