import { describe, expect, it } from 'vitest'

import { fundraiserUnitPrice } from '@/lib/fundraising/pricing'

describe('fundraiserUnitPrice', () => {
  it('charges the fundraiser price when one is set', () => {
    expect(fundraiserUnitPrice(9, 10)).toBe(10)
  })

  it('falls back to the catalogue price when the fundraiser has not set one', () => {
    expect(fundraiserUnitPrice(9, null)).toBe(9)
    expect(fundraiserUnitPrice(9, undefined)).toBe(9)
  })

  it('honours an override of zero rather than treating it as unset', () => {
    // The truthiness check this replaced charged full price for a giveaway.
    expect(fundraiserUnitPrice(9, 0)).toBe(0)
  })

  it('accepts the Decimal-shaped values Prisma returns', () => {
    const decimal = (value: string) => ({ toString: () => value })

    expect(fundraiserUnitPrice(decimal('9.00'), decimal('10.00'))).toBe(10)
    expect(fundraiserUnitPrice(decimal('9.00'), null)).toBe(9)
    expect(fundraiserUnitPrice('9.00', '10.50')).toBe(10.5)
  })
})
