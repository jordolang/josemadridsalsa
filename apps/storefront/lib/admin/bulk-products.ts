import { z } from 'zod'

/**
 * Bulk product edits.
 *
 * Every action here changes many rows at once, so the guiding rule is that an action is
 * either fully described up front or refused. In particular a percentage price change is
 * computed per product from its current price, which means it cannot be expressed as a
 * single `updateMany` — the planning is done here so it stays testable without a database,
 * and so a bad multiplier is caught before any row is written.
 */

/** Refuse edits larger than this in one go; a runaway selection should not silently apply. */
export const MAX_BULK_PRODUCTS = 200

export const BulkProductActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('activate') }),
  z.object({ action: z.literal('deactivate') }),
  z.object({ action: z.literal('feature') }),
  z.object({ action: z.literal('unfeature') }),
  z.object({ action: z.literal('assign-category'), categoryId: z.string().cuid() }),
  z.object({
    action: z.literal('adjust-price'),
    // Bounded either side: a typo of 1000 would wreck the catalogue, and -100 would make
    // everything free.
    percent: z.number().gte(-90).lte(500),
  }),
])

export const BulkProductRequestSchema = z.object({
  productIds: z.array(z.string().cuid()).min(1).max(MAX_BULK_PRODUCTS),
  operation: BulkProductActionSchema,
})

export type BulkProductAction = z.infer<typeof BulkProductActionSchema>

/** Field updates that apply identically to every selected row. */
export function uniformUpdateFor(
  action: BulkProductAction
): Record<string, unknown> | null {
  switch (action.action) {
    case 'activate':
      return { isActive: true }
    case 'deactivate':
      return { isActive: false }
    case 'feature':
      return { isFeatured: true }
    case 'unfeature':
      return { isFeatured: false }
    case 'assign-category':
      return { categoryId: action.categoryId }
    case 'adjust-price':
      // Per-row, derived from each product's own price.
      return null
  }
}

export interface PricedProduct {
  id: string
  price: number
}

export interface PriceChange {
  id: string
  from: number
  to: number
}

/**
 * Work out each product's new price for a percentage adjustment.
 *
 * Rounded to cents, and floored at one cent — a large negative adjustment should make
 * things cheap, never free or negative, which would be a pricing incident rather than a
 * discount.
 */
export function planPriceAdjustment(
  products: PricedProduct[],
  percent: number
): PriceChange[] {
  const multiplier = 1 + percent / 100

  return products.map((product) => {
    const raw = product.price * multiplier
    const to = Math.max(0.01, Math.round(raw * 100) / 100)
    return { id: product.id, from: product.price, to }
  })
}

/** Human summary for the audit entry and the toast. */
export function describeBulkAction(action: BulkProductAction, count: number): string {
  const plural = `${count} product${count === 1 ? '' : 's'}`

  switch (action.action) {
    case 'activate':
      return `Activated ${plural}`
    case 'deactivate':
      return `Deactivated ${plural}`
    case 'feature':
      return `Featured ${plural}`
    case 'unfeature':
      return `Unfeatured ${plural}`
    case 'assign-category':
      return `Moved ${plural} to a new category`
    case 'adjust-price':
      return `${action.percent >= 0 ? 'Raised' : 'Lowered'} prices on ${plural} by ${Math.abs(action.percent)}%`
  }
}
