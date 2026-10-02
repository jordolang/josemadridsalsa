import { beforeEach, describe, expect, it, vi } from 'vitest'

const getCurrentUser = vi.fn()
const hasPermission = vi.fn()
const updateMany = vi.fn()
const logAudit = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/rbac', () => ({ getCurrentUser, hasPermission }))
vi.mock('@/lib/audit', () => ({ logAudit }))
vi.mock('@/lib/prisma', () => {
  const client = { wholesaleAccount: { updateMany } }
  return { prisma: client, default: client }
})

const { approveWholesaleAccount, rejectWholesaleAccount } = await import('@/app/admin/wholesale/actions')

const ID = 'clwholesale0000000000001'
const form = (id = ID) => {
  const fd = new FormData()
  fd.set('id', id)
  return fd
}

describe('wholesale approval actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCurrentUser.mockResolvedValue({ id: 'admin-1' })
    hasPermission.mockResolvedValue(true)
    updateMany.mockResolvedValue({ count: 1 })
  })

  it('approves only a pending application and records who approved it', async () => {
    await approveWholesaleAccount(form())
    const call = updateMany.mock.calls[0][0]
    expect(call.where).toEqual({ id: ID, status: 'PENDING' })
    expect(call.data).toMatchObject({ status: 'APPROVED', approvedBy: 'admin-1' })
    expect(call.data.approvedAt).toBeInstanceOf(Date)
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'approve', entityId: ID }))
  })

  it('rejects without stamping an approver', async () => {
    await rejectWholesaleAccount(form())
    expect(updateMany.mock.calls[0][0].data).toEqual({ status: 'REJECTED', approvedAt: null, approvedBy: null })
  })

  it('does not audit a no-op on an already-decided account', async () => {
    updateMany.mockResolvedValue({ count: 0 })
    await approveWholesaleAccount(form())
    expect(logAudit).not.toHaveBeenCalled()
  })

  it('refuses users without users:write', async () => {
    hasPermission.mockResolvedValue(false)
    await expect(approveWholesaleAccount(form())).rejects.toThrow('Not authorized')
    expect(updateMany).not.toHaveBeenCalled()
  })
})
