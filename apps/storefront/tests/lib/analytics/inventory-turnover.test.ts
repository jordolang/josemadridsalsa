import { describe, expect, it } from 'vitest'

import {
  SLOW_MOVER_DAYS,
  formatDays,
  formatTurnover,
  productTurnover,
  rankByTurnover,
  slowMovers,
  summariseTurnover,
  type ProductStockInput,
} from '@/lib/analytics/inventory-turnover'

const product = (
  overrides: Partial<ProductStockInput> & Pick<ProductStockInput, 'productId'>
): ProductStockInput => ({
  productName: overrides.productName ?? overrides.productId,
  productSku: overrides.productSku ?? `SKU-${overrides.productId}`,
  currentStock: 0,
  unitCostCents: null,
  unitsSold: 0,
  ...overrides,
})

describe('productTurnover', () => {
  it('projects days of supply from the window pace', () => {
    // 30 sold over 30 days = 1/day; 60 on hand ⇒ 60 days of supply.
    const row = productTurnover(product({ productId: 'a', currentStock: 60, unitsSold: 30 }), 30)
    expect(row.unitsPerDay).toBeCloseTo(1, 5)
    expect(row.daysOfSupply).toBeCloseTo(60, 5)
    expect(row.slowMover).toBe(false)
    expect(row.noSales).toBe(false)
  })

  it('reports no pace (null), not infinity, when stock sits with no sales', () => {
    const row = productTurnover(product({ productId: 'a', currentStock: 40, unitsSold: 0 }), 30)
    expect(row.daysOfSupply).toBeNull()
    expect(row.noSales).toBe(true)
    expect(row.slowMover).toBe(true)
  })

  it('reports zero days of supply for an empty shelf, and never a slow mover', () => {
    const row = productTurnover(product({ productId: 'a', currentStock: 0, unitsSold: 0 }), 30)
    expect(row.daysOfSupply).toBe(0)
    expect(row.noSales).toBe(false)
    expect(row.slowMover).toBe(false)
  })

  it('flags a slow mover past the days-of-supply horizon', () => {
    // 1 sold over 30 days with 200 on hand ⇒ 6000 days of supply, well past the horizon.
    const row = productTurnover(product({ productId: 'a', currentStock: 200, unitsSold: 1 }), 30)
    expect(row.daysOfSupply).toBeGreaterThan(SLOW_MOVER_DAYS)
    expect(row.slowMover).toBe(true)
    expect(row.noSales).toBe(false)
  })

  it('values stock at current cost, and leaves it null when uncosted', () => {
    expect(
      productTurnover(product({ productId: 'a', currentStock: 10, unitCostCents: 250 }), 30)
        .stockValueCents
    ).toBe(2500)
    expect(
      productTurnover(product({ productId: 'a', currentStock: 10, unitCostCents: null }), 30)
        .stockValueCents
    ).toBeNull()
  })
})

describe('summariseTurnover', () => {
  it('values both COGS and inventory at current cost and annualises', () => {
    // One product: cost 100¢, 10 on hand (1000¢ value), 20 sold in 30 days (2000¢ COGS).
    const summary = summariseTurnover(
      [product({ productId: 'a', currentStock: 10, unitCostCents: 100, unitsSold: 20 })],
      30
    )
    expect(summary.costedCogsCents).toBe(2000)
    expect(summary.costedInventoryValueCents).toBe(1000)
    expect(summary.turnoverForPeriod).toBeCloseTo(2, 5)
    expect(summary.annualisedTurnover).toBeCloseTo(2 * (365 / 30), 5)
    expect(summary.daysOnHand).toBeCloseTo(15, 5)
    expect(summary.coverageRatio).toBe(1)
  })

  it('excludes uncosted stock from the value totals and counts it against coverage', () => {
    const summary = summariseTurnover(
      [
        product({ productId: 'a', currentStock: 10, unitCostCents: 100, unitsSold: 20 }),
        // Uncosted: 90 units on hand, must not be valued at zero nor drag the ratio.
        product({ productId: 'b', currentStock: 90, unitCostCents: null, unitsSold: 5 }),
      ],
      30
    )
    expect(summary.costedInventoryValueCents).toBe(1000)
    expect(summary.costedCogsCents).toBe(2000)
    expect(summary.turnoverForPeriod).toBeCloseTo(2, 5)
    // 10 of 100 stock units are costed.
    expect(summary.coverageRatio).toBeCloseTo(0.1, 5)
    expect(summary.totalStockUnits).toBe(100)
    expect(summary.unitsSold).toBe(25)
  })

  it('returns null ratios when nothing is costed', () => {
    const summary = summariseTurnover(
      [product({ productId: 'a', currentStock: 10, unitCostCents: null, unitsSold: 5 })],
      30
    )
    expect(summary.turnoverForPeriod).toBeNull()
    expect(summary.annualisedTurnover).toBeNull()
    expect(summary.daysOnHand).toBeNull()
    expect(summary.coverageRatio).toBe(0)
  })
})

describe('rankByTurnover', () => {
  it('sorts no-sales-with-stock first, then longest days of supply', () => {
    const rows = rankByTurnover(
      [
        product({ productId: 'fast', currentStock: 5, unitsSold: 100 }), // ~1.5 days supply
        product({ productId: 'dead', currentStock: 30, unitsSold: 0 }), // no sales
        product({ productId: 'slow', currentStock: 200, unitsSold: 2 }), // long supply
        product({ productId: 'empty', currentStock: 0, unitsSold: 0 }), // empty shelf, last
      ],
      30
    )
    expect(rows.map((r) => r.productId)).toEqual(['dead', 'slow', 'fast', 'empty'])
  })

  it('breaks ties among dead products by capital tied up', () => {
    const rows = rankByTurnover(
      [
        product({ productId: 'cheap', currentStock: 100, unitCostCents: 50, unitsSold: 0 }),
        product({ productId: 'pricey', currentStock: 10, unitCostCents: 5000, unitsSold: 0 }),
      ],
      30
    )
    // pricey holds $500 of stock vs cheap's $50, so it leads despite fewer units.
    expect(rows.map((r) => r.productId)).toEqual(['pricey', 'cheap'])
  })
})

describe('slowMovers', () => {
  it('returns only the flagged rows, slowest first', () => {
    const rows = slowMovers(
      [
        product({ productId: 'fast', currentStock: 5, unitsSold: 100 }),
        product({ productId: 'dead', currentStock: 30, unitsSold: 0 }),
        product({ productId: 'slow', currentStock: 200, unitsSold: 2 }),
      ],
      30
    )
    expect(rows.map((r) => r.productId)).toEqual(['dead', 'slow'])
  })
})

describe('formatters', () => {
  it('formats a turnover ratio with an em dash for null', () => {
    expect(formatTurnover(3.24)).toBe('3.2×')
    expect(formatTurnover(null)).toBe('—')
  })

  it('rounds days and em-dashes null', () => {
    expect(formatDays(59.6)).toBe('60')
    expect(formatDays(null)).toBe('—')
  })
})
