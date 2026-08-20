/**
 * Server half of the Data Studio: a validated spec in, a `ReportResult` out.
 *
 * Three responsibilities, in order:
 *
 * 1. **Authorise.** Every dataset carries the domain permission it belongs to, and it is checked
 *    here — on every run and every export, not only where a picker is hidden. Without this, a single
 *    `data:read` grant would be a universal read: STAFF holds `analytics:read` but deliberately not
 *    `financials:read`, and a generic query layer gated only on its own permission would hand them
 *    the ledger anyway.
 * 2. **Select.** A narrow `findMany` of exactly the columns the spec needs, capped at `rowCap + 1` so
 *    overflow is detectable. There is no `groupBy` and no `_sum` — see `aggregate.ts` for why a
 *    missing value must survive the fold rather than be summed away.
 * 3. **Fold.** Hand the rows to the pure aggregator.
 *
 * Field names reaching Prisma are only ever the ones a `DatasetDef` declares, because `schemas.ts`
 * rejects anything else first. Nothing here interpolates a caller-supplied string into a query.
 */
import type { Prisma, UserRole } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/rbac'
import type { CalendarDate } from '@/lib/timeclock'

import { aggregate, type SourceRow } from './aggregate'
import { BUSINESS_TIMEZONE, parseIsoDate, rangeBounds } from './grain'
import { getDataset } from './registry'
import type { DatasetDef, QuerySpec, QuerySpecFilter, ReportResult } from './types'

export type ExecuteOutcome =
  | { ok: true; result: ReportResult }
  | { ok: false; status: 403 | 404 | 400 | 500; message: string }

/** Minimal shape the executor needs from a session user, so tests need not build a whole User. */
export interface ExecutingUser {
  id: string
  role: UserRole
}

type FindManyArgs = {
  where: Prisma.LedgerEntryWhereInput | Record<string, unknown>
  select: Record<string, true>
  take: number
  orderBy?: Record<string, 'asc' | 'desc'>
}

/**
 * Which table answers each dataset.
 *
 * Written as an explicit switch rather than `prisma[dataset.model]` so the type checker verifies each
 * delegate exists. A dynamic lookup would compile with a typo and fail at runtime.
 */
async function loadRows(datasetId: string, args: FindManyArgs): Promise<SourceRow[]> {
  switch (datasetId) {
    case 'ledger':
      return prisma.ledgerEntry.findMany(args as Prisma.LedgerEntryFindManyArgs) as Promise<SourceRow[]>
    case 'archived-fundraisers':
      return prisma.archivedFundraiser.findMany(
        args as Prisma.ArchivedFundraiserFindManyArgs
      ) as Promise<SourceRow[]>
    case 'mileage':
      return prisma.mileageEntry.findMany(args as Prisma.MileageEntryFindManyArgs) as Promise<SourceRow[]>
    default:
      throw new Error(`No loader registered for dataset "${datasetId}"`)
  }
}

/** Columns to fetch: the time axis, every measure's inputs, the dimension, and the row id. */
function buildSelect(dataset: DatasetDef, spec: QuerySpec): Record<string, true> {
  const select: Record<string, true> = { id: true, [dataset.timeAxis.field]: true }

  for (const id of spec.measureIds) {
    const measure = dataset.measures.find((m) => m.id === id)
    for (const field of measure?.fields ?? []) select[field] = true
  }

  if (spec.dimensionId) {
    const dimension = dataset.dimensions.find((d) => d.id === spec.dimensionId)
    if (dimension) select[dimension.field] = true
  }

  // A detail table shows the row itself, so include the columns a reader needs to recognise it.
  if (spec.vizType === 'table' && !spec.timeGrain && !spec.dimensionId) {
    if (dataset.writeBack?.annotateField) select[dataset.writeBack.annotateField] = true
    for (const dimension of dataset.dimensions) select[dimension.field] = true
  }

  return select
}

function coerce(value: unknown, kind: 'string' | 'number' | 'boolean' | undefined): unknown {
  switch (kind) {
    case 'number':
      return typeof value === 'number' ? value : Number(value)
    case 'boolean':
      return value === true || value === 'true'
    default:
      return value
  }
}

function filterClause(dataset: DatasetDef, filter: QuerySpecFilter): Record<string, unknown> | null {
  const definition = dataset.filters.find((f) => f.field === filter.field || f.id === filter.field)
  if (!definition) return null

  const field = definition.field
  const value = coerce(filter.value, definition.coerce)

  switch (filter.op) {
    case 'eq':
      return { [field]: value }
    case 'neq':
      return { [field]: { not: value } }
    case 'in':
      return { [field]: { in: Array.isArray(filter.value) ? filter.value : [value] } }
    case 'gte':
      return { [field]: { gte: value } }
    case 'lte':
      return { [field]: { lte: value } }
    case 'contains':
      return { [field]: { contains: String(value ?? ''), mode: 'insensitive' } }
    case 'isNull':
      return { [field]: null }
    case 'notNull':
      return { [field]: { not: null } }
  }
}

/**
 * Apply a validated filter set to rows held in code.
 *
 * Only reached for `source.kind === 'constant'` datasets, which cannot be queried. The operators are
 * the same declarative `FilterDef`s the Prisma path uses, deliberately translated in this one file so
 * the two readings of "category equals X" cannot drift apart.
 */
