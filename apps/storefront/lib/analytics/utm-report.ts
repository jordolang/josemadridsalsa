/**
 * UTM attribution reporting.
 *
 * Groups settled orders by where they came from — the UTM source, medium, or campaign captured at
 * first touch — into orders, revenue, and average order value per group, plus a headline of how
 * much revenue could be attributed at all.
 *
 * **Honesty rule:** an order with no captured source is **Direct / none**, never folded into
 * whichever campaign happens to sort first. Attribution is only ever as complete as capture, so the
 * summary states the share of orders (and revenue) that carried any source rather than implying the
 * top campaigns are the whole story. Orders placed before capture existed, and offline orders, are
 * simply direct here — which is honest, not a gap to paper over.
 */

/** The bucket label for orders with no value on the grouped dimension. */
export const DIRECT_LABEL = 'Direct / none'

export type AttributionDimension = 'source' | 'medium' | 'campaign' | 'referrer'

export const ATTRIBUTION_DIMENSIONS: Array<{ label: string; value: AttributionDimension }> = [
  { label: 'Source', value: 'source' },
  { label: 'Medium', value: 'medium' },
  { label: 'Campaign', value: 'campaign' },
  { label: 'Referrer', value: 'referrer' },
]

export interface AttributedOrder {
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  referrer: string | null
  /** Whole-order revenue in cents. */
  revenueCents: number
}

export interface AttributionRow {
  /** The dimension value, or `DIRECT_LABEL` for orders with none. */
  key: string
  /** True for the Direct / none bucket, so the UI can style it apart. */
  direct: boolean
  orders: number
  revenueCents: number
  /** Mean order value in cents, or null when the group has no orders (never divides by zero). */
  aovCents: number | null
}

export interface AttributionSummary {
  totalOrders: number
  totalRevenueCents: number
  /** Orders carrying a UTM source — the headline "we know where this came from" figure. */
  attributedOrders: number
  attributedRevenueCents: number
  directOrders: number
  directRevenueCents: number
  /** Share of orders with a known UTM source. The capture-honesty figure. */
  coverageRatio: number
}

function dimensionValue(order: AttributedOrder, dimension: AttributionDimension): string | null {
  switch (dimension) {
    case 'source':
      return order.utmSource
    case 'medium':
      return order.utmMedium
    case 'campaign':
      return order.utmCampaign
    case 'referrer':
      return order.referrer
  }
}

/**
 * Rows for one dimension, ranked by revenue. The Direct / none bucket is included as a row so the
 * table always sums to the period total — a report that hides its unattributed remainder overstates
 * every campaign above it.
 */
export function groupByDimension(
  orders: AttributedOrder[],
  dimension: AttributionDimension
): AttributionRow[] {
  const groups = new Map<string, { orders: number; revenueCents: number; direct: boolean }>()

  for (const order of orders) {
    const value = dimensionValue(order, dimension)
    const key = value ?? DIRECT_LABEL
    const existing = groups.get(key)
    if (existing) {
      existing.orders += 1
      existing.revenueCents += order.revenueCents
    } else {
      groups.set(key, { orders: 1, revenueCents: order.revenueCents, direct: value === null })
    }
  }

  return [...groups.entries()]
    .map(([key, g]) => ({
      key,
      direct: g.direct,
      orders: g.orders,
      revenueCents: g.revenueCents,
      aovCents: g.orders > 0 ? Math.round(g.revenueCents / g.orders) : null,
    }))
    .sort((a, b) => b.revenueCents - a.revenueCents)
}

/** Headline totals: how much of the period could be attributed to a UTM source at all. */
export function summariseAttribution(orders: AttributedOrder[]): AttributionSummary {
  let totalRevenueCents = 0
  let attributedOrders = 0
  let attributedRevenueCents = 0

  for (const order of orders) {
    totalRevenueCents += order.revenueCents
    if (order.utmSource !== null) {
      attributedOrders += 1
      attributedRevenueCents += order.revenueCents
    }
  }

  const totalOrders = orders.length

  return {
    totalOrders,
    totalRevenueCents,
    attributedOrders,
    attributedRevenueCents,
    directOrders: totalOrders - attributedOrders,
    directRevenueCents: totalRevenueCents - attributedRevenueCents,
    coverageRatio: totalOrders > 0 ? attributedOrders / totalOrders : 0,
  }
}
