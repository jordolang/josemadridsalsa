/**
 * The fold: selected rows in, `ReportResult` out. Pure, so it is testable without a database.
 *
 * This is the module that decides what a number means, and it exists rather than a `groupBy` in the
 * query for the reason `lib/analytics/margin-report.ts` already records: SQL aggregation would have
 * to either drop rows with a missing value — losing the revenue attached to them — or coalesce that
 * value to zero, which reports an item of unknown cost as pure profit. Neither is acceptable, so the
 * grouping happens here, where "not recorded" survives as its own outcome and is reported alongside
 * the total instead of disappearing into it.
 *
 * Two further rules follow from the same instinct:
 *
 * - Every bucket and every known dimension member is emitted, zeros included. A category with no
 *   rows must appear as zero, not vanish — a bar chart missing its empty bars misrepresents the set.
 * - A total that cannot be trusted is `null`, never a number. If the fetch was truncated, or if no
 *   row carried a known value, the honest answer is "no figure", because a confidently wrong total
 *   is worse than a missing one.
 */
import {
  UNKNOWN_BUCKET_KEY,
  bucketKeyOf,
  bucketLabel,
  bucketsBetween,
  yearBucketKey,
  yearBucketsBetween,
  UNKNOWN_BUCKET_LABEL,
} from './grain'
import type {
  CellValue,
  DatasetDef,
  MeasureDef,
  QuerySpec,
  ReportColumn,
  ReportResult,
  ReportRow,
  TimeGrain,
} from './types'
import type { CalendarDate } from '@/lib/timeclock'

export type SourceRow = Record<string, unknown>

/** How a spec is shaped, decided once so the folds below stay small. */
export type ReportMode = 'kpi' | 'series' | 'breakdown' | 'detail'

export function resolveMode(spec: QuerySpec): ReportMode {
  if (spec.timeGrain) return 'series'
  if (spec.dimensionId) return 'breakdown'
  return spec.vizType === 'table' ? 'detail' : 'kpi'
}

/** Running tally for one measure over one group. Kept separate so "unknown" never becomes zero. */
interface Tally {
  sum: number
  /** Rows that carried a usable value. */
  contributed: number
  /** Rows whose value was not recorded. */
  unknown: number
  distinct: Set<string>
}

const newTally = (): Tally => ({ sum: 0, contributed: 0, unknown: 0, distinct: new Set() })

function observe(tally: Tally, measure: MeasureDef, row: SourceRow): void {
  if (measure.aggregation === 'count') {
    tally.contributed += 1
    tally.sum += 1
    return
  }

  const value = measure.read(row)
  if (value === null || Number.isNaN(value)) {
    tally.unknown += 1
    return
  }

  tally.contributed += 1
  if (measure.aggregation === 'countDistinct') {
    tally.distinct.add(String(value))
    return
  }
  tally.sum += value
}

/**
 * Read a tally out as a cell value.
 *
 * `null` means "no figure available", and the caller renders that as a blank rather than a zero.
 * For a measure whose nulls mean *unknown*, a group where nothing was recorded reports `null`; for a
 * plain count or a measure whose nulls really do mean zero, an empty group is legitimately `0`.
 */
function readTally(tally: Tally, measure: MeasureDef): number | null {
  switch (measure.aggregation) {
    case 'count':
      return tally.sum
    case 'countDistinct':
      return tally.distinct.size
    case 'avg':
      return tally.contributed === 0 ? null : tally.sum / tally.contributed
    case 'sum':
      if (tally.contributed === 0) return measure.nullMeansUnknown ? null : 0
      return tally.sum
  }
}

function measureColumns(measures: readonly MeasureDef[]): ReportColumn[] {
  return measures.map((measure) => ({
    id: measure.id,
    label: measure.label,
    kind: 'measure' as const,
    unit: measure.unit,
  }))
}

function dimensionLabelOf(dataset: DatasetDef, spec: QuerySpec, raw: unknown): { key: string; label: string } {
  const dimension = dataset.dimensions.find((d) => d.id === spec.dimensionId)
  if (raw === null || raw === undefined || raw === '') {
    return { key: UNKNOWN_BUCKET_KEY, label: dimension?.unknownLabel ?? UNKNOWN_BUCKET_LABEL }
  }
  const key = String(raw)
  return { key, label: dimension?.labels?.[key] ?? key }
}

export interface AggregateInput {
  dataset: DatasetDef
  spec: QuerySpec
  rows: SourceRow[]
  /** True when the fetch hit `rowCap`, which invalidates every aggregate total. */
  truncated: boolean
  /** Bounds of a timestamp range, so empty buckets can be emitted across the whole window. */
  window?: { from: CalendarDate; to: CalendarDate }
  /** Bounds for a year axis, same purpose. */
  yearWindow?: { from: number; to: number }
  timezone: string
  generatedAt: string
}

