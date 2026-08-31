import { beforeEach, describe, expect, it, vi } from 'vitest'

const fundraiserFindUnique = vi.fn()
const fundraiserProductFindMany = vi.fn()
const productFindMany = vi.fn()
const getReferralFromCode = vi.fn()

vi.mock('@/lib/prisma', () => {
  const client = {
    fundraiser: { findUnique: fundraiserFindUnique },
    fundraiserProduct: { findMany: fundraiserProductFindMany },
    product: { findMany: productFindMany },
  }
  return { prisma: client, default: client }
})

vi.mock('@/lib/fundraising/referral-tracker.server', () => ({ getReferralFromCode }))

const {
  FundraiserStoreUnavailableError,
  loadFundraiserStoreProducts,
  resolveFundraiserStore,
} = await import('@/lib/fundraising/store.server')

const campaign = (overrides: Record<string, unknown> = {}) => ({
  id: 'f_1',
  slug: 'zhs-band',
  name: 'Spring Salsa Drive',
  organizationName: 'Zanesville High Band',
  isActive: true,
  status: 'ACTIVE',
  commissionRate: 50,
  defaultUnitPrice: 10,
  ...overrides,
})

const referral = {
  participantId: 'p_1',
  participantName: 'Casey',
  fundraiserId: 'f_1',
  fundraiserName: 'Spring Salsa Drive',
  referralCode: 'CASEY123',
}

beforeEach(() => {
  vi.clearAllMocks()
  fundraiserProductFindMany.mockResolvedValue([])
})

describe('resolveFundraiserStore', () => {
  it('is a retail sale when neither a slug nor a code is given', async () => {
    expect(await resolveFundraiserStore({})).toBeNull()
    expect(fundraiserFindUnique).not.toHaveBeenCalled()
  })

  it('opens the store from the campaign slug alone, with no participant', async () => {
    // The bug this closes: a supporter who shopped from the campaign page carried no
    // referral code, so nothing identified the store and the sale went unattributed.
    fundraiserFindUnique.mockResolvedValue(campaign())

    const store = await resolveFundraiserStore({ fundraiserSlug: 'zhs-band' })

    expect(store?.fundraiserId).toBe('f_1')
    expect(store?.defaultUnitPrice).toBe(10)
    expect(store?.commissionRate).toBe(50)
    expect(store?.participantId).toBeUndefined()
  })

  it('names the seller when the supporter came through their link', async () => {
    getReferralFromCode.mockResolvedValue(referral)
    fundraiserFindUnique.mockResolvedValue(campaign())

    const store = await resolveFundraiserStore({
      fundraiserSlug: 'zhs-band',
      referralCode: 'CASEY123',
    })

    expect(store?.participantId).toBe('p_1')
    expect(store?.participantName).toBe('Casey')
    expect(store?.fundraiserId).toBe('f_1')
  })

  it('ignores a code naming a different campaign than the cart was filled in', async () => {
    // Crediting the code's group for a sale made on another campaign's page would take the
    // money from the group that actually earned it.
    getReferralFromCode.mockResolvedValue({ ...referral, fundraiserId: 'f_other' })
    fundraiserFindUnique
      .mockResolvedValueOnce(campaign({ id: 'f_other', slug: 'other-school' }))
      .mockResolvedValueOnce(campaign())

    const store = await resolveFundraiserStore({
      fundraiserSlug: 'zhs-band',
      referralCode: 'CASEY123',
    })

    expect(store?.fundraiserId).toBe('f_1')
    expect(store?.participantId).toBeUndefined()
  })

  it('is closed for a campaign that has ended, been cancelled, or gone inactive', async () => {
    for (const state of [{ status: 'ENDED' }, { status: 'CANCELLED' }, { isActive: false }]) {
      fundraiserFindUnique.mockResolvedValue(campaign(state))
      expect(await resolveFundraiserStore({ fundraiserSlug: 'zhs-band' })).toBeNull()
    }
  })

  it('is closed for a slug that names no campaign', async () => {
    fundraiserFindUnique.mockResolvedValue(null)

    expect(await resolveFundraiserStore({ fundraiserSlug: 'nope' })).toBeNull()
  })

  it('carries the price a fundraiser set for one product, and its store price for the rest', async () => {
    fundraiserFindUnique.mockResolvedValue(campaign())
    fundraiserProductFindMany.mockResolvedValue([
      { productId: 'salsa-1', price: 12.5 },
      // A null price means "sell at this store's price", not "sell at retail".
      { productId: 'salsa-2', price: null },
    ])

    const store = await resolveFundraiserStore({ fundraiserSlug: 'zhs-band' })

    expect(store?.prices.get('salsa-1')).toBe(12.5)
    expect(store?.prices.get('salsa-2')).toBe(10)
    expect(store?.productIds).toEqual(new Set(['salsa-1', 'salsa-2']))
  })

  it('sells the whole catalogue when the campaign has curated nothing', async () => {
    fundraiserFindUnique.mockResolvedValue(campaign())
    fundraiserProductFindMany.mockResolvedValue([])

    const store = await resolveFundraiserStore({ fundraiserSlug: 'zhs-band' })

    // Null, not an empty set: an empty catalogue is not an empty shop.
    expect(store?.productIds).toBeNull()
  })

  it('only ever offers products the campaign is actively selling', async () => {
    fundraiserFindUnique.mockResolvedValue(campaign())
    await resolveFundraiserStore({ fundraiserSlug: 'zhs-band' })

    expect(fundraiserProductFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { fundraiserId: 'f_1', isActive: true } })
    )
  })

  it('refuses to guess when the lookup fails', async () => {
    // Falling back to retail would charge the wrong price and credit nobody, silently. The
    // checkout routes turn this into a 503 rather than taking the money.
    fundraiserFindUnique.mockRejectedValue(new Error('database is down'))

    await expect(resolveFundraiserStore({ fundraiserSlug: 'zhs-band' })).rejects.toBeInstanceOf(
      FundraiserStoreUnavailableError
    )
  })
})

