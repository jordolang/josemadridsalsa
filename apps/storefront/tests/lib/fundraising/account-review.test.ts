import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The rules behind verifying a fundraiser account, shared by the web route and
 * the desktop queue. Prisma and the kit lookup are stubbed; what is pinned is
 * what each decision writes and when it refuses.
 */

const prismaMock = {
  $transaction: vi.fn(async (ops: unknown) => (typeof ops === 'function' ? ops(prismaMock) : ops)),
  fundraiserAccount: {
    findUnique: vi.fn(),
    update: vi.fn((args) => ({ op: 'account', ...args })),
    deleteMany: vi.fn(async () => ({ count: 1 })),
  },
  fundraiser: {
    update: vi.fn((args) => ({ op: 'fundraiser', ...args })),
    deleteMany: vi.fn(async () => ({ count: 1 })),
  },
  user: { deleteMany: vi.fn(async () => ({ count: 1 })) },
  fundraiserProduct: { createMany: vi.fn((args) => ({ op: 'products', ...args })) },
}
vi.mock('@/lib/prisma', () => ({ __esModule: true, default: prismaMock, prisma: prismaMock }))

const resolveKitCatalog = vi.fn()
const shouldBlockApproval = vi.fn(() => false)
vi.mock('@/lib/fundraising/kit-catalog.server', () => ({ resolveKitCatalog, shouldBlockApproval }))

const { AccountReviewError, denyFundraiserAccount, reviewFundraiserAccount } = await import('@/lib/fundraising/account-review')

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

describe('denyFundraiserAccount', () => {
  const OWNER = 'mike@josemadridsalsa.com'
  const spam = (overrides: Record<string, unknown> = {}) => ({
    id: 'a1',
    status: 'PENDING',
    approvedAt: null,
    userId: 'u9',
    fundraiserId: 'f1',
    fundraiser: { id: 'f1', name: 'Free Crypto', _count: { orders: 0 } },
    user: { id: 'u9', email: 'bot@spam.test', role: 'FUNDRAISER', _count: { orders: 0 } },
    ...overrides,
  })

  it('deletes the campaign and the login of a sign-up that never went live', async () => {
    prismaMock.fundraiserAccount.findUnique.mockResolvedValue(spam())

    await expect(denyFundraiserAccount('a1', OWNER)).resolves.toEqual({ name: 'Free Crypto', email: 'bot@spam.test' })
    expect(prismaMock.fundraiserAccount.deleteMany).toHaveBeenCalledWith({
      where: { id: 'a1', status: { not: 'APPROVED' }, approvedAt: null },
    })
    expect(prismaMock.fundraiser.deleteMany).toHaveBeenCalledWith({ where: { id: 'f1', orders: { none: {} } } })
    expect(prismaMock.user.deleteMany).toHaveBeenCalledWith({
      where: { id: 'u9', role: 'FUNDRAISER', orders: { none: {} } },
    })
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
  })

  it('also clears one that was declined earlier', async () => {
    prismaMock.fundraiserAccount.findUnique.mockResolvedValue(spam({ status: 'SUSPENDED' }))
    await denyFundraiserAccount('a1', OWNER)
    expect(prismaMock.user.deleteMany).toHaveBeenCalled()
  })

  it.each([
    ['was ever approved', spam({ status: 'SUSPENDED', approvedAt: new Date('2026-10-01') })],
    ['is approved', spam({ status: 'APPROVED' })],
    ['logs in as staff', spam({ user: { id: 'u9', email: 'x@y.z', role: 'ADMIN', _count: { orders: 0 } } })],
    ['has orders', spam({ fundraiser: { id: 'f1', name: 'Free Crypto', _count: { orders: 2 } } })],
    ['has a login with orders', spam({ user: { id: 'u9', email: 'x@y.z', role: 'FUNDRAISER', _count: { orders: 1 } } })],
  ])('refuses one that %s', async (_case, account) => {
    prismaMock.fundraiserAccount.findUnique.mockResolvedValue(account)
    await expect(denyFundraiserAccount('a1', OWNER)).rejects.toMatchObject({ status: 409 })
    expect(prismaMock.fundraiser.deleteMany).not.toHaveBeenCalled()
  })

  // Regression: the checks were read before the transaction that deleted, so an
  // approval landing in between was deleted along with its campaign and login.
  it('stops, and deletes nothing more, when the account was approved after it was read', async () => {
    prismaMock.fundraiserAccount.findUnique.mockResolvedValue(spam())
    prismaMock.fundraiserAccount.deleteMany.mockResolvedValueOnce({ count: 0 })

    await expect(denyFundraiserAccount('a1', OWNER)).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('approved just now'),
    })
    expect(prismaMock.fundraiser.deleteMany).not.toHaveBeenCalled()
    expect(prismaMock.user.deleteMany).not.toHaveBeenCalled()
  })

  it('rolls back when an order arrived after it was read', async () => {
    prismaMock.fundraiserAccount.findUnique.mockResolvedValue(spam())
    prismaMock.fundraiser.deleteMany.mockResolvedValueOnce({ count: 0 })

    await expect(denyFundraiserAccount('a1', OWNER)).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('took an order just now'),
    })
  })

  it('is held to the owner accounts, because it deletes a login', async () => {
    prismaMock.fundraiserAccount.findUnique.mockResolvedValue(spam())
    await expect(denyFundraiserAccount('a1', 'staff@josemadridsalsa.com')).rejects.toMatchObject({ status: 403 })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('says so when the account is gone', async () => {
    prismaMock.fundraiserAccount.findUnique.mockResolvedValue(null)
    await expect(denyFundraiserAccount('nope', OWNER)).rejects.toMatchObject({ status: 404 })
  })
})