export function aggregate(input: AggregateInput): ReportResult {
  const { dataset, spec, rows, truncated } = input
  const measures = spec.measureIds
    .map((id) => dataset.measures.find((m) => m.id === id))
    .filter((m): m is MeasureDef => Boolean(m))

  const mode = resolveMode(spec)

  // Overall tallies, used for totals and for the KPI mode, always over every scanned row.
  const overall = new Map<string, Tally>()
  for (const measure of measures) overall.set(measure.id, newTally())
  for (const row of rows) {
    for (const measure of measures) observe(overall.get(measure.id)!, measure, row)
  }

  const unknownCounts: Record<string, number> = {}
  for (const measure of measures) unknownCounts[measure.id] = overall.get(measure.id)!.unknown

  const totals: Record<string, number | null> = {}
  for (const measure of measures) {
    // A truncated scan makes every total wrong by an unknown amount, so it is withheld outright.
    totals[measure.id] = truncated ? null : readTally(overall.get(measure.id)!, measure)
  }

  const meta: ReportResult['meta'] = {
    datasetId: dataset.id,
    datasetLabel: dataset.label,
    basis: dataset.basis,
    rowsScanned: rows.length,
    truncated,
    timezone: input.timezone,
    unknownCounts,
    generatedAt: input.generatedAt,
  }

  if (mode === 'kpi') {
    const cells: Record<string, CellValue> = {}
    for (const measure of measures) cells[measure.id] = totals[measure.id]
    return { columns: measureColumns(measures), rows: [{ key: 'total', cells }], totals, meta }
  }

  if (mode === 'detail') {
    return foldDetail(dataset, spec, rows, measures, totals, meta)
  }

  if (mode === 'breakdown') {
    return foldBreakdown(dataset, spec, rows, measures, totals, meta)
  }

  return foldSeries(input, measures, totals, meta)
}

/** Raw rows, one per source record — the only mode that can carry a `sourceId` for write-back. */
function foldDetail(
  dataset: DatasetDef,
  spec: QuerySpec,
  rows: SourceRow[],
  measures: readonly MeasureDef[],
  totals: Record<string, number | null>,
  meta: ReportResult['meta']
): ReportResult {
  const dimension = dataset.dimensions.find((d) => d.id === spec.dimensionId)
  const columns: ReportColumn[] = []
  if (dimension) {
    columns.push({ id: dimension.id, label: dimension.label, kind: 'dimension' })
  }
  columns.push(...measureColumns(measures))

  const out: ReportRow[] = rows.map((row, index) => {
    const cells: Record<string, CellValue> = {}
    if (dimension) {
      cells[dimension.id] = dimensionLabelOf(dataset, spec, row[dimension.field]).label
    }
    for (const measure of measures) {
      const tally = newTally()
      observe(tally, measure, row)
      cells[measure.id] = readTally(tally, measure)
    }
    const id = typeof row.id === 'string' ? row.id : undefined
    return { key: id ?? `row-${index}`, sourceId: id, cells }
  })

  return { columns, rows: out, totals, meta }
}

/** One row per dimension member, with every known member present even at zero. */
function foldBreakdown(
  dataset: DatasetDef,
  spec: QuerySpec,
  rows: SourceRow[],
  measures: readonly MeasureDef[],
  totals: Record<string, number | null>,
  meta: ReportResult['meta']
): ReportResult {
  const dimension = dataset.dimensions.find((d) => d.id === spec.dimensionId)
  if (!dimension) {
    return { columns: measureColumns(measures), rows: [], totals, meta }
  }

  const groups = new Map<string, { label: string; tallies: Map<string, Tally> }>()
  const ensure = (key: string, label: string) => {
    let group = groups.get(key)
    if (!group) {
      group = { label, tallies: new Map(measures.map((m) => [m.id, newTally()])) }
      groups.set(key, group)
    }
    return group
  }

  // Seed the known members first, so an enum value with no rows is still charted as zero.
  for (const value of dimension.values ?? []) {
    ensure(value, dimension.labels?.[value] ?? value)
  }

  for (const row of rows) {
    const { key, label } = dimensionLabelOf(dataset, spec, row[dimension.field])
    const group = ensure(key, label)
    for (const measure of measures) observe(group.tallies.get(measure.id)!, measure, row)
  }

  const columns: ReportColumn[] = [
    { id: dimension.id, label: dimension.label, kind: 'dimension' },
    ...measureColumns(measures),
  ]

  const out: ReportRow[] = [...groups.entries()].map(([key, group]) => {
    const cells: Record<string, CellValue> = { [dimension.id]: group.label }
    for (const measure of measures) cells[measure.id] = readTally(group.tallies.get(measure.id)!, measure)
    return { key, cells }
  })

  sortRows(out, spec, measures, dimension.id)
  return { columns, rows: applyLimit(out, spec), totals, meta }
}

/**
 * One row per time bucket.
 *
 * With a dimension also selected, each dimension member becomes its own column — the shape a
 * multi-line or stacked-bar chart needs. Exactly one measure is permitted in that case, enforced in
 * `schemas.ts`, because a grid of measure×member columns is unreadable rather than informative.
 */
