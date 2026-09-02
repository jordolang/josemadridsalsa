import { describe, expect, it } from 'vitest'

import { fundraiserUnitPrice, splitFundraiserProceeds } from '@/lib/fundraising/pricing'

describe('fundraiserUnitPrice', () => {
  it('charges the product override when the fundraiser has set one', () => {
    expect(fundraiserUnitPrice(10, 12)).toBe(12)
  })

  it("falls back to the fundraiser's own store price, never to retail", () => {
    // The catalogue price is deliberately not a parameter. A campaign selling at ten dollars
    // charges ten for a product it has set no price on, not the nine the retail store asks.
    expect(fundraiserUnitPrice(10, null)).toBe(10)
    expect(fundraiserUnitPrice(10, undefined)).toBe(10)
  })

  it('treats a zero override as a real price', () => {
    // A fundraiser giving something away. Truthiness here would charge for it.
    expect(fundraiserUnitPrice(10, 0)).toBe(0)
  })

  it('accepts Decimals and strings', () => {
    const decimal = (value: string) => ({ toString: () => value })
    expect(fundraiserUnitPrice(decimal('10.00'), decimal('12.00'))).toBe(12)
    expect(fundraiserUnitPrice(decimal('10.00'), null)).toBe(10)
    expect(fundraiserUnitPrice('10.00', '12.50')).toBe(12.5)
  })
})

describe('splitFundraiserProceeds', () => {
  it('splits a ten dollar jar in half by default', () => {
    expect(splitFundraiserProceeds(10, 50)).toEqual({ toGroup: 5, toCompany: 5 })
  })

  it('always accounts for the whole amount, whatever the rounding', () => {
    // A third of a dollar cannot be split evenly; the halves must still sum to the total
    // rather than leaving a stray cent unattributed.
    const { toGroup, toCompany } = splitFundraiserProceeds(10.01, 33)
    expect(toGroup + toCompany).toBeCloseTo(10.01, 10)
  })

  it('hands everything over at a hundred percent and nothing at zero', () => {
    expect(splitFundraiserProceeds(40, 100)).toEqual({ toGroup: 40, toCompany: 0 })
    expect(splitFundraiserProceeds(40, 0)).toEqual({ toGroup: 0, toCompany: 40 })
  })
})
