import { describe, expect, it } from 'vitest'

import { REFUNDABLE_PAYMENT_STATUSES, refundableCents } from '@/lib/payments/refund'

describe('REFUNDABLE_PAYMENT_STATUSES', () => {
  it('includes partially refunded, so a second partial refund is not blocked', () => {
    // The refund webhooks set a partly-refunded payment to PARTIALLY_REFUNDED. Guarding on
    // SUCCEEDED alone refused the second partial return on any order.
    expect(REFUNDABLE_PAYMENT_STATUSES).toContain('PARTIALLY_REFUNDED')
  })

  it('includes both paid spellings, since older rows are stored as SUCCEEDED', () => {
    expect(REFUNDABLE_PAYMENT_STATUSES).toContain('SUCCEEDED')
    expect(REFUNDABLE_PAYMENT_STATUSES).toContain('PAID')
  })

  it('excludes statuses with nothing to refund', () => {
    for (const status of ['PENDING', 'FAILED', 'REFUNDED', 'CANCELED', 'PROCESSING']) {
      expect(REFUNDABLE_PAYMENT_STATUSES).not.toContain(status)
    }
  })
})

describe('refundableCents', () => {
  it('is the whole payment when nothing has been refunded', () => {
    expect(refundableCents(5000, [])).toBe(5000)
  })

  it('subtracts refunds that succeeded', () => {
    expect(refundableCents(5000, [{ amount: 2000, status: 'SUCCEEDED' }])).toBe(3000)
  })

  it('ignores pending and failed refunds', () => {
    // A pending refund has not returned any money, so counting it would block a legitimate
    // second refund; a failed one never will.
    expect(
      refundableCents(5000, [
        { amount: 2000, status: 'PENDING' },
        { amount: 1000, status: 'FAILED' },
      ])
    ).toBe(5000)
  })

  it('is zero rather than negative on a fully refunded payment', () => {
    expect(
      refundableCents(5000, [
        { amount: 3000, status: 'SUCCEEDED' },
        { amount: 2000, status: 'SUCCEEDED' },
      ])
    ).toBe(0)
  })

  it('does not go negative if stored refunds somehow exceed the payment', () => {
    expect(refundableCents(5000, [{ amount: 6000, status: 'SUCCEEDED' }])).toBe(0)
  })
})
