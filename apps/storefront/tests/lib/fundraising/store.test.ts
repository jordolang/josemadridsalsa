import { describe, expect, it } from 'vitest'

import { priceInStore, type FundraiserStore } from '@/lib/fundraising/store.server'

function store(overrides: Partial<FundraiserStore> = {}): FundraiserStore {
  return {
    fundraiserId: 'fundraiser-1',
    slug: 'zhs-band',
    name: 'Spring Salsa Drive',
    organizationName: 'Zanesville High Band',
    commissionRate: 50,
    defaultUnitPrice: 10,
    prices: new Map(),
    productIds: null,
    ...overrides,
  }
}

describe('priceInStore', () => {
  it("charges the store's price for a product it has not priced individually", () => {
    // The bug this closes: the campaign page quoted ten dollars and checkout charged the
    // nine dollar catalogue price, so the group's half came out of nothing.
    const { prices, unavailable } = priceInStore(store(), ['salsa-1'])

    expect(prices.get('salsa-1')).toBe(10)
    expect(unavailable).toEqual([])
  })

  it('charges a per-product price where the fundraiser has set one', () => {
    const { prices } = priceInStore(
      store({ prices: new Map([['salsa-1', 12.5]]) }),
      ['salsa-1', 'salsa-2']
    )

    expect(prices.get('salsa-1')).toBe(12.5)
    expect(prices.get('salsa-2')).toBe(10)
  })

  it('sells the whole catalogue when the fundraiser has curated none of it', () => {
    const { unavailable } = priceInStore(store({ productIds: null }), ['anything'])

    expect(unavailable).toEqual([])
  })

  it('refuses a product a curated store does not carry', () => {
    // Charging retail for it is exactly what this module exists to prevent, so it is
    // reported instead of quietly priced.
    const { prices, unavailable } = priceInStore(
      store({ productIds: new Set(['salsa-1']) }),
      ['salsa-1', 'salsa-9']
    )

    expect(prices.get('salsa-1')).toBe(10)
    expect(prices.has('salsa-9')).toBe(false)
    expect(unavailable).toEqual(['salsa-9'])
  })

  it('honours a free product rather than falling through to the store price', () => {
    const { prices } = priceInStore(store({ prices: new Map([['salsa-1', 0]]) }), ['salsa-1'])

    expect(prices.get('salsa-1')).toBe(0)
  })
})
