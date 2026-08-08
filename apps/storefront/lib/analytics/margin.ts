/**
 * Operational margin.
 *
 * **Scope, stated deliberately:** this is *not* an accounting number. QuickBooks Online is
 * the source of truth for the books, and a second net-income figure that disagrees with it
 * would be worse than no figure at all. What this answers is the question QBO answers badly
 * — which products, orders and channels actually make money — using the sale price and the
 * cost snapshotted onto each line at the time it sold.
 *
 * The design rule throughout: **a missing cost is missing, never zero.** A line with no
 * recorded cost is excluded from the margin and counted against coverage, because averaging
 * it in as free stock would report a margin far better than reality. Every figure here
 * therefore ships with the proportion of revenue it was actually able to see.
 */

export interface MarginLine {
  /** Sale price for the whole line, in cents. */
  revenueCents: number
  /** Cost for the whole line, in cents. Null when no cost was recorded at sale time. */
  costCents: number | null
  quantity: number
}

export interface MarginSummary {
  /** Revenue across every line, costed or not. */
  revenueCents: number
  /** Revenue across only the lines that had a cost, i.e. what the margin is computed from. */
  costedRevenueCents: number
  costCents: number
  grossProfitCents: number
  /** Margin as a fraction of costed revenue, or null when nothing was costed. */
  marginRatio: number | null
  /** Fraction of revenue with a known cost. The honesty figure. */
  coverageRatio: number
  linesTotal: number
  linesCosted: number
  unitsTotal: number
}

/**
 * Summarise a set of lines.
 *
 * `marginRatio` is computed against `costedRevenueCents`, not total revenue — dividing
 * profit-we-can-see by revenue-we-cannot would understate margin by exactly the amount of
 * missing cost data, which is a different lie from the one we are avoiding but still a lie.
 */
export function summariseMargin(lines: MarginLine[]): MarginSummary {
  let revenueCents = 0
  let costedRevenueCents = 0
  let costCents = 0
  let linesCosted = 0
  let unitsTotal = 0

  for (const line of lines) {
    revenueCents += line.revenueCents
    unitsTotal += line.quantity

    if (line.costCents !== null) {
      costedRevenueCents += line.revenueCents
      costCents += line.costCents
      linesCosted += 1
    }
  }

  const grossProfitCents = costedRevenueCents - costCents

  return {
    revenueCents,
    costedRevenueCents,
    costCents,
    grossProfitCents,
    marginRatio: costedRevenueCents > 0 ? grossProfitCents / costedRevenueCents : null,
    coverageRatio: revenueCents > 0 ? costedRevenueCents / revenueCents : 0,
    linesTotal: lines.length,
    linesCosted,
    unitsTotal,
  }
}

/**
 * How much a margin figure can be trusted, given how much of its revenue was costed.
 *
 * Thresholds are a judgement, not a standard: below half, the number describes a minority of
 * sales and should not be quoted without the caveat attached.
 */
export type MarginConfidence = 'none' | 'poor' | 'partial' | 'good'

export function marginConfidence(summary: MarginSummary): MarginConfidence {
  if (summary.costedRevenueCents === 0) return 'none'
  if (summary.coverageRatio < 0.5) return 'poor'
  if (summary.coverageRatio < 0.9) return 'partial'
  return 'good'
}

/**
 * The sentence that must accompany any margin figure.
 *
 * Exists so the caveat cannot be dropped by accident: a dashboard that renders the number
 * without it is a dashboard that will eventually be quoted as fact.
 */
export function describeCoverage(summary: MarginSummary): string {
  if (summary.linesTotal === 0) return 'No sales in this period.'
  if (summary.costedRevenueCents === 0) {
    return `No cost recorded on any of these ${summary.linesTotal} line items, so margin cannot be calculated. Set a cost price on your products to see it.`
  }

  const pct = Math.round(summary.coverageRatio * 100)
  if (pct >= 100) return `Based on all ${summary.linesTotal} line items.`

  return `Based on ${summary.linesCosted} of ${summary.linesTotal} line items — ${pct}% of revenue. The rest have no recorded cost and are excluded.`
}

/**
 * Net revenue after what the processors actually charged.
 *
 * Refunds reduce revenue but do **not** return the fee: Stripe keeps its processing fee on a
 * refunded charge, and computing net by symmetry would overstate what came back. The fee is
 * sunk at the moment the payment succeeded.
 *
 * `feesKnownCents` is separate from `feeCoverage` for the same reason as margin coverage — a
 * net figure computed over payments whose fees are still unknown is optimistic, and the
 * caller has to be able to say by how much.
 */
export interface ProcessorFeeInput {
  amountCents: number
  /** Null when the processor has not told us yet. */
  feeCents: number | null
  refundedCents: number
}

export interface NetRevenueSummary {
  grossCents: number
  refundedCents: number
  feesCents: number
  netCents: number
  /** Fraction of gross payment volume whose fee is known. */
  feeCoverageRatio: number
  paymentsTotal: number
  paymentsWithKnownFee: number
}

export function summariseNetRevenue(payments: ProcessorFeeInput[]): NetRevenueSummary {
  let grossCents = 0
  let refundedCents = 0
  let feesCents = 0
  let knownFeeVolume = 0
  let paymentsWithKnownFee = 0

  for (const payment of payments) {
    grossCents += payment.amountCents
    refundedCents += payment.refundedCents

    if (payment.feeCents !== null) {
      feesCents += payment.feeCents
      knownFeeVolume += payment.amountCents
      paymentsWithKnownFee += 1
    }
  }

  return {
    grossCents,
    refundedCents,
    feesCents,
    // Refunds subtract; fees subtract. The fee on a refunded payment is not added back.
    netCents: grossCents - refundedCents - feesCents,
    feeCoverageRatio: grossCents > 0 ? knownFeeVolume / grossCents : 0,
    paymentsTotal: payments.length,
    paymentsWithKnownFee,
  }
}

/** Effective processor rate across payments whose fee is known. Null when none are. */
export function effectiveFeeRate(summary: NetRevenueSummary): number | null {
  const knownVolume = summary.grossCents * summary.feeCoverageRatio
  return knownVolume > 0 ? summary.feesCents / knownVolume : null
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  return `${sign}$${(Math.abs(cents) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatRatio(ratio: number | null): string {
  return ratio === null ? '—' : `${(ratio * 100).toFixed(1)}%`
}
