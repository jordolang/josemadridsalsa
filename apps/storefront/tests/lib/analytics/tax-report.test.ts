import { describe, expect, it } from 'vitest'

import {
  grossSalesCents,
  resolveTaxPeriod,
  summariseTaxCollected,
  UNKNOWN_JURISDICTION,
  type TaxableOrder,
} from '@/lib/analytics/tax-report'

const order = (overrides: Partial<TaxableOrder> = {}): TaxableOrder => ({
  orderNumber: 'JMS-1000',
  createdAt: new Date('2026-07-15T12:00:00.000Z'),
  subtotalCents: 5000,
  shippingCents: 800,
  discountCents: 0,
  taxCents: 435,
  state: 'OH',
  channel: 'WEBSITE',
  ...overrides,
})

describe('resolveTaxPeriod', () => {
  it('bounds a month inclusively so a sale at 23:59 on the last day counts', () => {
    const period = resolveTaxPeriod('this-month', new Date(2026, 6, 15))
    expect(period.start.getTime()).toBe(new Date(2026, 6, 1, 0, 0, 0, 0).getTime())
    expect(period.end.getTime()).toBe(new Date(2026, 6, 31, 23, 59, 59, 999).getTime())
    expect(period.label).toBe('July 2026')
  })

  it('rolls last-month back across a year boundary', () => {
    const period = resolveTaxPeriod('last-month', new Date(2026, 0, 10))
    expect(period.start.getFullYear()).toBe(2025)
    expect(period.start.getMonth()).toBe(11)
    expect(period.end.getDate()).toBe(31)
    expect(period.label).toBe('December 2025')
  })

  it('handles a short previous month without spilling into it', () => {
    // From 31 March, day 0 of March is 28 February — not 3 March, which naive
    // date arithmetic produces.
    const period = resolveTaxPeriod('last-month', new Date(2026, 2, 31))
    expect(period.start.getMonth()).toBe(1)
    expect(period.end.getDate()).toBe(28)
  })

  it('covers a whole quarter', () => {
    const period = resolveTaxPeriod('this-quarter', new Date(2026, 4, 20))
    expect(period.start.getMonth()).toBe(3)
    expect(period.end.getMonth()).toBe(5)
    expect(period.end.getDate()).toBe(30)
    expect(period.label).toBe('Q2 2026')
  })

  it('rolls last-quarter back into the previous year from Q1', () => {
    const period = resolveTaxPeriod('last-quarter', new Date(2026, 1, 5))
    expect(period.label).toBe('Q4 2025')
    expect(period.start.getFullYear()).toBe(2025)
    expect(period.start.getMonth()).toBe(9)
    expect(period.end.getMonth()).toBe(11)
    expect(period.end.getDate()).toBe(31)
  })

  it('covers a whole year', () => {
    const period = resolveTaxPeriod('last-year', new Date(2026, 7, 9))
    expect(period.label).toBe('2025')
    expect(period.start.getMonth()).toBe(0)
    expect(period.end.getMonth()).toBe(11)
    expect(period.end.getDate()).toBe(31)
  })
})

describe('grossSalesCents', () => {
  it('takes discounts off the base and puts shipping in it', () => {
    expect(
      grossSalesCents(order({ subtotalCents: 5000, discountCents: 500, shippingCents: 800 }))
    ).toBe(5300)
  })
})

describe('summariseTaxCollected', () => {
  it('totals tax and gross sales', () => {
    const summary = summariseTaxCollected([
      order({ taxCents: 435 }),
      order({ taxCents: 200, subtotalCents: 2000, shippingCents: 500 }),
    ])
    expect(summary.taxCents).toBe(635)
    expect(summary.grossSalesCents).toBe(5800 + 2500)
    expect(summary.orderCount).toBe(2)
  })

  it('reports untaxed sales separately, which is a line on the return', () => {
    const summary = summariseTaxCollected([
      order({ taxCents: 435 }),
      // A wholesale sale with a resale certificate: real revenue, no tax.
      order({ taxCents: 0, subtotalCents: 12000, shippingCents: 0, channel: 'WHOLESALE' }),
    ])
    expect(summary.untaxedOrderCount).toBe(1)
    expect(summary.untaxedSalesCents).toBe(12000)
  })

  it('groups by destination state, most tax owed first', () => {
    const summary = summariseTaxCollected([
      order({ state: 'PA', taxCents: 100 }),
      order({ state: 'OH', taxCents: 400 }),
      order({ state: 'OH', taxCents: 300 }),
    ])
    expect(summary.byState.map((row) => row.state)).toEqual(['OH', 'PA'])
    expect(summary.byState[0].taxCents).toBe(700)
    expect(summary.byState[0].orderCount).toBe(2)
  })

  it('normalises state casing so oh and OH are one jurisdiction', () => {
    const summary = summariseTaxCollected([
      order({ state: 'oh', taxCents: 100 }),
      order({ state: 'OH', taxCents: 100 }),
    ])
    expect(summary.byState).toHaveLength(1)
    expect(summary.byState[0].taxCents).toBe(200)
  })

  it('buckets orders with no shipping address rather than dropping them', () => {
    // A counter sale has no address. Omitting it would understate what was collected.
    const summary = summariseTaxCollected([
      order({ state: null, taxCents: 60, channel: 'POS' }),
      order({ state: 'OH', taxCents: 400 }),
    ])
    expect(summary.taxCents).toBe(460)
    expect(summary.unplaceableOrderCount).toBe(1)
    expect(summary.byState.some((row) => row.state === UNKNOWN_JURISDICTION)).toBe(true)
  })

  it('derives an effective rate per state, and none where there were no sales', () => {
    const summary = summariseTaxCollected([
      order({ state: 'OH', subtotalCents: 10000, shippingCents: 0, taxCents: 725 }),
    ])
    expect(summary.byState[0].effectiveRate).toBeCloseTo(0.0725)
  })

  it('reports no rate rather than dividing by zero on a fully discounted order', () => {
    const summary = summariseTaxCollected([
      order({ state: 'OH', subtotalCents: 5000, discountCents: 5000, shippingCents: 0, taxCents: 0 }),
    ])
    expect(summary.byState[0].effectiveRate).toBeNull()
  })

  it('groups by sales channel', () => {
    const summary = summariseTaxCollected([
      order({ channel: 'WEBSITE', taxCents: 400 }),
      order({ channel: 'POS', taxCents: 100 }),
      order({ channel: 'POS', taxCents: 50 }),
    ])
    expect(summary.byChannel[0]).toMatchObject({ channel: 'WEBSITE', taxCents: 400 })
    expect(summary.byChannel[1]).toMatchObject({ channel: 'POS', orderCount: 2, taxCents: 150 })
  })

  it('returns zeroed totals for an empty period rather than throwing', () => {
    const summary = summariseTaxCollected([])
    expect(summary).toMatchObject({
      orderCount: 0,
      taxCents: 0,
      grossSalesCents: 0,
      byState: [],
      byChannel: [],
    })
  })
})
