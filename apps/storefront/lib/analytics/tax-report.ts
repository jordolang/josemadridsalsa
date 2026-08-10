import type { SalesChannel } from '@prisma/client'

/**
 * Sales tax collected, summarised for a filing.
 *
 * Two things drive the shape of this module.
 *
 * **Periods are calendar periods, not rolling windows.** Every other report in
 * `lib/analytics` takes a `7d`/`30d`/`90d` key, because "how are we doing lately" is a rolling
 * question. A sales tax return is not: it covers a named month, quarter or year, and a rolling
 * 90 days cannot be filed against anything. Hence a separate period type rather than reusing
 * `AnalyticsRangeKey`.
 *
 * **Jurisdiction comes from the shipping address, not from Stripe.** `lib/tax-calculator.ts`
 * receives a per-jurisdiction breakdown (state, county, city) from Stripe Tax at checkout, but
 * nothing persists it — only `Order.tax` is stored. Grouping by the destination state is
 * therefore the finest split available over historical orders, and it is also the split a
 * return is filed on. County-level Ohio detail would need the breakdown captured going forward,
 * which would be null for every order already taken.
 */

export type TaxPeriodKey =
  | 'this-month'
  | 'last-month'
  | 'this-quarter'
  | 'last-quarter'
  | 'this-year'
  | 'last-year'

