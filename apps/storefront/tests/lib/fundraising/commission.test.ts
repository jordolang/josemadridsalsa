import { describe, expect, it } from 'vitest'

import { calculateFundraiserCommission, commissionBase } from '@/lib/fundraising/commission'

describe('commissionBase', () => {
  it('is merchandise only', () => {
    // The order total for this sale would be 66.00 with freight and tax.
    expect(commissionBase({ subtotal: 60, discountAmount: 0 })).toBe(60)
  })

  it('comes down with a discount, since less was earned on the goods', () => {
    expect(commissionBase({ subtotal: 60, discountAmount: 10 })).toBe(50)
  })

  it('never goes negative', () => {
    expect(commissionBase({ subtotal: 20, discountAmount: 25 })).toBe(0)
  })
})

describe('calculateFundraiserCommission', () => {
  it('splits a $10 jar evenly at the standard rate', () => {
    expect(calculateFundraiserCommission({ subtotal: 10, discountAmount: 0 }, 50)).toBe(5)
    expect(calculateFundraiserCommission({ subtotal: 120, discountAmount: 0 }, 50)).toBe(60)
  })

  it('ignores shipping and tax, which the order total would have included', () => {
    // Six jars at $10, $8.95 freight, $1.20 tax — a $70.15 total. Half of that is $35.07,
    // which would have paid the group a share of the carrier and the state.
    const order = { subtotal: 60, discountAmount: 0 }

    expect(calculateFundraiserCommission(order, 50)).toBe(30)
  })

  it('treats the rate as a percentage, not a fraction', () => {
    expect(calculateFundraiserCommission({ subtotal: 100, discountAmount: 0 }, 40)).toBe(40)
  })

  it('rounds to cents for the Decimal rollup', () => {
    expect(calculateFundraiserCommission({ subtotal: 33.33, discountAmount: 0 }, 50)).toBe(16.67)
  })
})
