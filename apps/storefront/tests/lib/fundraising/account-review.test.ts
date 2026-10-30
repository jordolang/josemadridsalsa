import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The rules behind verifying a fundraiser account, shared by the web route and
 * the desktop queue. Prisma and the kit lookup are stubbed; what is pinned is
 * what each decision writes and when it refuses.
 */

const prismaMock = {
  $transaction: vi.fn(async (ops: unknown[]) => ops),
  fundraiserAccount: { findUnique: vi.fn(), update: vi.fn((args) => ({ op: 'account', ...args })) },
  fundraiser: { update: vi.fn((args) => ({ op: 'fundraiser', ...args })) },
  fundraiserProduct: { createMany: vi.fn((args) => ({ op: 'products', ...args })) },
}
vi.mock('@/lib/prisma', () => ({ __esModule: true, default: prismaMock, prisma: prismaMock }))

const resolveKitCatalog = vi.fn()
const shouldBlockApproval = vi.fn(() => false)
vi.mock('@/lib/fundraising/kit-catalog.server', () => ({ resolveKitCatalog, shouldBlockApproval }))

const { AccountReviewError, reviewFundraiserAccount } = await import('@/lib/fundraising/account-review')

const pending = {
  id: 'a1',
  status: 'PENDING',
  fundraiserId: 'f1',
  fundraiser: { id: 'f1', name: 'Eagles Band', flavorPackage: '16' },
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.fundraiserAccount.findUnique.mockResolvedValue(pending)
  resolveKitCatalog.mockResolvedValue({ kitSize: 16, catalog: [{ productId: 'p1' }], missingSlugs: [] })
  shouldBlockApproval.mockReturnValue(false)
})

describe('reviewFundraiserAccount', () => {
  it('approves the account, activates the campaign and stocks its kit in one transaction', async () => {
    await reviewFundraiserAccount('a1', 'approve', 'admin-1')

    expect(prismaMock.fundraiserAccount.update.mock.calls[0][0].data).toMatchObject({
      status: 'APPROVED',
      approvedBy: 'admin-1',
    })
    expect(prismaMock.fundraiser.update).toHaveBeenCalledWith({
      where: { id: 'f1' },
      data: { status: 'ACTIVE', isActive: true },
    })
    expect(prismaMock.fundraiserProduct.createMany).toHaveBeenCalledWith({
      data: [{ productId: 'p1', fundraiserId: 'f1' }],
      skipDuplicates: true,
    })
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
  })

  it('suspends without touching the catalog', async () => {
    const { kit } = await reviewFundraiserAccount('a1', 'suspend', 'admin-1')

    expect(kit).toBeNull()
    expect(resolveKitCatalog).not.toHaveBeenCalled()
    expect(prismaMock.fundraiserAccount.update.mock.calls[0][0].data).toEqual({ status: 'SUSPENDED' })
    expect(prismaMock.fundraiser.update.mock.calls[0][0].data).toEqual({ isActive: false })
    expect(prismaMock.fundraiserProduct.createMany).not.toHaveBeenCalled()
  })

  it('refuses an approval whose kit has salsas with no product', async () => {
    resolveKitCatalog.mockResolvedValue({ kitSize: 16, catalog: [], missingSlugs: ['mango', 'peach'] })
    shouldBlockApproval.mockReturnValue(true)

    const attempt = reviewFundraiserAccount('a1', 'approve', 'admin-1')
    await expect(attempt).rejects.toBeInstanceOf(AccountReviewError)
    await expect(attempt).rejects.toMatchObject({ status: 409, message: expect.stringContaining('mango, peach') })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('says so when the account is gone', async () => {
    prismaMock.fundraiserAccount.findUnique.mockResolvedValue(null)
    await expect(reviewFundraiserAccount('nope', 'approve', 'admin-1')).rejects.toMatchObject({ status: 404 })
  })
})