describe('loadFundraiserStoreProducts', () => {
  const shelf = [
    { id: 'salsa-1', name: 'Black Bean', slug: 'black-bean', description: null, featuredImage: null, heatLevel: 'MEDIUM', sku: 'BB', inventory: 5 },
    { id: 'salsa-2', name: 'Chipotle', slug: 'chipotle', description: null, featuredImage: null, heatLevel: 'HOT', sku: 'CH', inventory: 5 },
  ]

  it("prices the shelf at the store's prices, never the catalogue's", async () => {
    fundraiserFindUnique.mockResolvedValue(campaign())
    fundraiserProductFindMany.mockResolvedValue([{ productId: 'salsa-1', price: 12.5 }])
    productFindMany.mockResolvedValue(shelf)

    const store = await resolveFundraiserStore({ fundraiserSlug: 'zhs-band' })
    const products = await loadFundraiserStoreProducts(store!)

    expect(products.map((p) => p.price)).toEqual([12.5, 10])
  })

  it('narrows the shelf to a curated catalogue', async () => {
    fundraiserFindUnique.mockResolvedValue(campaign())
    fundraiserProductFindMany.mockResolvedValue([{ productId: 'salsa-1', price: null }])
    productFindMany.mockResolvedValue([shelf[0]])

    const store = await resolveFundraiserStore({ fundraiserSlug: 'zhs-band' })
    await loadFundraiserStoreProducts(store!)

    expect(productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['salsa-1'] }, isActive: true } })
    )
  })

  it('shows every active product when the campaign has curated nothing', async () => {
    fundraiserFindUnique.mockResolvedValue(campaign())
    fundraiserProductFindMany.mockResolvedValue([])
    productFindMany.mockResolvedValue(shelf)

    const store = await resolveFundraiserStore({ fundraiserSlug: 'zhs-band' })
    const products = await loadFundraiserStoreProducts(store!)

    expect(productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } })
    )
    // All at the store price — this replaces the shelf that warned supporters their
    // purchase benefited nobody.
    expect(products.every((p) => p.price === 10)).toBe(true)
  })
})
