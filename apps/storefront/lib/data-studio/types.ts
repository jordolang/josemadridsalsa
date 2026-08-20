/**
 * Shared vocabulary for the Data Studio semantic layer.
 *
 * Pure types only, and deliberately client-safe: the builder UI renders its pickers straight from
 * the dataset registry, so nothing in this file — or in `registry.ts` — may reach Prisma at value
 * level. `import type { Prisma }` is erased at compile time and is fine; a value import would drag
 * the query engine into the browser bundle.
 */

export type TimeGrain = 'day' | 'week' | 'month' | 'quarter' | 'year'

export const TIME_GRAINS: readonly TimeGrain[] = ['day', 'week', 'month', 'quarter', 'year']

export type VizType = 'line' | 'bar' | 'stacked-bar' | 'area' | 'pie' | 'table' | 'kpi'

export const VIZ_TYPES: readonly VizType[] = [
  'line',
  'bar',
  'stacked-bar',
  'area',
  'pie',
  'table',
  'kpi',
]

/**
 * How a measure's value should be read. Drives formatting, and — more importantly — whether two
 * measures may legitimately share an axis.
 *
 * `cents` is the only money unit. Every dataset converts at its own boundary, because the database
 * is not consistent: `LedgerEntry.amountCents` and `Payment.amount` are already integer cents,
 * while `Order.total`, `ArchivedShowSale.sales` and every `FeaturedEvent` money column are
 * `Decimal(10,2)` dollars, and QuickBooks reports dollars as plain JS numbers. Normalising to cents
 * once, in the dataset, is what stops two reports of the same figure from disagreeing by 100x.
 */
export type MeasureUnit = 'cents' | 'count' | 'jars' | 'miles' | 'ratio'

/**
 * Which book a figure came from.
 *
 * Figures from different bases may be shown side by side but must never be summed together. The
 * ledger's own schema comment states the invariant this protects — "each dollar is recorded from
 * exactly one source" — and the ways to break it are all live: QuickBooks already contains the
 * rows the sync pushed to it, and a filed P&L already covers periods the ledger partly covers.
 * A query naming measures from more than one basis is rejected in `schemas.ts` rather than
 * quietly producing a doubled total.
 */
export type Basis = 'ledger' | 'operational' | 'summary' | 'quickbooks'

/**
 * The time axis a dataset actually has, which is not always a timestamp.
 *
 * Three of the four domains cannot be bucketed on a `DateTime`:
 * - `ArchivedShowSale.showDate` is nullable, and `dateText` exists precisely because some source
 *   rows are ranges like "1/3-5/2025".
 * - `ArchivedFundraiser`'s only non-null date is `importedAt` — the archive import run, not the
 *   business date. Charting it would draw one spike on the day of the import instead of fifteen
 *   years of fundraising.
 * - Every `Customer.createdAt` is the migration timestamp (all 6,241 land in one month), so
 *   "new customers per month" on that column is a single bar and a lie.
 *
 * For those, the denormalised and indexed `year Int` column is the only honest axis. A `year` axis
 * offers the `year` grain alone and is driven by `years`, never `dateRange`.
 */
export type TimeAxis =
  | {
      kind: 'timestamp'
      field: string
      label: string
      grains: readonly TimeGrain[]
    }
  | {
      kind: 'year'
      field: string
      label: string
    }

export interface MeasureDef {
  id: string
  label: string
  unit: MeasureUnit
  aggregation: 'sum' | 'count' | 'avg' | 'countDistinct'
  /** Columns this measure needs selected. Empty for a plain row count. */
  fields: readonly string[]
  /**
   * Reads one selected row into a number, or `null` for "not recorded".
   *
   * Returning `null` rather than `0` is the whole point: a `Payment` with no `processorFee` yet, or
   * an `OrderItem` with no `unitCost`, is unknown — coalescing either to zero reports the sale as
   * pure profit. `aggregate.ts` keeps those rows out of the total and counts them separately.
   */
  read: (row: Record<string, unknown>) => number | null
  /**
   * True when a null in the source column means *unknown* rather than *zero*. Such measures report
   * a coverage count beside their total instead of a bare number.
   */
  nullMeansUnknown?: boolean
  description?: string
}

export interface DimensionDef {
  id: string
  label: string
  field: string
  /**
   * Known members, so a group with zero rows still appears. Omitting them for a free-text column
   * is fine; omitting them for an enum silently drops empty categories from a bar chart, which is
   * the same defect `monthly-series.ts` was written to fix for months.
   */
  values?: readonly string[]
  labels?: Readonly<Record<string, string>>
  /** Bucket label for rows whose dimension value is null. Such rows are never dropped. */
  unknownLabel?: string
}

