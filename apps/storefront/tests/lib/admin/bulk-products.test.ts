import { describe, expect, it } from 'vitest'

import {
  BulkProductRequestSchema,
  describeBulkAction,
  MAX_BULK_PRODUCTS,
  planPriceAdjustment,
  uniformUpdateFor,
} from '@/lib/admin/bulk-products'

const cuid = (n: number) => `c${String(n).padStart(24, '0')}`

describe('BulkProductRequestSchema', () => {
  it('accepts a well-formed request', () => {
    const parsed = BulkProductRequestSchema.safeParse({
      productIds: [cuid(1)],
      operation: { action: 'activate' },
    })
    expect(parsed.success).toBe(true)
  })

  it('refuses an empty selection', () => {
    expect(
      BulkProductRequestSchema.safeParse({ productIds: [], operation: { action: 'activate' } })
        .success
    ).toBe(false)
  })

  it('refuses a selection larger than the cap', () => {
    // A runaway selection should fail loudly rather than quietly rewriting the catalogue.
    const ids = Array.from({ length: MAX_BULK_PRODUCTS + 1 }, (_, i) => cuid(i))
    expect(
      BulkProductRequestSchema.safeParse({ productIds: ids, operation: { action: 'activate' } })
        .success
    ).toBe(false)
  })

  it('bounds a price adjustment either side', () => {
    const attempt = (percent: number) =>
      BulkProductRequestSchema.safeParse({
        productIds: [cuid(1)],
        operation: { action: 'adjust-price', percent },
      }).success

    expect(attempt(10)).toBe(true)
    expect(attempt(-50)).toBe(true)
    // A typo of 1000 would wreck the catalogue; -100 would make everything free.
    expect(attempt(1000)).toBe(false)
    expect(attempt(-100)).toBe(false)
  })

  it('requires a category id when assigning one', () => {
    expect(
      BulkProductRequestSchema.safeParse({
        productIds: [cuid(1)],
        operation: { action: 'assign-category' },
      }).success
    ).toBe(false)
  })

  it('rejects an unknown action', () => {
    expect(
      BulkProductRequestSchema.safeParse({
        productIds: [cuid(1)],
        operation: { action: 'delete-everything' },
      }).success
    ).toBe(false)
  })
})

describe('uniformUpdateFor', () => {
  it('maps the flag actions to field updates', () => {
    expect(uniformUpdateFor({ action: 'activate' })).toEqual({ isActive: true })
    expect(uniformUpdateFor({ action: 'deactivate' })).toEqual({ isActive: false })
    expect(uniformUpdateFor({ action: 'feature' })).toEqual({ isFeatured: true })
    expect(uniformUpdateFor({ action: 'unfeature' })).toEqual({ isFeatured: false })
    expect(uniformUpdateFor({ action: 'assign-category', categoryId: cuid(9) })).toEqual({
      categoryId: cuid(9),
    })
  })

  it('returns null for a price adjustment, which is per-row', () => {
    // Signals to the caller that updateMany cannot express it.
    expect(uniformUpdateFor({ action: 'adjust-price', percent: 10 })).toBeNull()
  })
})

describe('planPriceAdjustment', () => {
  const products = [
    { id: 'a', price: 10 },
    { id: 'b', price: 7.99 },
  ]

  it('raises prices by a percentage', () => {
    expect(planPriceAdjustment(products, 10)).toEqual([
      { id: 'a', from: 10, to: 11 },
      { id: 'b', from: 7.99, to: 8.79 },
    ])
  })

  it('lowers prices by a percentage', () => {
    expect(planPriceAdjustment([{ id: 'a', price: 10 }], -25)).toEqual([
      { id: 'a', from: 10, to: 7.5 },
    ])
  })

  it('rounds to whole cents rather than leaving fractional pennies', () => {
    expect(planPriceAdjustment([{ id: 'a', price: 9.99 }], 7)[0].to).toBe(10.69)
  })

  it('never produces a free or negative price', () => {
    // Large discounts should make things cheap, not a pricing incident.
    expect(planPriceAdjustment([{ id: 'a', price: 0.05 }], -90)[0].to).toBe(0.01)
    expect(planPriceAdjustment([{ id: 'a', price: 0.01 }], -90)[0].to).toBe(0.01)
  })

  it('leaves prices untouched at zero percent', () => {
    expect(planPriceAdjustment(products, 0).map((p) => p.to)).toEqual([10, 7.99])
  })

  it('handles an empty selection', () => {
    expect(planPriceAdjustment([], 10)).toEqual([])
  })
})

describe('describeBulkAction', () => {
  it('summarises each action with correct pluralisation', () => {
    expect(describeBulkAction({ action: 'activate' }, 1)).toBe('Activated 1 product')
    expect(describeBulkAction({ action: 'deactivate' }, 3)).toBe('Deactivated 3 products')
  })

  it('describes the direction of a price change', () => {
    expect(describeBulkAction({ action: 'adjust-price', percent: 10 }, 2)).toBe(
      'Raised prices on 2 products by 10%'
    )
    expect(describeBulkAction({ action: 'adjust-price', percent: -15 }, 1)).toBe(
      'Lowered prices on 1 product by 15%'
    )
  })
})
