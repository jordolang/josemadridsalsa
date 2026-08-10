import { describe, expect, it } from 'vitest'

import {
  buildShippingItems,
  DEFAULT_ITEM_WEIGHT_OZ,
  OUNCES_PER_POUND,
  totalWeightOunces,
} from '@/lib/shipping-calculator'

/**
 * Regression tests for the 16× weight bug.
 *
 * `Product.weight` is ounces — a jar is `16` — and both rate paths treated it as pounds, so a
 * single jar was quoted as a 16 lb parcel. On the estimate path that tripped the `> 5 lb`
 * surcharge and charged $10.49 instead of $6.99; a six-jar order quoted as 96 lb.
 *
 * These pin the unit at both ends: what a jar weighs, and what the catalogue value means.
 */

const JAR_WEIGHT_OZ = 16

describe('totalWeightOunces', () => {
  it('treats a 16oz jar as one pound, not sixteen', () => {
    const ounces = totalWeightOunces([{ weightOz: JAR_WEIGHT_OZ, quantity: 1 }])
    expect(ounces).toBe(16)
    expect(ounces / OUNCES_PER_POUND).toBe(1)
  })

  it('puts a six-jar order at six pounds, not ninety-six', () => {
    const ounces = totalWeightOunces([{ weightOz: JAR_WEIGHT_OZ, quantity: 6 }])
    expect(ounces / OUNCES_PER_POUND).toBe(6)
  })

  it('keeps a single jar under the heavy-parcel surcharge', () => {
    // The exact overcharge that happened: one jar read as 16 lb, cleared the 5 lb threshold, and
    // was billed 4.99 + 11 × 0.50 = $10.49 instead of the $6.99 flat rate.
    const pounds = totalWeightOunces([{ weightOz: JAR_WEIGHT_OZ, quantity: 1 }]) / OUNCES_PER_POUND
    expect(pounds).toBeLessThanOrEqual(5)
  })

  it('needs a genuinely heavy order to reach the surcharge', () => {
    // Ten jars is 10 lb and legitimately over the threshold — the fix is not "never surcharge",
    // it is "surcharge on real weight".
    const tenJars = totalWeightOunces([{ weightOz: JAR_WEIGHT_OZ, quantity: 10 }]) / OUNCES_PER_POUND
    expect(tenJars).toBeGreaterThan(5)
  })

  it('sums mixed lines', () => {
    expect(
      totalWeightOunces([
        { weightOz: 16, quantity: 2 },
        { weightOz: 8, quantity: 3 },
      ])
    ).toBe(56)
  })

  it('assumes a jar for a product with no recorded weight', () => {
    expect(totalWeightOunces([{ quantity: 1 }])).toBe(DEFAULT_ITEM_WEIGHT_OZ)
    expect(DEFAULT_ITEM_WEIGHT_OZ).toBe(16)
  })

  it('is zero for an empty basket rather than throwing', () => {
    expect(totalWeightOunces([])).toBe(0)
  })
})

describe('buildShippingItems', () => {
  const lines = [{ productId: 'p1', quantity: 2 }]

  it('passes the catalogue weight through unconverted', () => {
    const items = buildShippingItems(lines, new Map([['p1', { weight: 16 }]]))
    expect(items[0].weightOz).toBe(16)
  })

  it('accepts a Prisma Decimal, which stringifies rather than being a number', () => {
    const decimal = { toString: () => '16' }
    const items = buildShippingItems(lines, new Map([['p1', { weight: decimal }]]))
    expect(items[0].weightOz).toBe(16)
  })

  it('includes dimensions when the product has all three', () => {
    const items = buildShippingItems(
      lines,
      new Map([['p1', { weight: 16, lengthInches: 3.5, widthInches: 3.5, heightInches: 5 }]])
    )
    expect(items[0].dimensions).toEqual({ length: 3.5, width: 3.5, height: 5 })
  })

  it('omits dimensions entirely when one is missing', () => {
    // A half-populated box with a zero in it would compute a nonsense volume; the documented
    // fallback is better than a partly-real number.
    const items = buildShippingItems(
      lines,
      new Map([['p1', { weight: 16, lengthInches: 3.5, widthInches: null, heightInches: 5 }]])
    )
    expect(items[0].dimensions).toBeUndefined()
  })

  it('leaves weight undefined for an unknown product so the default applies', () => {
    const items = buildShippingItems(lines, new Map())
    expect(items[0].weightOz).toBeUndefined()
    expect(items[0].quantity).toBe(2)
  })

  it('ignores a zero or negative weight rather than shipping a weightless parcel', () => {
    expect(buildShippingItems(lines, new Map([['p1', { weight: 0 }]]))[0].weightOz).toBeUndefined()
    expect(buildShippingItems(lines, new Map([['p1', { weight: -5 }]]))[0].weightOz).toBeUndefined()
  })

  it('preserves quantity per line', () => {
    const items = buildShippingItems(
      [
        { productId: 'p1', quantity: 2 },
        { productId: 'p2', quantity: 5 },
      ],
      new Map([
        ['p1', { weight: 16 }],
        ['p2', { weight: 8 }],
      ])
    )
    expect(items.map((i) => i.quantity)).toEqual([2, 5])
    expect(totalWeightOunces(items)).toBe(16 * 2 + 8 * 5)
  })
})
