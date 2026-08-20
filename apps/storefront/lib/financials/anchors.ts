/**
 * Externally-attested revenue figures, one per year, against which the ledger is measured.
 *
 * These are not estimates and they are not derived from anything in this database. Each row is a
 * number printed on a document that was filed with a tax authority or drawn up as the company's
 * own year-end Profit & Loss. They exist here so that "is the ledger capturing the business?" has
 * an answer that does not depend on the ledger being right.
 *
 * They live in code rather than a table on purpose. There are fourteen of them, they describe
 * closed years, and a filed return does not change — so the properties that matter are that they
 * are reviewable in a diff and impossible to edit by accident, which a constant gives and a row in
 * a shared database does not. If a return is ever amended, that is a commit.
 *
 * **Grades.** The grade records how well a year is evidenced, and it is the reader's warning label:
 *
 * - `FILED`    — a filed Schedule C, line 1 (gross receipts). The strongest claim available.
 * - `PL`       — the company's own full-year P&L. Trustworthy, but never checked by anyone outside.
 * - `PARTIAL`  — a real company-wide P&L that covers only part of the year. `coverageNote` says
 *                which part. Comparing a full year of ledger rows to one of these overstates the gap.
 * - `FLOOR`    — no company-wide document survives; the figure is the sum of the channel records
 *                that do. Revenue was **certainly higher**. A ledger total above a FLOOR anchor is
 *                not an error, and reconciliation must never treat it as one.
 *
 * Figures are cents, to match `LedgerEntry.amountCents`, so a comparison is integer arithmetic and
 * cannot drift. `grossReceiptsCents` is gross sales before cost of goods, on the basis the source
 * document uses — that is what Schedule C line 1 reports and what the P&Ls call total sales.
 *
 * Established 2026-08-19 by reconciling the `Documents/` archive; the provenance of every figure is
 * in `sourceDocument`. See `reconciliation.ts` for how these are consumed.
 */

/** How well a year is evidenced. Ordered weakest to strongest for display purposes. */
export type AnchorGrade = 'FLOOR' | 'PARTIAL' | 'PL' | 'FILED'

export const ANCHOR_GRADES: readonly AnchorGrade[] = Object.freeze([
  'FLOOR',
  'PARTIAL',
  'PL',
  'FILED',
])

/** Human-readable label for each grade, for tables and tooltips. */
export const ANCHOR_GRADE_LABEL: Record<AnchorGrade, string> = Object.freeze({
  FILED: 'Filed return',
  PL: 'Company P&L',
  PARTIAL: 'Partial period',
  FLOOR: 'Documented floor',
})

/**
 * Whether a grade states the year's *whole* revenue.
 *
 * Only `FILED` and `PL` do. The other two are known-incomplete by construction, which is why the
 * gap they produce is not a defect to chase.
 */
export function isCompleteYear(grade: AnchorGrade): boolean {
  return grade === 'FILED' || grade === 'PL'
}

export type RevenueAnchor = {
  /** Calendar year the figure describes. */
  year: number
  /** Gross sales / gross receipts before cost of goods, in cents. */
  grossReceiptsCents: number
  grade: AnchorGrade
  /** The file in the `Documents/` archive this number was read out of. */
  sourceDocument: string
  /** Where in that document, e.g. the Schedule C line. */
  basis: string
  /** Set when the figure covers less than the full year, or is otherwise qualified. */
  coverageNote?: string
}

/**
 * The anchors, oldest first.
 *
 * 2011 and 2012 are deliberately absent: the only surviving records are a handful of fundraiser
 * order forms, far too thin to state a figure. An absent year is reported as "no anchor", never as
 * zero — a zero here would read as "the business earned nothing", which is a different and false
 * claim.
 */