export const TAX_PERIOD_OPTIONS: Array<{ value: TaxPeriodKey; label: string }> = [
  { value: 'this-month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: 'this-quarter', label: 'This quarter' },
  { value: 'last-quarter', label: 'Last quarter' },
  { value: 'this-year', label: 'This year' },
  { value: 'last-year', label: 'Last year' },
]

export function isTaxPeriodKey(value: string | undefined): value is TaxPeriodKey {
  return TAX_PERIOD_OPTIONS.some((option) => option.value === value)
}

export interface TaxPeriod {
  start: Date
  end: Date
  /** How the period reads on a filing — "Q2 2026", "July 2026". */
  label: string
}

/**
 * Resolve a period key against a reference date.
 *
 * `now` is a parameter rather than an internal `new Date()` so the boundaries are testable —
 * quarter and year-end arithmetic is exactly where an off-by-one costs a filing.
 */
export function resolveTaxPeriod(key: TaxPeriodKey, now: Date = new Date()): TaxPeriod {
  const year = now.getFullYear()
  const month = now.getMonth()
  const quarter = Math.floor(month / 3)

  const monthLabel = (y: number, m: number) =>
    new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  switch (key) {
    case 'this-month':
      return { ...bounds(year, month, 1, year, month + 1, 0), label: monthLabel(year, month) }

    case 'last-month': {
      // Day 0 of the current month is the last day of the previous one, which sidesteps
      // month-length and January arithmetic entirely.
      const previous = new Date(year, month, 0)
      const py = previous.getFullYear()
      const pm = previous.getMonth()
      return { ...bounds(py, pm, 1, py, pm + 1, 0), label: monthLabel(py, pm) }
    }

    case 'this-quarter':
      return {
        ...bounds(year, quarter * 3, 1, year, quarter * 3 + 3, 0),
        label: `Q${quarter + 1} ${year}`,
      }

    case 'last-quarter': {
      const lastQuarter = quarter === 0 ? 3 : quarter - 1
      const lastQuarterYear = quarter === 0 ? year - 1 : year
      return {
        ...bounds(lastQuarterYear, lastQuarter * 3, 1, lastQuarterYear, lastQuarter * 3 + 3, 0),
        label: `Q${lastQuarter + 1} ${lastQuarterYear}`,
      }
    }

    case 'this-year':
      return { ...bounds(year, 0, 1, year, 12, 0), label: String(year) }

    case 'last-year':
      return { ...bounds(year - 1, 0, 1, year - 1, 12, 0), label: String(year - 1) }
  }
}

/** Inclusive start-of-day to end-of-day bounds, so an order placed at 23:59 still counts. */
function bounds(
  startYear: number,
  startMonth: number,
  startDay: number,
  endYear: number,
  endMonth: number,
  endDay: number
): { start: Date; end: Date } {
  const start = new Date(startYear, startMonth, startDay)
  start.setHours(0, 0, 0, 0)
  const end = new Date(endYear, endMonth, endDay)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

export interface TaxableOrder {
  orderNumber: string
  createdAt: Date
  subtotalCents: number
  shippingCents: number
  discountCents: number
  taxCents: number
  /** Destination state, uppercased. Null when the order carries no shipping address. */
  state: string | null
  channel: SalesChannel
}

export interface TaxJurisdictionTotal {
  /** Two-letter state, or the `UNKNOWN_JURISDICTION` bucket. */
  state: string
  orderCount: number
  grossSalesCents: number
  taxCents: number
  /** Orders in this state that collected no tax at all. */
  untaxedOrderCount: number
  /** Tax over gross sales. Derived for sanity-checking, not a rate to file at. */
  effectiveRate: number | null
}

/**
 * Orders with no shipping address — every POS and most manual sales — land here rather than
 * being dropped. A sales tax report that silently omits counter sales is worse than one that
 * says it cannot place them.
 */
export const UNKNOWN_JURISDICTION = 'UNKNOWN'

export interface TaxCollectedSummary {
  orderCount: number
  /** Sales before tax: goods less discounts, plus shipping. */
  grossSalesCents: number
  taxCents: number
  /** Orders that collected no tax — exempt, wholesale, or out-of-nexus. */
  untaxedOrderCount: number
  /** Gross sales on those untaxed orders, which a return reports as exempt sales. */
  untaxedSalesCents: number
  byState: TaxJurisdictionTotal[]
  byChannel: Array<{ channel: SalesChannel; orderCount: number; taxCents: number }>
  /** Orders with no shipping address, so no jurisdiction could be assigned. */
  unplaceableOrderCount: number
}

/** Sales before tax. Discounts reduce the base; shipping is part of it in Ohio. */
export function grossSalesCents(order: TaxableOrder): number {
  return order.subtotalCents - order.discountCents + order.shippingCents
}

export function summariseTaxCollected(orders: TaxableOrder[]): TaxCollectedSummary {
  const stateBuckets = new Map<string, TaxJurisdictionTotal>()
  const channelBuckets = new Map<SalesChannel, { orderCount: number; taxCents: number }>()

  let totalGross = 0
  let totalTax = 0
  let untaxedOrderCount = 0
  let untaxedSalesCents = 0
  let unplaceableOrderCount = 0

  for (const order of orders) {
    const gross = grossSalesCents(order)
    totalGross += gross
    totalTax += order.taxCents

    if (order.taxCents === 0) {
      untaxedOrderCount += 1
      untaxedSalesCents += gross
    }

    const state = order.state ? order.state.toUpperCase() : UNKNOWN_JURISDICTION
    if (!order.state) unplaceableOrderCount += 1

    const bucket = stateBuckets.get(state) ?? {
      state,
      orderCount: 0,
      grossSalesCents: 0,
      taxCents: 0,
      untaxedOrderCount: 0,
      effectiveRate: null,
    }
    bucket.orderCount += 1
    bucket.grossSalesCents += gross
    bucket.taxCents += order.taxCents
    if (order.taxCents === 0) bucket.untaxedOrderCount += 1
    stateBuckets.set(state, bucket)

    const channel = channelBuckets.get(order.channel) ?? { orderCount: 0, taxCents: 0 }
    channel.orderCount += 1
    channel.taxCents += order.taxCents
    channelBuckets.set(order.channel, channel)
  }

  const byState = Array.from(stateBuckets.values())
    .map((bucket) => ({
      ...bucket,
      effectiveRate: bucket.grossSalesCents > 0 ? bucket.taxCents / bucket.grossSalesCents : null,
    }))
    // Most tax owed first: that is the order the filings get done in.
    .sort((a, b) => b.taxCents - a.taxCents || b.grossSalesCents - a.grossSalesCents)

  const byChannel = Array.from(channelBuckets.entries())
    .map(([channel, totals]) => ({ channel, ...totals }))
    .sort((a, b) => b.taxCents - a.taxCents || b.orderCount - a.orderCount)

  return {
    orderCount: orders.length,
    grossSalesCents: totalGross,
    taxCents: totalTax,
    untaxedOrderCount,
    untaxedSalesCents,
    byState,
    byChannel,
    unplaceableOrderCount,
  }
}