export type FilterOp = 'eq' | 'neq' | 'in' | 'gte' | 'lte' | 'contains' | 'isNull' | 'notNull'

export interface FilterDef {
  id: string
  label: string
  field: string
  ops: readonly FilterOp[]
  values?: readonly string[]
  labels?: Readonly<Record<string, string>>
  /** Coerce a validated spec value before it reaches Prisma (e.g. numeric strings to Int). */
  coerce?: 'string' | 'number' | 'boolean'
}

export interface DatasetDef {
  id: string
  label: string
  description: string
  domain: 'financials' | 'fundraising' | 'customers' | 'operations'
  basis: Basis
  /**
   * The domain permission a caller must hold on top of `data:read`.
   *
   * A single blanket permission over a registry spanning financials, customers and orders would be
   * a privilege escalation: STAFF holds `analytics:read` but deliberately not `financials:read`, and
   * a generic query layer gated only on its own permission would hand them the ledger anyway. This
   * is re-checked server-side on every run and every export, never only by hiding a picker.
   */
  readPermission: string
  exportPermission: string
  timeAxis: TimeAxis
  measures: readonly MeasureDef[]
  dimensions: readonly DimensionDef[]
  filters: readonly FilterDef[]
  /**
   * Rows to fetch before giving up, queried as `take: rowCap + 1` so overflow is detectable.
   *
   * For an aggregated view, overflowing is an error rather than a warning: a truncated sum is a
   * wrong number wearing the costume of a right one, which is worse than a refusal.
   */
  rowCap: number
  /**
   * Where rows come from. Omitted means a Prisma table.
   *
   * `constant` exists for facts that deliberately live in code rather than a table — the filed
   * Schedule C and P&L figures in `lib/financials/anchors.ts` are closed-year facts where being
   * reviewable in a diff matters more than being queryable, and they are not re-modelled into a
   * table just to be charted.
   */
  source?: { kind: 'constant'; rows: () => Record<string, unknown>[] }
  /** Explains an empty result that is correct rather than broken. */
  emptyStateNote?: string
  /** Where a row of this dataset is edited, when the table view offers editing. */
  writeBack?: {
    endpoint: (rowId: string) => string
    permission: string
    /** Field carrying a free-text note, editable even on rows that are otherwise read-only. */
    annotateField?: string
  }
}

export interface QuerySpecFilter {
  field: string
  op: FilterOp
  value?: string | number | boolean | readonly string[] | null
}

/**
 * A validated question. `specVersion` is stamped because a saved report outlives the registry that
 * produced it, and without a version there is no way to migrate one whose measure has been renamed.
 */
export interface QuerySpec {
  specVersion: 1
  datasetId: string
  measureIds: readonly string[]
  dimensionId?: string
  timeGrain?: TimeGrain
  dateRange?: { from: string; to: string }
  years?: readonly number[]
  filters: readonly QuerySpecFilter[]
  compare?: 'none' | 'previous-period' | 'previous-year'
  sort?: { columnId: string; dir: 'asc' | 'desc' }
  limit?: number
  vizType: VizType
  /** Presentation only, persisted so a shared report reproduces exactly. The executor ignores these. */
  labelOverrides?: Readonly<Record<string, string>>
}

export type ColumnKind = 'dimension' | 'time' | 'measure'

export interface ReportColumn {
  id: string
  label: string
  kind: ColumnKind
  unit?: MeasureUnit
}

export type CellValue = string | number | null

export interface ReportRow {
  /** Stable identity for a row: dimension value plus time bucket. Anchors sorting and annotation. */
  key: string
  /** Set only when a row maps one-to-one onto a source record, which is what write-back needs. */
  sourceId?: string
  cells: Readonly<Record<string, CellValue>>
}

export interface ReportResult {
  columns: readonly ReportColumn[]
  rows: readonly ReportRow[]
  /**
   * `null` where a total would mislead — the fetch was truncated, or every input was unknown.
   * A missing number is honest; a confidently wrong one is not.
   */
  totals: Readonly<Record<string, number | null>>
  meta: {
    datasetId: string
    datasetLabel: string
    basis: Basis
    rowsScanned: number
    truncated: boolean
    /** Timezone the buckets were computed in. Printed on screen and in every export header. */
    timezone: string
    /** Rows whose value for a measure was not recorded, per measure id. Surfaced, never hidden. */
    unknownCounts: Readonly<Record<string, number>>
    generatedAt: string
  }
}
