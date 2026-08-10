import { describe, expect, it } from 'vitest'

import {
  generateExchangeOrderNumber,
  generateStoreCreditCode,
  outcomeForResolution,
  planResolution,
  returnValueCents,
  settledOutcome,
  storeCreditExpiry,
  STORE_CREDIT_VALID_DAYS,
  computeRefundBreakdown,
  isOurFault,
} from '@/lib/orders/return-resolution'

const nothingSettled = { refundId: null, giftCertificateId: null, exchangeOrderId: null }

describe('outcomeForResolution', () => {
  it('maps every resolution to an outcome', () => {
    expect(outcomeForResolution('REFUND')).toBe('REFUND')
    expect(outcomeForResolution('STORE_CREDIT')).toBe('STORE_CREDIT')
    expect(outcomeForResolution('EXCHANGE')).toBe('EXCHANGE')
  })
})

describe('settledOutcome', () => {
  it('reports nothing when the return has produced nothing', () => {
    expect(settledOutcome(nothingSettled)).toBeNull()
  })

  it('recognises each settled outcome', () => {
    expect(settledOutcome({ ...nothingSettled, refundId: 'ref_1' })).toBe('REFUND')
    expect(settledOutcome({ ...nothingSettled, giftCertificateId: 'gc_1' })).toBe('STORE_CREDIT')
    expect(settledOutcome({ ...nothingSettled, exchangeOrderId: 'ord_1' })).toBe('EXCHANGE')
  })
})

describe('planResolution', () => {
  it('allows the outcome a fresh return asks for', () => {
    const plan = planResolution('STORE_CREDIT', nothingSettled)
    expect(plan).toEqual({ ok: true, outcome: 'STORE_CREDIT' })
  })

  it('refuses to settle the same outcome twice', () => {
    const plan = planResolution('REFUND', { ...nothingSettled, refundId: 'ref_1' })
    expect(plan.ok).toBe(false)
    if (plan.ok) throw new Error('expected a block')
    expect(plan.block.code).toBe('ALREADY_SETTLED')
  })

  it('refuses store credit on a return that was already refunded', () => {
    // The case that matters: the customer has their money back and would otherwise also
    // receive credit for the same goods.
    const plan = planResolution('STORE_CREDIT', { ...nothingSettled, refundId: 'ref_1' })
    expect(plan.ok).toBe(false)
    if (plan.ok) throw new Error('expected a block')
    expect(plan.block.code).toBe('CONFLICTING_OUTCOME')
    expect(plan.block.message).toContain('already produced a refund')
  })

  it('refuses a refund on a return that already issued credit', () => {
    const plan = planResolution('REFUND', { ...nothingSettled, giftCertificateId: 'gc_1' })
    expect(plan.ok).toBe(false)
    if (plan.ok) throw new Error('expected a block')
    expect(plan.block.code).toBe('CONFLICTING_OUTCOME')
  })

  it('refuses a refund on a return that already shipped a replacement', () => {
    const plan = planResolution('REFUND', { ...nothingSettled, exchangeOrderId: 'ord_1' })
    expect(plan.ok).toBe(false)
    if (plan.ok) throw new Error('expected a block')
    expect(plan.block.code).toBe('CONFLICTING_OUTCOME')
    expect(plan.block.message).toContain('replacement order')
  })
})

describe('returnValueCents', () => {
  it('values the returned units at what they sold for', () => {
    expect(
      returnValueCents([
        { orderItemId: 'a', quantity: 2, unitPriceCents: 900 },
        { orderItemId: 'b', quantity: 1, unitPriceCents: 1200 },
      ])
    ).toBe(3000)
  })

  it('withholds a restocking fee', () => {
    expect(returnValueCents([{ orderItemId: 'a', quantity: 1, unitPriceCents: 900 }], 200)).toBe(700)
  })

  it('never charges the customer when the fee exceeds the goods', () => {
    expect(returnValueCents([{ orderItemId: 'a', quantity: 1, unitPriceCents: 900 }], 1500)).toBe(0)
  })

  it('is zero for no lines rather than throwing', () => {
    expect(returnValueCents([])).toBe(0)
  })
})

describe('storeCreditExpiry', () => {
  it('gives credit a year, since the customer did not choose to have it', () => {
    const issued = new Date('2026-08-09T12:00:00.000Z')
    const expiry = storeCreditExpiry(issued)
    const days = Math.round((expiry.getTime() - issued.getTime()) / (24 * 60 * 60 * 1000))
    expect(days).toBe(STORE_CREDIT_VALID_DAYS)
  })

  it('does not mutate the date it was given', () => {
    const issued = new Date('2026-08-09T12:00:00.000Z')
    storeCreditExpiry(issued)
    expect(issued.toISOString()).toBe('2026-08-09T12:00:00.000Z')
  })
})

