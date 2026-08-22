import { describe, expect, it } from 'vitest'

import {
  allocateBundlePrices,
  bundleProductRows,
  bundleSavings,
  slugSchema,
  type BundleComponentForPricing,
} from '@/lib/bundles'

const sum = (ns: number[]) => Math.round(ns.reduce((s, n) => s + n, 0) * 100) / 100

describe('bundleProductRows', () => {
  it('assigns sortOrder by position and defaults quantity to 1', () => {
    expect(bundleProductRows([{ productId: 'a', quantity: 2 }, { productId: 'b', quantity: 1 }])).toEqual([
      { productId: 'a', quantity: 2, sortOrder: 0 },
      { productId: 'b', quantity: 1, sortOrder: 1 },
    ])
  })

  it('drops duplicates (first wins), floors bad quantities to 1, ignores blanks', () => {
    expect(
      bundleProductRows([
        { productId: 'a', quantity: 3 },
        { productId: 'a', quantity: 9 }, // dup dropped
        { productId: '  ', quantity: 1 }, // blank
        { productId: 'b', quantity: 0 }, // → 1
        { productId: 'c', quantity: 2.5 }, // non-int → 1
      ])
    ).toEqual([
      { productId: 'a', quantity: 3, sortOrder: 0 },
      { productId: 'b', quantity: 1, sortOrder: 1 },
      { productId: 'c', quantity: 1, sortOrder: 2 },
    ])
  })
})

describe('allocateBundlePrices', () => {
  const components: BundleComponentForPricing[] = [
    { productId: 'a', basePrice: 10, quantity: 1 },
    { productId: 'b', basePrice: 5, quantity: 1 },
  ]

  it('splits the price weighted by catalogue value and sums exactly to the bundle price', () => {
    const lines = allocateBundlePrices(components, 12, 1)
    // weights 10 : 5 → 8.00 : 4.00 of $12
    expect(lines).toEqual([
      { productId: 'a', quantity: 1, unitPrice: 8, totalPrice: 8 },
      { productId: 'b', quantity: 1, unitPrice: 4, totalPrice: 4 },
    ])
    expect(sum(lines.map((l) => l.totalPrice))).toBe(12)
  })

  it('distributes leftover cents so the total is exact (no lost/gained penny)', () => {
    // $10 split 1:1:1 = 3.333… each → 3.34 / 3.33 / 3.33 summing to 10.00
    const three: BundleComponentForPricing[] = [
      { productId: 'a', basePrice: 1, quantity: 1 },
      { productId: 'b', basePrice: 1, quantity: 1 },
      { productId: 'c', basePrice: 1, quantity: 1 },
    ]
    const lines = allocateBundlePrices(three, 10, 1)
    expect(sum(lines.map((l) => l.totalPrice))).toBe(10)
    expect(lines.map((l) => l.totalPrice).sort()).toEqual([3.33, 3.33, 3.34])
  })

  it('multiplies component quantities by the number of bundles and stays exact', () => {
    // 2 bundles of ($12: a×2, b×1)
    const comps: BundleComponentForPricing[] = [
      { productId: 'a', basePrice: 10, quantity: 2 },
      { productId: 'b', basePrice: 5, quantity: 1 },
    ]
    const lines = allocateBundlePrices(comps, 12, 2)
    expect(lines[0].quantity).toBe(4) // 2 per bundle × 2 bundles
    expect(lines[1].quantity).toBe(2)
    expect(sum(lines.map((l) => l.totalPrice))).toBe(24) // $12 × 2
  })

  it('falls back to unit-count weighting when every base price is zero', () => {
    const comps: BundleComponentForPricing[] = [
      { productId: 'a', basePrice: 0, quantity: 1 },
      { productId: 'b', basePrice: 0, quantity: 3 },
    ]
    const lines = allocateBundlePrices(comps, 8, 1)
    // weights 1 : 3 → 2.00 : 6.00
    expect(lines[0].totalPrice).toBe(2)
    expect(lines[1].totalPrice).toBe(6)
    expect(sum(lines.map((l) => l.totalPrice))).toBe(8)
  })

  it('splits an unevenly-divisible component so unitPrice × quantity equals the line total', () => {
    // $10 across qty 3 → 333⅓¢ each. Split into 1 unit at 3.34 and 2 at 3.33, summing to 10.00.
    const comps: BundleComponentForPricing[] = [{ productId: 'a', basePrice: 1, quantity: 3 }]
    const lines = allocateBundlePrices(comps, 10, 1)
    expect(lines).toEqual([
      { productId: 'a', quantity: 1, unitPrice: 3.34, totalPrice: 3.34 },
      { productId: 'a', quantity: 2, unitPrice: 3.33, totalPrice: 6.66 },
    ])
    expect(sum(lines.map((l) => l.totalPrice))).toBe(10)
  })

  it('guarantees unitPrice × quantity === totalPrice for every line it returns', () => {
    // A deliberately awkward mix: uneven weights and quantities, multiple bundles.
    const comps: BundleComponentForPricing[] = [
      { productId: 'a', basePrice: 7.99, quantity: 2 },
      { productId: 'b', basePrice: 3.49, quantity: 3 },
      { productId: 'c', basePrice: 12.5, quantity: 1 },
    ]
    const lines = allocateBundlePrices(comps, 19.99, 3)
    for (const line of lines) {
      expect(Math.round(line.unitPrice * 100) * line.quantity).toBe(Math.round(line.totalPrice * 100))
    }
    expect(sum(lines.map((l) => l.totalPrice))).toBe(sum([19.99 * 3]))
  })

  it('is empty for no components', () => {
    expect(allocateBundlePrices([], 10, 1)).toEqual([])
  })
})

describe('bundleSavings', () => {
  it('is the positive difference, or zero', () => {
    expect(bundleSavings(20, 15)).toBe(5)
    expect(bundleSavings(15, 20)).toBe(0)
    expect(bundleSavings(19.99, 17.5)).toBe(2.49)
  })
})

describe('slugSchema (reused from collections)', () => {
  it('accepts a URL-safe segment and rejects the rest', () => {
    expect(slugSchema.safeParse('gift-set').success).toBe(true)
    expect(slugSchema.safeParse('gift/set').success).toBe(false)
    expect(slugSchema.safeParse('Gift Set').success).toBe(false)
  })
})
