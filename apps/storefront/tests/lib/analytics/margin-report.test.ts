import { describe, expect, it } from 'vitest'

import {
  lineCostCents,
  marginByProduct,
  summariseContribution,
  summariseSoldLines,
  type SoldLine,
} from '@/lib/analytics/margin-report'

const line = (over: Partial<SoldLine> = {}): SoldLine => ({
  productId: 'p1',
  productName: 'Original Mild',
  productSku: 'JMS-MILD-001',
  quantity: 2,
  revenueCents: 1800,
  unitCostCents: 400,
  ...over,
})

describe('lineCostCents', () => {
  it('multiplies the per-unit cost by the quantity', () => {
    // The cost is per unit and the revenue is per line; comparing them directly would report
    // a margin far better than reality on any multi-unit line.
    expect(lineCostCents(line({ quantity: 2, unitCostCents: 400 }))).toBe(800)
  })

  it('keeps a missing cost missing', () => {
    expect(lineCostCents(line({ unitCostCents: null }))).toBeNull()
  })
})

describe('summariseSoldLines', () => {
  it('excludes uncosted lines from profit but not from revenue', () => {
    const summary = summariseSoldLines([
      line({ revenueCents: 1800, unitCostCents: 400, quantity: 2 }),
      line({ productId: 'p2', revenueCents: 900, unitCostCents: null, quantity: 1 }),
    ])

    expect(summary.revenueCents).toBe(2700)
    expect(summary.costedRevenueCents).toBe(1800)
    expect(summary.grossProfitCents).toBe(1000)
    expect(summary.coverageRatio).toBeCloseTo(1800 / 2700)
  })
})

describe('marginByProduct', () => {
  it('groups lines and ranks by revenue', () => {
    const rows = marginByProduct([
      line({ productId: 'p1', revenueCents: 900, quantity: 1 }),
      line({ productId: 'p2', productName: 'Ghost of Clovis', revenueCents: 2700, quantity: 3 }),
      line({ productId: 'p1', revenueCents: 900, quantity: 1 }),
    ])

    expect(rows.map((r) => r.productId)).toEqual(['p2', 'p1'])
    expect(rows[1].summary.revenueCents).toBe(1800)
    expect(rows[1].summary.unitsTotal).toBe(2)
  })

  it('flags a product that sold but has no cost anywhere', () => {
    const rows = marginByProduct([
      line({ productId: 'p1', unitCostCents: null }),
      line({ productId: 'p2', unitCostCents: 400 }),
    ])

    expect(rows.find((r) => r.productId === 'p1')!.uncosted).toBe(true)
    expect(rows.find((r) => r.productId === 'p2')!.uncosted).toBe(false)
  })

  it('does not flag a product that is only partly costed', () => {
    // One costed sale is enough to produce a real, if incomplete, margin.
    const rows = marginByProduct([
      line({ productId: 'p1', unitCostCents: null }),
      line({ productId: 'p1', unitCostCents: 400 }),
    ])

    expect(rows[0].uncosted).toBe(false)
    expect(rows[0].summary.linesCosted).toBe(1)
    expect(rows[0].summary.linesTotal).toBe(2)
  })

  it('labels a row with the most recent name the product sold under', () => {
    const rows = marginByProduct([
      line({ productId: 'p1', productName: 'Old Name' }),
      line({ productId: 'p1', productName: 'New Name' }),
    ])

    expect(rows[0].productName).toBe('New Name')
  })

  it('returns nothing for no sales', () => {
    expect(marginByProduct([])).toEqual([])
  })
})

describe('summariseContribution', () => {
  it('takes the fundraising groups’ share off gross profit', () => {
    const summary = summariseSoldLines([
      line({ revenueCents: 6000, unitCostCents: 400, quantity: 6 }),
    ])

    // $60 of jars costing $24 leaves $36; the group is owed $30 of the merchandise.
    const contribution = summariseContribution(summary, 3000)

    expect(contribution.grossProfitCents).toBe(3600)
    expect(contribution.commissionCents).toBe(3000)
    expect(contribution.contributionCents).toBe(600)
  })

  it('can go negative, which is the point of reporting it', () => {
    const summary = summariseSoldLines([
      line({ revenueCents: 1000, unitCostCents: 700, quantity: 1 }),
    ])

    expect(summariseContribution(summary, 500).contributionCents).toBe(-200)
  })
})
