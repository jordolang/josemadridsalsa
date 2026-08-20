/**
 * How much of the business the ledger has actually captured, measured against documents nobody
 * here can edit.
 *
 * The ledger can be internally perfect and still be describing a fraction of the company: every row
 * correct, every total consistent, and 60% of the year simply never written down. Nothing inside
 * the ledger can detect that, because the missing rows leave no trace. This module is the outside
 * check — it puts ledger income for a year next to the figure on that year's filed return and
 * reports the difference.
 *
 * The number to watch is `capturedRatio`. It is the migration's actual progress bar: as channels
 * get real ingestion paths it climbs toward 1, and until it does, any report built on the ledger is
 * describing a partial company. That is the whole reason this file exists rather than another
 * dashboard tile.
 *
 * **The one rule that keeps this honest:** a `FLOOR` anchor is a lower bound, not a target. Ledger
 * income exceeding it means the ledger knows more than the surviving paperwork did, which is the
 * goal, not a defect. So overage against a FLOOR is reported as `ABOVE_FLOOR` and never as a
 * discrepancy, and floors are excluded from every aggregate ratio. Treating them as targets would
 * quietly cap the system's ambition at whatever a spreadsheet happened to record in 2017.
 *
 * Pure functions only — the caller supplies ledger totals. See `anchors.ts` for the figures.
 */
import {
  type AnchorGrade,
  type RevenueAnchor,
  anchorForYear,
  isCompleteYear,
  REVENUE_ANCHORS,
} from './anchors'

/**
 * The verdict for one year.
 *
 * `NO_ANCHOR` and `NO_LEDGER_DATA` are separate outcomes rather than a zero, because "we have no
 * document for 2012" and "the ledger holds nothing for 2012" are different facts and only one of
 * them is fixable.
 */
export type ReconciliationStatus =
  | 'RECONCILED'
  | 'UNDER_CAPTURED'
  | 'OVER_CAPTURED'
  | 'ABOVE_FLOOR'
  | 'NO_ANCHOR'
  | 'NO_LEDGER_DATA'

/**
 * Tolerance for calling a year reconciled, in cents.
 *
 * $1.00 rather than 0: anchors are read off documents that round to the dollar (every filed
 * Schedule C figure here is whole dollars), so demanding exact cent equality would mark a
 * genuinely reconciled year as broken.
 */
export const RECONCILIATION_TOLERANCE_CENTS = 100

export type YearReconciliation = {
  year: number
  /** Income the ledger holds for the year, in cents. */
  ledgerIncomeCents: number
  /** The attested figure, or null when no document covers the year. */
  anchorCents: number | null
  grade: AnchorGrade | null
  status: ReconciliationStatus
  /**
   * `ledgerIncomeCents - anchorCents`. Negative means the ledger is missing money that the
   * paperwork proves existed. Null when there is nothing to compare against.
   */
  varianceCents: number | null
  /**
   * Ledger income as a fraction of the anchor, or null when there is no anchor. Not clamped — a
   * value above 1 against a floor is meaningful information, not an error to hide.
   */
  capturedRatio: number | null
  anchor: RevenueAnchor | null
}

/** Ledger income for a single year, as supplied by the caller. */
export type LedgerYearTotal = {
  year: number
  incomeCents: number
}

function statusFor(
  ledgerIncomeCents: number,
  anchor: RevenueAnchor | null,
  hasLedgerRows: boolean,
): ReconciliationStatus {
  if (!anchor) return 'NO_ANCHOR'
  if (!hasLedgerRows) return 'NO_LEDGER_DATA'

  const variance = ledgerIncomeCents - anchor.grossReceiptsCents
  if (Math.abs(variance) <= RECONCILIATION_TOLERANCE_CENTS) return 'RECONCILED'

  // A floor is a lower bound. Beating it is the point of the exercise.
  if (variance > 0) return anchor.grade === 'FLOOR' ? 'ABOVE_FLOOR' : 'OVER_CAPTURED'
  return 'UNDER_CAPTURED'
}

/**
 * Reconcile ledger income against the anchors.
 *
 * Every anchored year is emitted whether or not the ledger holds rows for it — a year the ledger
 * has never heard of is the single most important thing this report can surface, and it would
 * vanish if the ledger drove the row set. Years present in the ledger but absent from the anchors
 * are emitted too, as `NO_ANCHOR`, so nothing is silently dropped.
 */
export function reconcileYears(ledgerTotals: LedgerYearTotal[]): YearReconciliation[] {
  const byYear = new Map(ledgerTotals.map((t) => [t.year, t.incomeCents]))
  const years = new Set<number>([...REVENUE_ANCHORS.map((a) => a.year), ...byYear.keys()])

  return [...years]
    .sort((a, b) => a - b)
    .map((year) => {
      const anchor = anchorForYear(year)
      const hasLedgerRows = byYear.has(year)
      const ledgerIncomeCents = byYear.get(year) ?? 0
      const anchorCents = anchor?.grossReceiptsCents ?? null

      return {
        year,
        ledgerIncomeCents,
        anchorCents,
        grade: anchor?.grade ?? null,
        status: statusFor(ledgerIncomeCents, anchor, hasLedgerRows),
        varianceCents: anchorCents === null ? null : ledgerIncomeCents - anchorCents,
        capturedRatio:
          anchorCents === null || anchorCents === 0 ? null : ledgerIncomeCents / anchorCents,
        anchor,
      }
    })
}

export type ReconciliationSummary = {
  /** Years whose anchor states a whole year — the only ones that roll up meaningfully. */
  completeYears: number
  /** Of those, how many reconcile within tolerance. */
  reconciledYears: number
  /** Ledger income across complete years, in cents. */
  ledgerIncomeCents: number
  /** Attested revenue across the same years, in cents. */
  anchorCents: number
  /** Money the paperwork proves exists that the ledger has never recorded, in cents. Never negative. */
  missingCents: number
  /** Ledger income over attested revenue across complete years, or null when there are none. */
  capturedRatio: number | null
  /** The worst-covered complete years, largest shortfall first. Where the work is. */
  largestGaps: YearReconciliation[]
}

/**
 * Roll the per-year rows into one progress figure.
 *
 * Only `FILED` and `PL` years are counted. Mixing in a half-year and six lower bounds would produce
 * a ratio that looks like a measurement and is not one — the denominator would be part real, part
 * placeholder, and it would drift every time a floor got revised.
 */
export function summariseReconciliation(rows: YearReconciliation[]): ReconciliationSummary {
  const complete = rows.filter((r) => r.grade !== null && isCompleteYear(r.grade))

  const ledgerIncomeCents = complete.reduce((sum, r) => sum + r.ledgerIncomeCents, 0)
  const anchorCents = complete.reduce((sum, r) => sum + (r.anchorCents ?? 0), 0)

  return {
    completeYears: complete.length,
    reconciledYears: complete.filter((r) => r.status === 'RECONCILED').length,
    ledgerIncomeCents,
    anchorCents,
    missingCents: Math.max(0, anchorCents - ledgerIncomeCents),
    capturedRatio: anchorCents === 0 ? null : ledgerIncomeCents / anchorCents,
    largestGaps: complete
      .filter((r) => r.status === 'UNDER_CAPTURED' || r.status === 'NO_LEDGER_DATA')
      .sort((a, b) => (a.varianceCents ?? 0) - (b.varianceCents ?? 0)),
  }
}
