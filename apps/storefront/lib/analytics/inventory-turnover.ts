/**
 * Inventory turnover and slow movers.
 *
 * **Scope, stated deliberately:** like the margin report, this is *operational*, not accounting.
 * It answers "how fast is stock selling, and what is sitting still" from the units sold in a
 * period against the stock on hand now — not a valuation for the books, which is QuickBooks'
 * job.
 *
 * **The honesty rule, inherited from `margin.ts`: a missing cost is missing, never zero.** A
 * product with no recorded cost has no inventory value we can trust, so it is excluded from the
 * turnover ratio and counted against coverage rather than valued at $0 — which would report a
 * warehouse full of free stock and flatter the ratio. Every value figure ships with the share of
 * stock it could actually see.
 *
 * **The approximation, stated so it cannot be quoted as more than it is:** a true turnover ratio
 * divides period cost of goods sold by *average* inventory over that period, and the platform
 * keeps no historical inventory snapshots — only what is on hand right now. So both sides are
 * valued at the current cost price: COGS is `unitsSold × currentCost` and inventory is
 * `currentStock × currentCost`. This is the standard small-business proxy; it drifts only when
 * cost prices have moved sharply mid-period, and it is honest about using one cost basis for both.
 *
 * Slow movers need no cost at all — they are about velocity, `unitsSold` against `currentStock` —
 * so that half of the report still works for a catalogue that has never recorded a cost.
 */

/** Days in a year, used to annualise a turnover ratio measured over a shorter window. */
const DAYS_PER_YEAR = 365

export interface ProductStockInput {
  productId: string
  productName: string
  productSku: string
  /** Units on hand right now (on-hand, not net of reservations — turnover is about the shelf). */
  currentStock: number
  /** Current cost price per unit, in cents. Null when none is recorded. */
  unitCostCents: number | null
  /** Units sold in the reporting window. */
  unitsSold: number
}

export interface TurnoverSummary {
  /** Cost of goods sold in the window, over products with a known cost. Integer cents. */
  costedCogsCents: number
  /** Value of stock on hand now, over the same costed products. Integer cents. */
  costedInventoryValueCents: number
  /**
   * Turnover for the window: costed COGS ÷ costed inventory value. Null when there is no costed
   * inventory to divide by. Unitless — "the shelf turned over N times this period".
   */
  turnoverForPeriod: number | null
  /** The same ratio scaled to a yearly rate, so a 30-day window reads as an annual figure. */
  annualisedTurnover: number | null
  /**
   * Average days the current shelf would take to sell through at the window's pace. The inverse
   * of turnover, in days. Null when nothing costed sold, so there is no pace to project.
   */
  daysOnHand: number | null
  /** Fraction of stock units whose cost is known — the honesty figure for the value totals. */
  coverageRatio: number
  totalStockUnits: number
  costedStockUnits: number
  unitsSold: number
  productsTotal: number
}

/**
 * How long a product's current stock will last at the period's selling pace, and how to rank it.
 *
 * `daysOfSupply` is null in the one case that matters most — stock on the shelf and nothing sold —
 * because dividing by a zero pace is not "a very large number of days", it is "no pace at all",
 * and collapsing the two would sort a dead product next to a merely slow one.
 */
export interface ProductTurnover {
  productId: string
  productName: string
  productSku: string
  currentStock: number
  unitsSold: number
  /** Units sold per day across the window. Zero when nothing sold. */
  unitsPerDay: number
  /**
   * Current stock ÷ daily pace. Null when stock remains but nothing sold (no pace to divide by);
   * 0 when the shelf is already empty. A finite value is a real projection of days remaining.
   */
  daysOfSupply: number | null
  /** Stock value at current cost, in cents. Null when no cost is recorded. */
  stockValueCents: number | null
  /**
   * True when the product is holding stock it is not selling: nothing sold in the window, or a
   * days-of-supply beyond the slow-mover horizon. The signal the report exists to surface.
   */
  slowMover: boolean
  /** True when nothing sold at all despite holding stock — the sharpest form of slow mover. */
  noSales: boolean
}

/**
 * Days of supply past which a product counts as a slow mover. A quarter of a year: stock that
 * would take more than three months to clear at the current pace is capital sitting still.
 */
export const SLOW_MOVER_DAYS = 90

/** Round to whole cents so integer-cent inputs stay integer through multiplication. */
function stockValue(input: ProductStockInput): number | null {
  return input.unitCostCents === null ? null : input.currentStock * input.unitCostCents
}