export const REVENUE_ANCHORS: readonly RevenueAnchor[] = Object.freeze([
  {
    year: 2013,
    grossReceiptsCents: 15_499_685,
    grade: 'PL',
    sourceDocument: '02 Taxes/2013/Profit and Loss 2013 & 2014.pdf',
    basis: 'P&L total income',
  },
  {
    year: 2014,
    grossReceiptsCents: 22_111_841,
    grade: 'PL',
    sourceDocument: '01 Financial/Profit & Loss/2014 p & l.pdf',
    basis: 'P&L total income',
    coverageNote:
      'Two versions exist; income is identical to the cent in both, only the expense side was revised.',
  },
  {
    year: 2015,
    grossReceiptsCents: 28_789_600,
    grade: 'FLOOR',
    sourceDocument: '04 Shows & Events/2015/2015 Shows Sales with Drivers.xlsx',
    basis: 'Full-year show sales $224,202 + Q4 P&L non-show lines $63,694',
    coverageNote: 'Q1–Q3 fundraisers, retail, distributors and mail order are absent entirely.',
  },
  {
    year: 2016,
    grossReceiptsCents: 20_806_152,
    grade: 'FLOOR',
    sourceDocument: '04 Shows & Events/2016/2016 Shows Sales with Drivers.xlsx',
    basis: 'Full-year show sales $172,472.91 + Q1 P&L non-show lines $35,588.61',
    coverageNote: 'Q2–Q4 fundraisers, retail, distributors and mail order are absent entirely.',
  },
  {
    year: 2017,
    grossReceiptsCents: 23_786_500,
    grade: 'FLOOR',
    sourceDocument: '04 Shows & Events/2017/2017 Show Sales with Drivers.xlsx',
    basis: 'Full-year show sales only',
    coverageNote: 'Every non-show channel is absent.',
  },
  {
    year: 2018,
    grossReceiptsCents: 42_488_900,
    grade: 'PL',
    sourceDocument: '01 Financial/Profit & Loss/2018/2018 Profit and Loss.pdf',
    basis: 'P&L total sales',
    coverageNote:
      "The P&L's five channel lines sum to $421,889 against its stated total of $424,889; the stated total is used.",
  },
  {
    year: 2019,
    grossReceiptsCents: 25_719_016,
    grade: 'FLOOR',
    sourceDocument: '04 Shows & Events/2019/2019 Show Sales excluding malls.xlsx',
    basis: 'Show sales excl. malls $234,854 + BigCommerce web $22,336.16',
    coverageNote: 'Mall sales (~$31,136), fundraisers, retail and distributors are absent.',
  },
  {
    year: 2020,
    grossReceiptsCents: 23_864_506,
    grade: 'FLOOR',
    sourceDocument: '02 Taxes/Audit Docs/',
    basis:
      'Shows $75,321 + farmers markets $67,725 + retail via QuickBooks $48,718.61 + web $46,880.45',
    coverageNote: 'Fundraisers and distributors are absent.',
  },
  {
    year: 2021,
    grossReceiptsCents: 16_771_100,
    grade: 'FLOOR',
    sourceDocument: '04 Shows & Events/2021/2021 Show sales.xlsx',
    basis: 'Full-year show sales only',
    coverageNote:
      "Every non-show channel is absent. The sheet's own total is used; the archive import holds $173,438.",
  },
  {
    year: 2022,
    grossReceiptsCents: 65_972_100,
    grade: 'FILED',
    sourceDocument: '02 Taxes/2022/2022 Tax.pdf',
    basis: 'Schedule C, line 1',
    coverageNote:
      "Line 1 was illegible in the scan; recovered as gross profit $430,924 + COGS $228,797, which the document's line 3 confirms.",
  },
  {
    year: 2023,
    grossReceiptsCents: 63_983_700,
    grade: 'FILED',
    sourceDocument: '02 Taxes/2023/Michael J Zakany 2023 Tax Return.pdf',
    basis: 'Schedule C, line 1',
  },
  {
    year: 2024,
    grossReceiptsCents: 65_470_300,
    grade: 'FILED',
    sourceDocument: '02 Taxes/2024/Michael J Zakany 2024 Tax Return.pdf',
    basis: 'Schedule C, line 1',
  },
  {
    year: 2025,
    grossReceiptsCents: 61_725_400,
    grade: 'FILED',
    sourceDocument: '02 Taxes/2025/Michael J Zakany 2025 Tax Return.pdf',
    basis: 'Schedule C, line 1',
    coverageNote:
      'The company P&L for the same year reports $633,254.26; the filed figure is used. The difference is exactly $16,000.',
  },
  {
    year: 2026,
    grossReceiptsCents: 26_311_618,
    grade: 'PARTIAL',
    sourceDocument: '01 Financial/Profit & Loss/2026 Jan-June Profit and loss.xlsx',
    basis: 'P&L sales',
    coverageNote: 'January to June only. July onward is not yet closed.',
  },
])

/** The anchor for a year, or `null` when no document attests to it. */
export function anchorForYear(year: number): RevenueAnchor | null {
  return REVENUE_ANCHORS.find((a) => a.year === year) ?? null
}

/** Every year an anchor exists for, ascending. */
export function anchoredYears(): number[] {
  return REVENUE_ANCHORS.map((a) => a.year).sort((a, b) => a - b)
}

/**
 * Total attested revenue across the years whose anchor states a whole year.
 *
 * Deliberately excludes `PARTIAL` and `FLOOR` rows: adding a half-year and six lower bounds to a
 * set of full-year figures produces a number that means nothing, and that is precisely the sort of
 * total someone would otherwise quote.
 */
export function totalCompleteYearCents(): number {
  return REVENUE_ANCHORS.filter((a) => isCompleteYear(a.grade)).reduce(
    (sum, a) => sum + a.grossReceiptsCents,
    0,
  )
}
