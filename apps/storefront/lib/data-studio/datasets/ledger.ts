/**
 * The bookkeeping ledger as a Data Studio dataset.
 *
 * `LedgerEntry` is the closest thing the database has to a fact table: one row per money movement,
 * an integer-cents measure, an indexed date, and five categorical columns. It is therefore the
 * dataset the financial charts are built on.
 *
 * Direction is derived from the category via `CATEGORY_DIRECTION` rather than read from the stored
 * `direction` column. That mirrors what `summariseLedger` already does, and for the same reason: the
 * two cannot then disagree. A row whose stored direction drifted from its category would otherwise
 * total differently here than on the ledger page.
 *
 * The vocabulary — categories, labels, sources — is imported from `lib/financials/ledger.ts` rather
 * than restated, so a new category appears in the builder without a second edit.
 */
import {
  CATEGORY_DIRECTION,
  LEDGER_CATEGORY_LABELS,
  LEDGER_CATEGORY_VALUES,
  LEDGER_SOURCE_VALUES,
} from '@/lib/financials/ledger'
import type { LedgerCategory } from '@prisma/client'

import type { DatasetDef, MeasureDef } from '../types'

const SALES_CHANNEL_VALUES = [
  'WEBSITE',
  'POS',
  'FUNDRAISER',
  'WHOLESALE',
  'EVENT',
  'MANUAL',
  'MARKETPLACE',
  'PHONE',
  'IMPORT',
] as const

const LEDGER_SOURCE_LABELS: Record<string, string> = {
  ORDER: 'Online order',
  REFUND: 'Refund',
  SHOW_ARCHIVE: 'Archived show',
  FUNDRAISER: 'Fundraiser',
  MANUAL: 'Hand entered',
  IMPORT: 'Statement import',
}

const centsOf = (row: Record<string, unknown>): number =>
  typeof row.amountCents === 'number' ? row.amountCents : 0

const directionOf = (row: Record<string, unknown>): 'INCOME' | 'EXPENSE' | null => {
  const category = row.category
  if (typeof category !== 'string') return null
  return CATEGORY_DIRECTION[category as LedgerCategory] ?? null
}

/**
 * Amounts are stored positive with the direction carrying the sign, so each side is its own measure
 * and a row on the other side contributes a real zero — not an unknown. `nullMeansUnknown` is off
 * throughout: every ledger row has an amount by construction (`amountCents` is non-null), so a blank
 * here would mean a bug rather than a gap in the records, and claiming otherwise would put a
 * misleading coverage figure on every financial report.
 */
const measures: readonly MeasureDef[] = [
  {
    id: 'income',
    label: 'Income',
    unit: 'cents',
    aggregation: 'sum',
    fields: ['amountCents', 'category'],
    read: (row) => (directionOf(row) === 'INCOME' ? centsOf(row) : 0),
    description: 'Money in, by category. Contra items (refunds, discounts) are excluded.',
  },
  {
    id: 'expense',
    label: 'Expense',
    unit: 'cents',
    aggregation: 'sum',
    fields: ['amountCents', 'category'],
    read: (row) => (directionOf(row) === 'EXPENSE' ? centsOf(row) : 0),
    description: 'Money out, including contra items such as refunds and discounts.',
  },
  {
    id: 'net',
    label: 'Net',
    unit: 'cents',
    aggregation: 'sum',
    fields: ['amountCents', 'category'],
    read: (row) => (directionOf(row) === 'EXPENSE' ? -centsOf(row) : centsOf(row)),
    description: 'Income minus expense.',
  },
  {
    id: 'amount',
    label: 'Amount (unsigned)',
    unit: 'cents',
    aggregation: 'sum',
    fields: ['amountCents'],
    read: centsOf,
    description: 'Raw amounts regardless of side. Useful with a direction breakdown.',
  },
  {
    id: 'entries',
    label: 'Entry count',
    unit: 'count',
    aggregation: 'count',
    fields: [],
    read: () => 1,
  },
  {
    id: 'averageEntry',
    label: 'Average entry',
    unit: 'cents',
    aggregation: 'avg',
    fields: ['amountCents'],
    read: centsOf,
  },
]