function foldSeries(
  input: AggregateInput,
  measures: readonly MeasureDef[],
  totals: Record<string, number | null>,
  meta: ReportResult['meta']
): ReportResult {
  const { dataset, spec, rows } = input
  const grain: TimeGrain = spec.timeGrain ?? 'year'
  const axis = dataset.timeAxis
  const dimension = dataset.dimensions.find((d) => d.id === spec.dimensionId)

  const keyOf = (row: SourceRow): string =>
    axis.kind === 'year'
      ? yearBucketKey(typeof row[axis.field] === 'number' ? (row[axis.field] as number) : null)
      : bucketKeyOf(row[axis.field] as Date | null | undefined, grain)

  // Pre-seed the full window so a period with no rows renders as zero instead of being skipped.
  const seeded =
    axis.kind === 'year'
      ? input.yearWindow
        ? yearBucketsBetween(input.yearWindow.from, input.yearWindow.to)
        : []
      : input.window
        ? bucketsBetween(input.window.from, input.window.to, grain)
        : []

  const buckets = new Map<string, { label: string; tallies: Map<string, Tally> }>()
  const seriesKeys = new Set<string>()

  const seriesIdsFor = (): string[] =>
    dimension ? [...seriesKeys] : measures.map((m) => m.id)

  const ensureBucket = (key: string, label: string) => {
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = { label, tallies: new Map() }
      buckets.set(key, bucket)
    }
    return bucket
  }
  const ensureTally = (bucketKey: string, label: string, seriesId: string) => {
    const bucket = ensureBucket(bucketKey, label)
    let tally = bucket.tallies.get(seriesId)
    if (!tally) {
      tally = newTally()
      bucket.tallies.set(seriesId, tally)
    }
    return tally
  }

  for (const bucket of seeded) ensureBucket(bucket.key, bucket.label)

  for (const row of rows) {
    const key = keyOf(row)
    const label = key === UNKNOWN_BUCKET_KEY ? UNKNOWN_BUCKET_LABEL : bucketLabel(key, grain)
    if (dimension) {
      const series = dimensionLabelOf(dataset, spec, row[dimension.field])
      seriesKeys.add(series.key)
      const measure = measures[0]
      if (measure) observe(ensureTally(key, label, series.key), measure, row)
    } else {
      for (const measure of measures) observe(ensureTally(key, label, measure.id), measure, row)
    }
  }

  const primary = measures[0]
  const columns: ReportColumn[] = [{ id: '__time', label: axis.label, kind: 'time' }]
  if (dimension) {
    for (const key of seriesIdsFor()) {
      columns.push({
        id: key,
        label: dimension.labels?.[key] ?? (key === UNKNOWN_BUCKET_KEY ? UNKNOWN_BUCKET_LABEL : key),
        kind: 'measure',
        unit: primary?.unit,
      })
    }
  } else {
    columns.push(...measureColumns(measures))
  }

  const seriesIds = seriesIdsFor()
  const out: ReportRow[] = [...buckets.entries()]
    // Unknown sorts last: it is not a point on the timeline, so it must not distort the axis order.
    .sort(([a], [b]) => {
      if (a === UNKNOWN_BUCKET_KEY) return 1
      if (b === UNKNOWN_BUCKET_KEY) return -1
      return a < b ? -1 : a > b ? 1 : 0
    })
    .map(([key, bucket]) => {
      const cells: Record<string, CellValue> = { __time: bucket.label }
      for (const seriesId of seriesIds) {
        const measure = dimension ? primary : measures.find((m) => m.id === seriesId)
        const tally = bucket.tallies.get(seriesId)
        cells[seriesId] = measure ? readTally(tally ?? newTally(), measure) : null
      }
      return { key, cells }
    })

  return { columns, rows: out, totals, meta }
}

function sortRows(
  rows: ReportRow[],
  spec: QuerySpec,
  measures: readonly MeasureDef[],
  dimensionId: string
): void {
  const columnId = spec.sort?.columnId ?? measures[0]?.id ?? dimensionId
  const dir = spec.sort?.dir ?? 'desc'

  rows.sort((a, b) => {
    const left = a.cells[columnId]
    const right = b.cells[columnId]
    // Rows with no figure sit at the bottom regardless of direction, so a blank never reads as a low
    // value that happens to sort first.
    if (left === null && right === null) return 0
    if (left === null) return 1
    if (right === null) return -1
    if (typeof left === 'number' && typeof right === 'number') {
      return dir === 'asc' ? left - right : right - left
    }
    const comparison = String(left).localeCompare(String(right))
    return dir === 'asc' ? comparison : -comparison
  })
}

function applyLimit(rows: ReportRow[], spec: QuerySpec): ReportRow[] {
  return spec.limit && spec.limit > 0 ? rows.slice(0, spec.limit) : rows
}