function matchesFilters(dataset: DatasetDef, spec: QuerySpec, row: SourceRow): boolean {
  for (const filter of spec.filters) {
    const definition = dataset.filters.find((f) => f.field === filter.field || f.id === filter.field)
    if (!definition) continue

    const actual = row[definition.field]
    const expected = coerce(filter.value, definition.coerce)

    switch (filter.op) {
      case 'eq':
        if (actual !== expected) return false
        break
      case 'neq':
        if (actual === expected) return false
        break
      case 'in': {
        const list = (Array.isArray(filter.value) ? filter.value : [expected]).map(String)
        if (!list.includes(String(actual))) return false
        break
      }
      case 'gte':
        if (!(Number(actual) >= Number(expected))) return false
        break
      case 'lte':
        if (!(Number(actual) <= Number(expected))) return false
        break
      case 'contains':
        if (!String(actual ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase())) return false
        break
      case 'isNull':
        if (actual !== null && actual !== undefined) return false
        break
      case 'notNull':
        if (actual === null || actual === undefined) return false
        break
    }
  }
  return true
}

interface Windows {
  window?: { from: CalendarDate; to: CalendarDate }
  yearWindow?: { from: number; to: number }
}

function buildWhere(dataset: DatasetDef, spec: QuerySpec): { where: Record<string, unknown> } & Windows {
  const and: Record<string, unknown>[] = []
  const axis = dataset.timeAxis
  const windows: Windows = {}

  for (const filter of spec.filters) {
    const clause = filterClause(dataset, filter)
    if (clause) and.push(clause)
  }

  if (axis.kind === 'year') {
    if (spec.years && spec.years.length > 0) {
      and.push({ [axis.field]: { in: [...spec.years] } })
      windows.yearWindow = { from: Math.min(...spec.years), to: Math.max(...spec.years) }
    }
  } else if (spec.dateRange) {
    const from = parseIsoDate(spec.dateRange.from)
    const to = parseIsoDate(spec.dateRange.to)
    if (from && to) {
      const { start, end } = rangeBounds(from, to)
      and.push({ [axis.field]: { gte: start, lte: end } })
      windows.window = { from, to }
    }
  } else if (spec.years && spec.years.length > 0) {
    // Years against a timestamp axis: one bounded range per year, OR'd, so a gap year is genuinely
    // excluded rather than swept in by a min-to-max span.
    const ranges = [...spec.years].sort().map((year) => {
      const { start, end } = rangeBounds({ year, month: 1, day: 1 }, { year, month: 12, day: 31 })
      return { [axis.field]: { gte: start, lte: end } }
    })
    and.push({ OR: ranges })
  }

  return { where: and.length === 0 ? {} : { AND: and }, ...windows }
}

/** When no range was asked for, seed buckets from the data's own extent so the axis has no gaps. */
function windowFromRows(rows: SourceRow[], field: string): Windows['window'] {
  let min: Date | null = null
  let max: Date | null = null
  for (const row of rows) {
    const value = row[field]
    if (!(value instanceof Date)) continue
    if (!min || value < min) min = value
    if (!max || value > max) max = value
  }
  if (!min || !max) return undefined

  const toCalendar = (date: Date): CalendarDate => ({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  })
  return { from: toCalendar(min), to: toCalendar(max) }
}

function yearWindowFromRows(rows: SourceRow[], field: string): Windows['yearWindow'] {
  const years = rows
    .map((row) => row[field])
    .filter((value): value is number => typeof value === 'number')
  if (years.length === 0) return undefined
  return { from: Math.min(...years), to: Math.max(...years) }
}

/**
 * Run a validated spec.
 *
 * `spec` must already have been through `parseQuerySpec` — this function trusts its field names, and
 * that trust is only sound because the schema checked them against the registry.
 */
export async function runReport(user: ExecutingUser, spec: QuerySpec): Promise<ExecuteOutcome> {
  const dataset = getDataset(spec.datasetId)
  if (!dataset) return { ok: false, status: 404, message: 'Unknown dataset' }

  if (!(await hasPermission(user, dataset.readPermission))) {
    return {
      ok: false,
      status: 403,
      message: `You do not have permission to read ${dataset.label}.`,
    }
  }

  const { where, window, yearWindow } = buildWhere(dataset, spec)
  const select = buildSelect(dataset, spec)

  try {
    const rows = dataset.source?.kind === 'constant'
      ? dataset.source
          .rows()
          .filter((row) => matchesFilters(dataset, spec, row))
          .filter((row) => {
            // The year window is part of the `where` on the Prisma path; applied here instead.
            if (dataset.timeAxis.kind !== 'year' || !spec.years || spec.years.length === 0) return true
            const value = row[dataset.timeAxis.field]
            return typeof value === 'number' && spec.years.includes(value)
          })
      : await loadRows(spec.datasetId, {
      where,
      select,
      // One more than the cap, so hitting it is distinguishable from happening to have exactly that
      // many rows.
      take: dataset.rowCap + 1,
      orderBy: { [dataset.timeAxis.field]: 'asc' },
    })

    const truncated = rows.length > dataset.rowCap
    const kept = truncated ? rows.slice(0, dataset.rowCap) : rows

    const result = aggregate({
      dataset,
      spec,
      rows: kept,
      truncated,
      window: window ?? (dataset.timeAxis.kind === 'timestamp' ? windowFromRows(kept, dataset.timeAxis.field) : undefined),
      yearWindow:
        yearWindow ?? (dataset.timeAxis.kind === 'year' ? yearWindowFromRows(kept, dataset.timeAxis.field) : undefined),
      timezone: BUSINESS_TIMEZONE,
      generatedAt: new Date().toISOString(),
    })

    return { ok: true, result }
  } catch (error) {
    console.error('[data-studio] runReport failed', { datasetId: spec.datasetId, error })
    return { ok: false, status: 500, message: 'The report could not be run.' }
  }
}
