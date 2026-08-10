/**
 * Normalizes the raw mileage rows produced by `scripts/extract-mileage.py` into
 * one canonical shape, and de-duplicates the heavily overlapping source files.
 *
 * The archive's mileage spreadsheets use four different column layouts:
 *   - `Date, Location, Miles, Driver, Sales`            (the "sorted by" views)
 *   - `Start, End, Vendor, City, St, Miles, Driver`     (the yearly Masters)
 *   - `Date, Start, End, Miles, Reason`                 (odometer-kept sheets)
 *   - `Date Start, Date End, Vendor, City, State, Driver, Mileage, One way`
 *
 * The tricky part is `Start`/`End`: in the Master layout they are the trip's
 * start/end *dates*, but in the odometer layout (which also has a `Date` column)
 * they are odometer *readings*. That disambiguation, driver-name canonicalization,
 * subtotal-row rejection, and dedup are all pure and unit-tested here so the
 * import script stays a thin database writer.
 */

import { createHash } from 'node:crypto'

export type MileageCategory =
  | 'SHOW'
  | 'FARMERS_MARKET'
  | 'FUNDRAISER'
  | 'VENDOR'
  | 'ERRAND'
  | 'MISC'

/** A single row as emitted by the Python extractor. */
export interface RawMileageRow {
  sourceFile: string
  sourceMd5: string
  sourceSheet: string | null
  sourceRow: number | null
  header: string[]
  cells: Record<string, string | number | boolean | null>
}

/** A normalized trip, ready to write to the `MileageEntry` table. */
export interface NormalizedMileageEntry {
  tripDate: string // ISO date (YYYY-MM-DD)
  endDate: string | null
  destination: string
  city: string | null
  state: string | null
  miles: number | null
  oneWayMiles: number | null
  odometerStart: number | null
  odometerEnd: number | null
  driver: string | null
  sales: number | null
  category: MileageCategory | null
  year: number
  sourceFile: string
  sourceMd5: string
  sourceSheet: string | null
  sourceRow: number | null
  rawRow: Record<string, string | number | boolean | null>
  contentHash: string
}

export type SkipReason = 'no-date' | 'no-destination' | 'subtotal-row'

type Cell = string | number | boolean | null | undefined

/** Case-insensitive lookup that tolerates the trailing-space header variants. */
function pick(cells: Record<string, Cell>, ...names: string[]): Cell {
  const normalized = new Map<string, Cell>()
  for (const [k, v] of Object.entries(cells)) {
    normalized.set(k.trim().toLowerCase(), v)
  }
  for (const name of names) {
    const hit = normalized.get(name.trim().toLowerCase())
    if (hit !== undefined && hit !== null && String(hit).trim() !== '') return hit
  }
  return null
}

function str(v: Cell): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

/** Parse an ISO-ish date cell to `YYYY-MM-DD`, or null if not a date. */
export function parseDateCell(v: Cell): string | null {
  const s = str(v)
  if (!s) return null
  // The extractor serializes real dates as ISO 8601; a bare number (odometer)
  // or free text must not be read as a date.
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ]|$)/.exec(s)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  return null
}

/** Parse a numeric cell (miles, odometer, sales), tolerating "1,699" and "$". */
export function parseNumberCell(v: Cell): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v)
    .replace(/[$,]/g, '')
    .replace(/[^0-9.\-]/g, '')
    .trim()
  if (s === '' || s === '-' || s === '.') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const DRIVER_ALIASES: Record<string, string> = {
  deb: 'Debbie',
  debbie: 'Debbie',
  debby: 'Debbie',
  debbi: 'Debbie',
  debrah: 'Debbie',
  deborah: 'Debbie',
  matt: 'Matt',
  matthew: 'Matt',
  mike: 'Mike',
  michael: 'Mike',
  mindy: 'Mindy',
  chrissy: 'Chrissy',
  crissy: 'Chrissy',
}

/** Canonicalize a driver name; "?", "N/A", and blanks become null. */
export function canonicalizeDriver(v: Cell): string | null {
  const s = str(v)
  if (!s) return null
  const key = s.toLowerCase().replace(/[.\s]+$/g, '').trim()
  if (key === '' || key === '?' || key === 'n/a' || key === 'na') return null
  if (DRIVER_ALIASES[key]) return DRIVER_ALIASES[key]
  // Unknown but real value: keep it title-cased rather than invent a mapping.
  return s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
}

/** Best-effort trip type from the destination text and the source file name. */
export function detectCategory(
  destination: string,
  sourceFile: string
): MileageCategory | null {
  const d = destination.toLowerCase()
  const f = sourceFile.toLowerCase()
  if (/\bfr\b|fr-|fundrais/.test(d)) return 'FUNDRAISER'
  if (/farmers?\s*market/.test(d) || /farmers market/.test(f)) return 'FARMERS_MARKET'
  if (
    /home\s*(show|and garden|& garden)|expo|festival|\bfest\b|octoberfest|craft|market district|\bshow\b/.test(
      d
    ) ||
    /\bshows?\b/.test(f)
  ) {
    return 'SHOW'
  }
  if (
    /restaurant depot|\bdepot\b|card purchase|yoders|sam'?s|costco|gordon|post office|usps|bank|fedex|ups store/.test(
      d
    )
  ) {
    return 'VENDOR'
  }
  return null
}