/** Per-product velocity and days of supply. Pure arithmetic on one product's window. */
export function productTurnover(input: ProductStockInput, days: number): ProductTurnover {
  const unitsPerDay = days > 0 ? input.unitsSold / days : 0

  // Stock but no sales → no pace, so days-of-supply is null, not infinity. Empty shelf → 0.
  const daysOfSupply =
    input.currentStock <= 0 ? 0 : unitsPerDay > 0 ? input.currentStock / unitsPerDay : null

  const noSales = input.unitsSold === 0 && input.currentStock > 0
  const slowMover = noSales || (daysOfSupply !== null && daysOfSupply > SLOW_MOVER_DAYS)

  return {
    productId: input.productId,
    productName: input.productName,
    productSku: input.productSku,
    currentStock: input.currentStock,
    unitsSold: input.unitsSold,
    unitsPerDay,
    daysOfSupply,
    stockValueCents: stockValue(input),
    slowMover,
    noSales,
  }
}

/**
 * Overall turnover across the catalogue, valuing both sides at current cost and excluding any
 * product whose cost is unknown (counted against coverage instead). See the file header for why
 * one cost basis is used for both COGS and inventory.
 */
export function summariseTurnover(
  inputs: ProductStockInput[],
  days: number
): TurnoverSummary {
  let costedCogsCents = 0
  let costedInventoryValueCents = 0
  let totalStockUnits = 0
  let costedStockUnits = 0
  let unitsSold = 0

  for (const input of inputs) {
    totalStockUnits += input.currentStock
    unitsSold += input.unitsSold

    if (input.unitCostCents !== null) {
      costedCogsCents += input.unitsSold * input.unitCostCents
      costedInventoryValueCents += input.currentStock * input.unitCostCents
      costedStockUnits += input.currentStock
    }
  }

  const turnoverForPeriod =
    costedInventoryValueCents > 0 ? costedCogsCents / costedInventoryValueCents : null

  const annualisedTurnover =
    turnoverForPeriod !== null && days > 0 ? turnoverForPeriod * (DAYS_PER_YEAR / days) : null

  // Days on hand is the inverse of the period turnover, expressed in days. Needs a positive pace.
  const daysOnHand =
    turnoverForPeriod !== null && turnoverForPeriod > 0 ? days / turnoverForPeriod : null

  return {
    costedCogsCents,
    costedInventoryValueCents,
    turnoverForPeriod,
    annualisedTurnover,
    daysOnHand,
    coverageRatio: totalStockUnits > 0 ? costedStockUnits / totalStockUnits : 0,
    totalStockUnits,
    costedStockUnits,
    unitsSold,
    productsTotal: inputs.length,
  }
}

/**
 * Every product as a turnover row, ranked slowest-moving first.
 *
 * Ordering, most-neglected to least: products holding stock with no sales at all (ranked by the
 * capital tied up — stock value, then units), then finite days-of-supply descending. A product
 * with an empty shelf has nothing to neglect and sorts to the bottom.
 */
export function rankByTurnover(
  inputs: ProductStockInput[],
  days: number
): ProductTurnover[] {
  return inputs.map((input) => productTurnover(input, days)).sort(compareSlowest)
}

/** Just the slow movers, in the same slowest-first order. */
export function slowMovers(inputs: ProductStockInput[], days: number): ProductTurnover[] {
  return rankByTurnover(inputs, days).filter((row) => row.slowMover)
}

function compareSlowest(a: ProductTurnover, b: ProductTurnover): number {
  // No-sales-with-stock is the worst case and sorts above everything with a pace.
  if (a.noSales !== b.noSales) return a.noSales ? -1 : 1

  if (a.noSales && b.noSales) {
    // Both dead: the one tying up more capital is the bigger problem. Compare value only when
    // both are known — a missing cost is not "worth zero", and treating it as zero would sink
    // uncosted dead stock below a trivially cheap known item. Otherwise fall back to units on hand.
    if (
      a.stockValueCents !== null &&
      b.stockValueCents !== null &&
      a.stockValueCents !== b.stockValueCents
    ) {
      return b.stockValueCents - a.stockValueCents
    }
    return b.currentStock - a.currentStock
  }

  // Neither is a dead product: rank by days of supply, longest first. A null here means an empty
  // shelf (0 days-of-supply is stored as 0, not null), which is the least concerning, so sort last.
  const ad = a.daysOfSupply ?? -1
  const bd = b.daysOfSupply ?? -1
  return bd - ad
}

/** "3.2×" turnover, or an em dash when there is nothing costed to compute it from. */
export function formatTurnover(ratio: number | null): string {
  return ratio === null ? '—' : `${ratio.toFixed(1)}×`
}

/** Days rounded to a whole number for display, or an em dash / label supplied by the caller. */
export function formatDays(days: number | null): string {
  return days === null ? '—' : `${Math.round(days)}`
}
