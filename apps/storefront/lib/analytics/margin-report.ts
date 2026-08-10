import { summariseMargin, type MarginLine, type MarginSummary } from './margin'

/**
 * Shaping for the margin dashboard: grouping sold lines by product.
 *
 * Kept apart from the page so the arithmetic is testable without a database, and apart from
 * `margin.ts` so that module stays a pure summariser with no notion of products.
 *
 * The rule inherited from there, and the reason this file exists rather than a `groupBy` in
 * the query: **a line with no recorded cost is excluded from profit and counted against
 * coverage.** SQL would have to either drop those rows — losing the revenue — or coalesce the
 * cost to zero, which reports the item as pure profit. Neither is acceptable, so the grouping
 * happens here where "missing" survives.
 */

export interface SoldLine {
  productId: string
  productName: string
  /** Recorded on the order item at the time of sale, so a renamed product keeps its history. */
  productSku: string
  quantity: number
  /** Whole-line revenue in cents. */
  revenueCents: number
  /** Per-unit cost in cents at the time of sale. Null when none was recorded. */
  unitCostCents: number | null
}

export interface ProductMargin {
  productId: string
  productName: string
  productSku: string
  summary: MarginSummary
  /** True when nothing this product sold had a cost, i.e. it contributes revenue but no profit. */
  uncosted: boolean
}

/** Whole-line cost, or null. Per-unit cost times quantity — the two are not interchangeable. */
export function lineCostCents(line: SoldLine): number | null {
  return line.unitCostCents === null ? null : line.unitCostCents * line.quantity
}

function toMarginLine(line: SoldLine): MarginLine {
  return {
    revenueCents: line.revenueCents,
    costCents: lineCostCents(line),
    quantity: line.quantity,
  }
}

/** Overall summary across every line, costed or not. */
export function summariseSoldLines(lines: SoldLine[]): MarginSummary {
  return summariseMargin(lines.map(toMarginLine))
}

/**
 * One row per product, ordered by revenue.
 *
 * Ordered by revenue rather than profit deliberately: a product with no cost recorded has no
 * profit to sort by, and ranking by a figure that half the catalogue lacks would bury exactly
 * the items that need attention.
 */
export function marginByProduct(lines: SoldLine[]): ProductMargin[] {
  const grouped = new Map<string, SoldLine[]>()

  for (const line of lines) {
    const existing = grouped.get(line.productId)
    if (existing) existing.push(line)
    else grouped.set(line.productId, [line])
  }

  const rows: ProductMargin[] = []

  for (const [productId, productLines] of grouped) {
    const summary = summariseSoldLines(productLines)
    // The most recent name and SKU win, so a row reads as the product is called today.
    const latest = productLines[productLines.length - 1]

    rows.push({
      productId,
      productName: latest.productName,
      productSku: latest.productSku,
      summary,
      uncosted: summary.linesCosted === 0,
    })
  }

  return rows.sort((a, b) => b.summary.revenueCents - a.summary.revenueCents)
}

/**
 * What is left after the fundraising groups take their share.
 *
 * Gross profit alone overstates the fundraiser channel, where roughly half the merchandise
 * value is owed to the group. This is reported as its own figure rather than folded into the
 * margin, because a single blended percentage that quietly nets commission on some orders and
 * not others cannot be read correctly by anyone.
 */
export interface ContributionSummary {
  grossProfitCents: number
  commissionCents: number
  contributionCents: number
}

export function summariseContribution(
  summary: MarginSummary,
  commissionCents: number
): ContributionSummary {
  return {
    grossProfitCents: summary.grossProfitCents,
    commissionCents,
    contributionCents: summary.grossProfitCents - commissionCents,
  }
}
