/**
 * Externally-attested revenue by year — the filed returns and year-end P&Ls.
 *
 * Backed by `REVENUE_ANCHORS` in `lib/financials/anchors.ts` rather than a table, because that is
 * where those figures already live and the reasons given there still hold: fourteen closed-year facts
 * off filed documents, better as constants reviewable in a diff than as rows editable by accident.
 * This dataset does not re-model them; it only makes them chartable.
 *
 * **This is a different book from the ledger, and the two must never be summed.** `basis: 'summary'`
 * marks that, and because a spec names exactly one dataset there is no way to add an attested figure
 * to a ledger figure by accident. Comparing them is the job of `/admin/financials/reconciliation`,
 * which already exists and understands the grade rules below.
 *
 * The `grade` dimension is the reader's warning label, not decoration: `FLOOR` years are lower bounds
 * where no company-wide document survives, so a total across mixed grades is meaningless. `totals` for
 * this dataset should be read per grade, which is why grade is offered as a dimension and a filter.
 */
import { ANCHOR_GRADE_LABEL, REVENUE_ANCHORS } from '@/lib/financials/anchors'

import type { DatasetDef } from '../types'

export const revenueAnchorsDataset: DatasetDef = {
  id: 'revenue-anchors',
  label: 'Attested revenue (filed returns & P&Ls)',
  description:
    'Gross receipts per year as printed on a filed Schedule C or a year-end Profit & Loss. Independent of anything the ledger recorded — this is the yardstick, not a derived figure.',
  domain: 'financials',
  basis: 'summary',
  readPermission: 'financials:read',
  exportPermission: 'financials:export',
  source: { kind: 'constant', rows: () => REVENUE_ANCHORS.map((anchor) => ({ ...anchor, id: String(anchor.year) })) },
  timeAxis: { kind: 'year', field: 'year', label: 'Year' },
  measures: [
    {
      id: 'grossReceipts',
      label: 'Gross receipts',
      unit: 'cents',
      aggregation: 'sum',
      fields: ['grossReceiptsCents'],
      read: (row) => (typeof row.grossReceiptsCents === 'number' ? row.grossReceiptsCents : null),
      description:
        'Gross sales before cost of goods, on the basis the source document uses. Do not total across evidence grades — FLOOR years are lower bounds.',
    },
    { id: 'years', label: 'Years attested', unit: 'count', aggregation: 'count', fields: [], read: () => 1 },
  ],
  dimensions: [
    {
      id: 'grade',
      label: 'Evidence grade',
      field: 'grade',
      values: ['FILED', 'PL', 'PARTIAL', 'FLOOR'],
      labels: ANCHOR_GRADE_LABEL,
    },
    { id: 'basis', label: 'Basis', field: 'basis' },
    { id: 'sourceDocument', label: 'Source document', field: 'sourceDocument' },
  ],
  filters: [
    {
      id: 'grade',
      label: 'Evidence grade',
      field: 'grade',
      ops: ['eq', 'in', 'neq'],
      values: ['FILED', 'PL', 'PARTIAL', 'FLOOR'],
      labels: ANCHOR_GRADE_LABEL,
    },
  ],
  rowCap: 200,
  emptyStateNote:
    'Anchors are code constants in lib/financials/anchors.ts, one per documented year. An empty result means the filter excluded them all.',
}