/** Stable hash of the identifying fields, used to collapse re-exported dupes. */
export function computeContentHash(
  e: Pick<
    NormalizedMileageEntry,
    'tripDate' | 'destination' | 'city' | 'driver' | 'miles'
  >
): string {
  const norm = (s: string | null) =>
    (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
  const key = [
    e.tripDate,
    norm(e.destination),
    norm(e.city),
    norm(e.driver),
    e.miles ?? '',
  ].join('|')
  return createHash('sha256').update(key).digest('hex').slice(0, 32)
}

/**
 * Turn one raw row into a normalized entry, or return why it was skipped.
 * A valid trip needs a resolvable date and a destination; anything else
 * (blank rows, "? Total" subtotals) is rejected.
 */
export function normalizeMileageRow(
  raw: RawMileageRow
): { entry: NormalizedMileageEntry } | { skip: SkipReason } {
  const cells = raw.cells

  const destination = str(pick(cells, 'Vendor', 'Show', 'Location', 'Reason'))
  const driver = canonicalizeDriver(pick(cells, 'Driver'))

  // Subtotal/total rows carry a "... Total" label in the driver column and no
  // destination — reject them before anything else.
  const driverRaw = str(pick(cells, 'Driver'))
  if (driverRaw && /total/i.test(driverRaw) && !destination) {
    return { skip: 'subtotal-row' }
  }

  // Date: prefer the explicit date columns; fall back to `Start` only when it
  // holds a date (Master layout) rather than an odometer reading.
  const startCell = pick(cells, 'Start')
  const endCell = pick(cells, 'End')
  const startIsDate = parseDateCell(startCell) !== null
  const tripDate =
    parseDateCell(pick(cells, 'Date Start', 'Date')) ??
    (startIsDate ? parseDateCell(startCell) : null)

  if (!tripDate) return { skip: 'no-date' }
  if (!destination) return { skip: 'no-destination' }

  // `Start`/`End` are odometer readings only when they are numeric AND a real
  // date came from a different column. When `Start` itself supplied the date,
  // `End` is the trip's end date.
  const startIsOdometer = !startIsDate && parseNumberCell(startCell) !== null
  const odometerStart = startIsOdometer ? parseNumberCell(startCell) : null
  const odometerEnd = startIsOdometer ? parseNumberCell(endCell) : null

  const endDate =
    parseDateCell(pick(cells, 'Date End')) ??
    (startIsDate ? parseDateCell(endCell) : null)

  const miles = parseNumberCell(pick(cells, 'Miles', 'Mileage'))
  const oneWayMiles = parseNumberCell(pick(cells, 'One way', 'Oneway'))
  const sales = parseNumberCell(pick(cells, 'Sales', 'Sales/Purch'))

  const city = str(pick(cells, 'City'))
  const state = str(pick(cells, 'St', 'State'))?.slice(0, 4) ?? null
  const year = Number(tripDate.slice(0, 4))

  const base = {
    tripDate,
    endDate,
    destination,
    city,
    state,
    miles,
    oneWayMiles,
    odometerStart,
    odometerEnd,
    driver,
    sales,
    category: detectCategory(destination, raw.sourceFile),
    year,
    sourceFile: raw.sourceFile,
    sourceMd5: raw.sourceMd5,
    sourceSheet: raw.sourceSheet,
    sourceRow: raw.sourceRow,
    rawRow: cells,
  }
  return {
    entry: { ...base, contentHash: computeContentHash({ ...base }) },
  }
}

/** How complete an entry is — used to keep the richest of a set of dupes. */
function completeness(e: NormalizedMileageEntry): number {
  return [
    e.miles,
    e.oneWayMiles,
    e.odometerStart,
    e.driver,
    e.city,
    e.state,
    e.sales,
    e.endDate,
  ].filter((v) => v !== null && v !== undefined).length
}

export interface DedupeResult {
  unique: NormalizedMileageEntry[]
  duplicatesDropped: number
}

/**
 * Collapse rows that share a `contentHash` (the same trip re-exported across the
 * overlapping Master files), keeping the most complete copy. Deterministic: the
 * result does not depend on input order.
 */
export function dedupeMileageEntries(
  entries: NormalizedMileageEntry[]
): DedupeResult {
  const byHash = new Map<string, NormalizedMileageEntry>()
  let duplicatesDropped = 0
  for (const e of entries) {
    const existing = byHash.get(e.contentHash)
    if (!existing) {
      byHash.set(e.contentHash, e)
      continue
    }
    duplicatesDropped++
    // Keep the richer row; on a tie keep the lexicographically-first source so
    // the choice is stable regardless of input ordering.
    const better =
      completeness(e) > completeness(existing) ||
      (completeness(e) === completeness(existing) &&
        e.sourceFile < existing.sourceFile)
    if (better) byHash.set(e.contentHash, e)
  }
  return { unique: [...byHash.values()], duplicatesDropped }
}

export interface NormalizeSummary {
  entries: NormalizedMileageEntry[]
  skipped: Record<SkipReason, number>
  duplicatesDropped: number
}

/** Full stage-2 transform: normalize every raw row, then dedupe. */
export function normalizeMileage(rows: RawMileageRow[]): NormalizeSummary {
  const skipped: Record<SkipReason, number> = {
    'no-date': 0,
    'no-destination': 0,
    'subtotal-row': 0,
  }
  const normalized: NormalizedMileageEntry[] = []
  for (const row of rows) {
    const result = normalizeMileageRow(row)
    if ('skip' in result) skipped[result.skip]++
    else normalized.push(result.entry)
  }
  const { unique, duplicatesDropped } = dedupeMileageEntries(normalized)
  return { entries: unique, skipped, duplicatesDropped }
}
