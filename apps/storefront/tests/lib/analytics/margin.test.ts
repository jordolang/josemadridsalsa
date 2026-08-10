import { describe, expect, it } from 'vitest'

import {
  describeCoverage,
  effectiveFeeRate,
  formatCents,
  formatRatio,
  marginConfidence,
  summariseMargin,
  summariseNetRevenue,
} from '@/lib/analytics/margin'

const line = (revenue: number, cost: number | null, quantity = 1) => ({
  revenueCents: revenue,
  costCents: cost,
  quantity,
})

const payment = (amount: number, fee: number | null, refunded = 0) => ({
  amountCents: amount,
  feeCents: fee,
  refundedCents: refunded,
})

describe('summariseMargin', () => {
  it('computes gross profit and margin from costed lines', () => {
    const summary = summariseMargin([line(1000, 400), line(500, 200)])
    expect(summary.revenueCents).toBe(1500)
    expect(summary.costCents).toBe(600)
    expect(summary.grossProfitCents).toBe(900)
    expect(summary.marginRatio).toBeCloseTo(0.6, 5)
    expect(summary.coverageRatio).toBe(1)
  })

  it('excludes uncosted lines from the margin rather than treating them as free', () => {
    // The line with no cost would otherwise show 100% margin and drag the average up.
    const summary = summariseMargin([line(1000, 400), line(1000, null)])
    expect(summary.costedRevenueCents).toBe(1000)
    expect(summary.grossProfitCents).toBe(600)
    expect(summary.marginRatio).toBeCloseTo(0.6, 5)
    expect(summary.coverageRatio).toBe(0.5)
  })

  it('divides by costed revenue, not total revenue', () => {
    // Dividing 600 profit by 2000 total revenue would report 30% — understating by exactly
    // the missing cost data, which is a different lie but still a lie.
    const summary = summariseMargin([line(1000, 400), line(1000, null)])
    expect(summary.marginRatio).not.toBeCloseTo(0.3, 5)
  })

  it('reports a null margin when nothing has a cost', () => {
    const summary = summariseMargin([line(1000, null), line(500, null)])
    expect(summary.marginRatio).toBeNull()
    expect(summary.coverageRatio).toBe(0)
    expect(summary.revenueCents).toBe(1500)
  })

  it('handles a period with no sales', () => {
    const summary = summariseMargin([])
    expect(summary.marginRatio).toBeNull()
    expect(summary.coverageRatio).toBe(0)
    expect(summary.revenueCents).toBe(0)
  })

  it('reports a negative margin when something sold below cost', () => {
    const summary = summariseMargin([line(500, 800)])
    expect(summary.grossProfitCents).toBe(-300)
    expect(summary.marginRatio).toBeCloseTo(-0.6, 5)
  })

  it('counts units across all lines, costed or not', () => {
    const summary = summariseMargin([line(1000, 400, 4), line(1000, null, 6)])
    expect(summary.unitsTotal).toBe(10)
    expect(summary.linesTotal).toBe(2)
    expect(summary.linesCosted).toBe(1)
  })

  it('treats a genuinely zero cost as known, not missing', () => {
    // Zero cost is a real answer — a free sample, a comped item. Only null is unknown.
    const summary = summariseMargin([line(1000, 0)])
    expect(summary.coverageRatio).toBe(1)
    expect(summary.marginRatio).toBe(1)
  })
})

describe('marginConfidence', () => {
  it('is none when nothing is costed', () => {
    expect(marginConfidence(summariseMargin([line(1000, null)]))).toBe('none')
  })

  it('is poor below half coverage', () => {
    expect(marginConfidence(summariseMargin([line(400, 100), line(600, null)]))).toBe('poor')
  })

  it('is partial between half and nearly all', () => {
    expect(marginConfidence(summariseMargin([line(700, 100), line(300, null)]))).toBe('partial')
  })

  it('is good at full coverage', () => {
    expect(marginConfidence(summariseMargin([line(1000, 400)]))).toBe('good')
  })
})

describe('describeCoverage', () => {
  it('says so plainly when nothing is costed, and what to do about it', () => {
    const text = describeCoverage(summariseMargin([line(1000, null)]))
    expect(text).toContain('No cost recorded')
    expect(text).toContain('Set a cost price')
  })

  it('states the proportion when coverage is partial', () => {
    const text = describeCoverage(summariseMargin([line(1000, 400), line(1000, null)]))
    expect(text).toContain('1 of 2 line items')
    expect(text).toContain('50% of revenue')
    expect(text).toContain('excluded')
  })

  it('is unqualified at full coverage', () => {
    expect(describeCoverage(summariseMargin([line(1000, 400)]))).toBe('Based on all 1 line items.')
  })

  it('handles an empty period', () => {
    expect(describeCoverage(summariseMargin([]))).toBe('No sales in this period.')
  })
})

describe('summariseNetRevenue', () => {
  it('subtracts fees and refunds from gross', () => {
    const summary = summariseNetRevenue([payment(10_000, 320), payment(5_000, 175)])
    expect(summary.grossCents).toBe(15_000)
    expect(summary.feesCents).toBe(495)
    expect(summary.netCents).toBe(14_505)
  })

  it('does not add the fee back on a refund', () => {
    // Stripe keeps its processing fee on a refunded charge. Computing net by symmetry
    // would overstate what actually came back.
    const summary = summariseNetRevenue([payment(10_000, 320, 10_000)])
    expect(summary.netCents).toBe(-320)
  })

  it('reports fee coverage so an optimistic net is visible as such', () => {
    const summary = summariseNetRevenue([payment(10_000, 320), payment(10_000, null)])
    expect(summary.feeCoverageRatio).toBe(0.5)
    expect(summary.paymentsWithKnownFee).toBe(1)
    // The unknown fee is not guessed at.
    expect(summary.feesCents).toBe(320)
  })

  it('handles no payments', () => {
    const summary = summariseNetRevenue([])
    expect(summary.netCents).toBe(0)
    expect(summary.feeCoverageRatio).toBe(0)
  })
})

describe('effectiveFeeRate', () => {
  it('rates fees against the volume whose fee is actually known', () => {
    const summary = summariseNetRevenue([payment(10_000, 320), payment(10_000, null)])
    // 320 / 10_000, not 320 / 20_000 — the unknown half is not in the denominator.
    expect(effectiveFeeRate(summary)).toBeCloseTo(0.032, 5)
  })

  it('is null when no fee is known', () => {
    expect(effectiveFeeRate(summariseNetRevenue([payment(10_000, null)]))).toBeNull()
  })
})

describe('formatting', () => {
  it('formats cents as dollars with separators', () => {
    expect(formatCents(1_234_567)).toBe('$12,345.67')
  })

  it('formats a negative amount with the sign outside the dollar', () => {
    expect(formatCents(-320)).toBe('-$3.20')
  })

  it('formats a ratio as a percentage, and an unknown as a dash', () => {
    expect(formatRatio(0.6234)).toBe('62.3%')
    expect(formatRatio(null)).toBe('—')
  })
})