describe('code and number generation', () => {
  it('marks store credit distinctly from a purchased certificate', () => {
    const code = generateStoreCreditCode(new Date('2026-08-09T00:00:00.000Z'), () => 0.5)
    expect(code).toBe('JMS-CR-20260809-5500')
  })

  it('marks an exchange order distinctly from a sale', () => {
    const number = generateExchangeOrderNumber(new Date('2026-08-09T00:00:00.000Z'), () => 0.5)
    expect(number).toBe('JMS-EX-20260809-5500')
  })
})

describe('isOurFault', () => {
  it('counts damage, the wrong item, and a quality problem', () => {
    expect(isOurFault('DAMAGED')).toBe(true)
    expect(isOurFault('WRONG_ITEM')).toBe(true)
    expect(isOurFault('QUALITY_ISSUE')).toBe(true)
  })

  it('does not count a change of mind or a late arrival', () => {
    // A late parcel still arrived, so the delivery was performed.
    expect(isOurFault('CHANGED_MIND')).toBe(false)
    expect(isOurFault('ARRIVED_LATE')).toBe(false)
    expect(isOurFault('OTHER')).toBe(false)
  })
})

describe('computeRefundBreakdown', () => {
  const twoJars = [{ orderItemId: 'a', quantity: 2, unitPriceCents: 900 }]

  const order = {
    orderTaxCents: 261,      // tax on $36 of goods
    orderGoodsCents: 3600,   // four jars ordered
    orderShippingCents: 699,
  }

  it('refunds goods plus the tax on those goods', () => {
    const result = computeRefundBreakdown({ ...order, lines: twoJars, reason: 'CHANGED_MIND' })
    expect(result.goodsCents).toBe(1800)
    // Half the goods came back, so half the tax.
    expect(result.taxCents).toBe(131)
    expect(result.totalCents).toBe(1931)
  })

  it('withholds original shipping when the customer simply changed their mind', () => {
    const result = computeRefundBreakdown({ ...order, lines: twoJars, reason: 'CHANGED_MIND' })
    expect(result.shippingCents).toBe(0)
    expect(result.shippingRefunded).toBe(false)
  })

  it('refunds original shipping when the jar arrived broken', () => {
    const result = computeRefundBreakdown({ ...order, lines: twoJars, reason: 'DAMAGED' })
    expect(result.shippingCents).toBe(699)
    expect(result.totalCents).toBe(1800 + 131 + 699)
  })

  it('apportions tax rather than refunding the whole order’s tax for one line', () => {
    // Refunding all $2.61 for half the goods would hand back tax never collected on them.
    const result = computeRefundBreakdown({ ...order, lines: twoJars, reason: 'CHANGED_MIND' })
    expect(result.taxCents).toBeLessThan(order.orderTaxCents)
  })

  it('never apportions more than the tax actually collected', () => {
    // A returned quantity exceeding the recorded order goods must not amplify the tax.
    const result = computeRefundBreakdown({
      ...order,
      lines: [{ orderItemId: 'a', quantity: 10, unitPriceCents: 900 }],
      reason: 'CHANGED_MIND',
    })
    expect(result.taxCents).toBe(order.orderTaxCents)
  })

  it('does not divide by zero on a fully discounted order', () => {
    const result = computeRefundBreakdown({
      lines: twoJars,
      orderTaxCents: 0,
      orderGoodsCents: 0,
      orderShippingCents: 0,
      reason: 'CHANGED_MIND',
    })
    expect(Number.isNaN(result.taxCents)).toBe(false)
    expect(result.taxCents).toBe(0)
  })

  it('takes a restocking fee off the total', () => {
    const result = computeRefundBreakdown({
      ...order,
      lines: twoJars,
      reason: 'CHANGED_MIND',
      restockingFeeCents: 500,
    })
    expect(result.totalCents).toBe(1931 - 500)
  })

  it('refunds nothing rather than billing the customer when the fee exceeds the value', () => {
    const result = computeRefundBreakdown({
      ...order,
      lines: twoJars,
      reason: 'CHANGED_MIND',
      restockingFeeCents: 999_99,
    })
    expect(result.totalCents).toBe(0)
  })

  it('lets staff force shipping in or out', () => {
    const forcedIn = computeRefundBreakdown({
      ...order,
      lines: twoJars,
      reason: 'CHANGED_MIND',
      refundShippingOverride: true,
    })
    expect(forcedIn.shippingCents).toBe(699)

    const forcedOut = computeRefundBreakdown({
      ...order,
      lines: twoJars,
      reason: 'DAMAGED',
      refundShippingOverride: false,
    })
    expect(forcedOut.shippingCents).toBe(0)
  })

  it('explains the shipping decision, so staff see why before confirming', () => {
    expect(
      computeRefundBreakdown({ ...order, lines: twoJars, reason: 'DAMAGED' }).shippingReason
    ).toContain('down to us')
    expect(
      computeRefundBreakdown({ ...order, lines: twoJars, reason: 'CHANGED_MIND' }).shippingReason
    ).toContain('delivery happened')
  })
})