export const ledgerDataset: DatasetDef = {
  id: 'ledger',
  label: 'Bookkeeping ledger',
  description:
    'Every recorded money movement — online orders, refunds, archived show takings, hand-entered rows and imported statement lines — in one place.',
  domain: 'financials',
  basis: 'ledger',
  readPermission: 'financials:read',
  exportPermission: 'financials:export',
  timeAxis: {
    kind: 'timestamp',
    field: 'date',
    label: 'Accounting date',
    grains: ['day', 'week', 'month', 'quarter', 'year'],
  },
  measures,
  dimensions: [
    {
      id: 'category',
      label: 'Category',
      field: 'category',
      values: LEDGER_CATEGORY_VALUES,
      labels: LEDGER_CATEGORY_LABELS,
    },
    {
      id: 'direction',
      label: 'Direction',
      field: 'direction',
      values: ['INCOME', 'EXPENSE'],
      labels: { INCOME: 'Income', EXPENSE: 'Expense' },
    },
    {
      id: 'source',
      label: 'Source',
      field: 'source',
      values: LEDGER_SOURCE_VALUES,
      labels: LEDGER_SOURCE_LABELS,
    },
    {
      id: 'channel',
      label: 'Sales channel',
      field: 'channel',
      values: SALES_CHANNEL_VALUES,
      unknownLabel: 'No channel',
    },
    {
      id: 'paymentMethod',
      label: 'Payment method',
      field: 'paymentMethod',
      unknownLabel: 'Not recorded',
    },
    {
      id: 'counterparty',
      label: 'Customer / vendor',
      field: 'counterparty',
      unknownLabel: 'Not recorded',
    },
  ],
  filters: [
    {
      id: 'category',
      label: 'Category',
      field: 'category',
      ops: ['eq', 'in', 'neq'],
      values: LEDGER_CATEGORY_VALUES,
      labels: LEDGER_CATEGORY_LABELS,
    },
    {
      id: 'direction',
      label: 'Direction',
      field: 'direction',
      ops: ['eq'],
      values: ['INCOME', 'EXPENSE'],
      labels: { INCOME: 'Income', EXPENSE: 'Expense' },
    },
    {
      id: 'source',
      label: 'Source',
      field: 'source',
      ops: ['eq', 'in', 'neq'],
      values: LEDGER_SOURCE_VALUES,
      labels: LEDGER_SOURCE_LABELS,
    },
    {
      id: 'channel',
      label: 'Sales channel',
      field: 'channel',
      ops: ['eq', 'in', 'isNull', 'notNull'],
      values: SALES_CHANNEL_VALUES,
    },
    {
      id: 'isManual',
      label: 'Hand entered',
      field: 'isManual',
      ops: ['eq'],
      values: ['true', 'false'],
      labels: { true: 'Hand entered only', false: 'Derived only' },
      coerce: 'boolean',
    },
    { id: 'counterparty', label: 'Customer / vendor', field: 'counterparty', ops: ['contains'] },
    { id: 'description', label: 'Description', field: 'description', ops: ['contains'] },
  ],
  // The whole table is a few hundred rows today and would be a few tens of thousands after years of
  // orders. The cap exists to bound the failure, not because it is expected to be reached.
  rowCap: 50_000,
  emptyStateNote:
    'The ledger is derived from settled orders, refunds and archived show sales. If it looks empty, run `npm run ledger:backfill` — and note that filed P&L and Schedule C figures live in Financial summaries, not here.',
  writeBack: {
    endpoint: (rowId) => `/api/admin/financials/ledger/${rowId}`,
    permission: 'financials:write',
    // Derived rows are regenerated by the backfill, so only their note is editable. The existing
    // endpoint enforces that; this field tells the grid which cell to offer.
    annotateField: 'memo',
  },
}
