import { describe, expect, it } from 'vitest'

import {
  ShowFinancialsInputSchema,
  computeShowFinancials,
  estimateManifestRevenue,
  totalExpenses,
  totalSales,
} from '@/lib/events/show-financials'

const noCosts = { boothFee: null, costOfFuel: null, lodging: null, meals: null, otherExpenses: null }
const noSales = { cashSales: null, cardSales: null }

describe('totalExpenses', () => {
  it('sums every cost line', () => {
    expect(
      totalExpenses({ boothFee: 250, costOfFuel: 80, lodging: 120, meals: 45, otherExpenses: 15 })
    ).toBe(510)
  })

  it('treats a blank line as zero rather than blocking the total', () => {
    expect(totalExpenses({ ...noCosts, boothFee: 200 })).toBe(200)
  })

  it('is zero when nothing has been entered', () => {
    expect(totalExpenses(noCosts)).toBe(0)
  })

  it('never lets a negative slip in reduce the total', () => {
    expect(totalExpenses({ ...noCosts, boothFee: 100, meals: -50 })).toBe(100)
  })
})

describe('totalSales', () => {
  it('adds cash and card', () => {
    expect(totalSales({ cashSales: 400, cardSales: 650 })).toBe(1050)
  })

  it('counts a blank half as zero', () => {
    expect(totalSales({ cashSales: 400, cardSales: null })).toBe(400)
  })
})

describe('computeShowFinancials', () => {
  it('reports a profit and no remaining break-even once sales clear costs', () => {
    const result = computeShowFinancials({
      boothFee: 250,
      costOfFuel: 80,
      lodging: 120,
      meals: 50,
      otherExpenses: 0,
      cashSales: 500,
      cardSales: 800,
    })
    expect(result.totalExpenses).toBe(500)
    expect(result.totalSales).toBe(1300)
    expect(result.netProfit).toBe(800)
    expect(result.amountToBreakEven).toBe(0)
    expect(result.hasBrokenEven).toBe(true)
    expect(result.margin).toBeCloseTo(0.6154, 3)
  })

  it('reports the shortfall while a show is still underwater', () => {
    const result = computeShowFinancials({
      ...noCosts,
      boothFee: 600,
      cashSales: 200,
      cardSales: 150,
    })
    expect(result.totalExpenses).toBe(600)
    expect(result.totalSales).toBe(350)
    expect(result.netProfit).toBe(-250)
    expect(result.amountToBreakEven).toBe(250)
    expect(result.hasBrokenEven).toBe(false)
  })

  it('treats exact break-even as broken even, with nothing left to sell', () => {
    const result = computeShowFinancials({ ...noCosts, boothFee: 500, cashSales: 500, cardSales: null })
    expect(result.netProfit).toBe(0)
    expect(result.amountToBreakEven).toBe(0)
    expect(result.hasBrokenEven).toBe(true)
  })

  it('leaves margin null when nothing sold, rather than dividing by zero', () => {
    const result = computeShowFinancials({ ...noCosts, boothFee: 100, ...noSales })
    expect(result.totalSales).toBe(0)
    expect(result.margin).toBeNull()
    expect(result.amountToBreakEven).toBe(100)
  })

  it('rounds to whole cents', () => {
    const result = computeShowFinancials({ ...noCosts, boothFee: 33.33, cashSales: 66.66, cardSales: null })
    expect(result.netProfit).toBe(33.33)
  })
})

describe('estimateManifestRevenue', () => {
  it('prices each product line by units sold', () => {
    expect(
      estimateManifestRevenue([
        { soldUnits: 12, unitPrice: 9 },
        { soldUnits: 6, unitPrice: 8.5 },
      ])
    ).toBe(159)
  })

  it('counts a product with an unknown price as zero rather than NaN', () => {
    expect(estimateManifestRevenue([{ soldUnits: 10, unitPrice: null }])).toBe(0)
  })

  it('ignores a negative sold count', () => {
    expect(estimateManifestRevenue([{ soldUnits: -5, unitPrice: 9 }])).toBe(0)
  })

  it('clamps a negative price so a bad catalogue value cannot subtract revenue', () => {
    expect(estimateManifestRevenue([{ soldUnits: 10, unitPrice: -9 }])).toBe(0)
  })
})

describe('ShowFinancialsInputSchema', () => {
  it('accepts a fully entered form', () => {
    const parsed = ShowFinancialsInputSchema.safeParse({
      boothFee: 250,
      costOfFuel: 80,
      lodging: 120,
      meals: 50,
      otherExpenses: 15,
      otherExpensesNote: 'tolls and ice',
      cashSales: 500,
      cardSales: 800,
    })
    expect(parsed.success).toBe(true)
  })

  it('preserves a blank field as null instead of coercing it to zero', () => {
    const parsed = ShowFinancialsInputSchema.safeParse({ boothFee: null })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.boothFee).toBeNull()
  })

  it('rejects a negative figure', () => {
    expect(ShowFinancialsInputSchema.safeParse({ cashSales: -1 }).success).toBe(false)
  })

  it('rejects a figure past the sanity cap', () => {
    expect(ShowFinancialsInputSchema.safeParse({ cardSales: 2_000_000 }).success).toBe(false)
  })
})
