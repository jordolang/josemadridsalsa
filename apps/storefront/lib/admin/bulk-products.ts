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
  // A percentage cannot land on a round number from an arbitrary starting price, and a
  // catalogue priced uniformly is the common case here — so setting the figure directly is
  // its own action rather than arithmetic the operator has to do first.
  z.object({ action: z.literal('set-price'), price: z.number().min(0.01).max(100_000) }),
  // Cost is what margin reporting is computed from, so it needs a way in that is not
  // editing 28 products one at a time.
  z.object({ action: z.literal('set-cost'), cost: z.number().min(0).max(100_000) }),
  // Uses what a supplier most recently actually charged, from the purchase orders that
  // already record it — a real number rather than a remembered one.
  z.object({ action: z.literal('apply-latest-purchase-cost') }),
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
    case 'set-cost':
      return { costPrice: action.cost }
    case 'adjust-price':
    case 'set-price':
    case 'apply-latest-purchase-cost':
      // Per-row: derived from each product's own price, or its own purchase history. A flat
      // `set-price` could be one `updateMany`, but then the audit entry would record what
      // every price became without recording what any of them was.
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

/**
 * Work out each product's change for a flat price.
 *
 * Every row lands on the same figure, so the only thing worth computing is what each one was
 * — which is what makes the change reversible from the audit log.
 */
export function planPriceSet(products: PricedProduct[], price: number): PriceChange[] {
  return products.map((product) => ({ id: product.id, from: product.price, to: price }))
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
    case 'set-price':
      return `Set price to $${action.price.toFixed(2)} on ${plural}`
    case 'set-cost':
      return `Set cost to $${action.cost.toFixed(2)} on ${plural}`
    case 'apply-latest-purchase-cost':
      return `Applied the latest purchase cost to ${plural}`
  }
}

export interface LatestPurchaseCost {
  productId: string
  unitCost: number
}

/**
 * Work out which products get a new cost from their most recent purchase order line.
 *
 * A product that has never been purchased is **skipped**, not zeroed — the whole point of
 * costs is that a missing one stays missing. Callers report the skipped count rather than
 * quietly succeeding on a subset, so "applied to 3 of 20" is visible.
 */
export function planCostFromPurchases(
  productIds: string[],
  latest: LatestPurchaseCost[]
): { updates: Array<{ id: string; cost: number }>; skipped: string[] } {
  const costByProduct = new Map(latest.map((row) => [row.productId, row.unitCost]))
  const updates: Array<{ id: string; cost: number }> = []
  const skipped: string[] = []

  for (const id of productIds) {
    const cost = costByProduct.get(id)
    if (cost === undefined) skipped.push(id)
    else updates.push({ id, cost })
  }

  return { updates, skipped }
}
