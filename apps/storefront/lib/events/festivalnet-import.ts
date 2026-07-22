import Papa from 'papaparse'
import { parse as parseDate, isValid } from 'date-fns'

/**
 * Import of a FestivalNet "Export My List" CSV.
 *
 * FestivalNet has no API, and their export re-sends the *entire* list every
 * time at a per-record cost. So this importer has two jobs: never create a
 * duplicate on re-import, and never silently drop a row. Every row comes back
 * from a preview labelled create / update / skip / error before anything is
 * written.
 *
 * Their column headers are not documented and vary by export, so headers are
 * auto-detected against known aliases and the mapping stays user-overridable.
 */

/** Fields we can pull out of a row. Only `title` and `startDate` are required. */
export type ImportField =
  | 'externalId'
  | 'title'
  | 'location'
  | 'description'
  | 'startDate'
  | 'endDate'
  | 'applicationDeadline'
  | 'boothFee'
  | 'contactName'
  | 'contactEmail'
  | 'contactPhone'

export type ColumnMapping = Partial<Record<ImportField, string>>

export const REQUIRED_FIELDS: ImportField[] = ['title', 'startDate']

/**
 * Candidate header names, lowercased and stripped of non-alphanumerics before
 * comparison. Order matters: earlier aliases win.
 */
const FIELD_ALIASES: Record<ImportField, string[]> = {
  externalId: ['eventid', 'id', 'festivalid', 'showid', 'listingid'],
  title: ['eventname', 'name', 'event', 'title', 'showname', 'festivalname'],
  location: ['location', 'city', 'citystate', 'venue', 'address', 'where'],
  description: ['description', 'notes', 'details', 'comments'],
  startDate: ['startdate', 'eventdate', 'datestart', 'begindate', 'date', 'startdatetime'],
  endDate: ['enddate', 'dateend', 'finishdate', 'through', 'enddatetime'],
  applicationDeadline: [
    'applicationdeadline',
    'deadline',
    'appdeadline',
    'applicationdue',
    'duedate',
    'entrydeadline',
    'jurydeadline',
  ],
  boothFee: ['boothfee', 'fee', 'boothcost', 'spacefee', 'cost', 'entryfee'],
  contactName: ['contactname', 'contact', 'promoter', 'organizer', 'coordinator'],
  contactEmail: ['contactemail', 'email', 'promoteremail', 'organizeremail'],
  contactPhone: ['contactphone', 'phone', 'promoterphone', 'telephone', 'phonenumber'],
}

const normalizeHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Best-guess header -> field mapping. A header is claimed by at most one field
 * so two fields can't both read the same column.
 */
export function detectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {}
  const claimed = new Set<string>()

  // Exact alias matches first, so a literal "deadline" column isn't stolen by a
  // looser contains-match from another field.
  for (const pass of ['exact', 'partial'] as const) {
    for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [
      ImportField,
      string[],
    ][]) {
      if (mapping[field]) continue

      for (const alias of aliases) {
        const hit = headers.find((h) => {
          if (claimed.has(h)) return false
          const n = normalizeHeader(h)
          return pass === 'exact' ? n === alias : n.includes(alias)
        })
        if (hit) {
          mapping[field] = hit
          claimed.add(hit)
          break
        }
      }
    }
  }

  return mapping
}

/** Formats seen in spreadsheet exports, tried in order. */
const DATE_FORMATS = [
  'yyyy-MM-dd',
  'MM/dd/yyyy',
  'M/d/yyyy',
  'MM/dd/yy',
  'M/d/yy',
  'MMMM d, yyyy',
  'MMM d, yyyy',
  'MMMM d yyyy',
  'MMM d yyyy',
  'd MMMM yyyy',
  'yyyy/MM/dd',
  'MM-dd-yyyy',
]

/**
 * Parses a date to **noon local time**. Calendar dates carry no clock; anchoring
 * at noon keeps a timezone shift from rolling a deadline onto the day before.
 * Returns null rather than guessing when nothing matches.
 */
export function parseLooseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const raw = String(value).trim()
  if (!raw) return null

  const reference = new Date(2000, 0, 1, 12, 0, 0)
  for (const fmt of DATE_FORMATS) {
    const parsed = parseDate(raw, fmt, reference)
    if (isValid(parsed)) {
      return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12)
    }
  }

  // Last resort: let the runtime try, then re-anchor to noon.
  const fallback = new Date(raw)
  if (isValid(fallback) && !Number.isNaN(fallback.getTime())) {
    return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate(), 12)
  }

  return null
}

/** "$1,250.00" -> 1250. Returns null when there's no number in there at all. */
export function parseMoney(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const cleaned = String(value).replace(/[^0-9.-]/g, '')
  if (!cleaned || cleaned === '-' || cleaned === '.') return null
  const n = Number(cleaned)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * Fallback identity for rows with no FestivalNet id: a show is the same show if
 * the name and start date match. Deliberately excludes location — the same
 * export often spells a venue differently between runs.
 */
export function fallbackKey(title: string, startDate: Date): string {
  const t = title.toLowerCase().replace(/[^a-z0-9]/g, '')
  const y = startDate.getFullYear()
  const m = String(startDate.getMonth() + 1).padStart(2, '0')
  const d = String(startDate.getDate()).padStart(2, '0')
  return `${t}|${y}-${m}-${d}`
}

export interface ParsedRow {
  /** 1-based row number in the source file, for error messages. */
  rowNumber: number
  externalId: string | null
  title: string
  location: string | null
  description: string | null
  startDate: Date | null
  endDate: Date | null
  applicationDeadline: Date | null
  boothFee: number | null
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  /** Populated when the row can't be imported. */
  error: string | null
}

const cell = (row: Record<string, string>, column: string | undefined): string | null => {
  if (!column) return null
  const v = row[column]
  if (v === undefined || v === null) return null
  const trimmed = String(v).trim()
  return trimmed.length > 0 ? trimmed : null
}

export function normalizeRow(
  row: Record<string, string>,
  mapping: ColumnMapping,
  rowNumber: number
): ParsedRow {
  const title = cell(row, mapping.title)
  const startRaw = cell(row, mapping.startDate)
  const startDate = parseLooseDate(startRaw)

  let error: string | null = null
  if (!title) {
    error = 'Missing event name'
  } else if (!startRaw) {
    error = 'Missing start date'
  } else if (!startDate) {
    error = `Unrecognized start date: "${startRaw}"`
  }

  const endDate = parseLooseDate(cell(row, mapping.endDate))

  return {
    rowNumber,
    externalId: cell(row, mapping.externalId),
    title: title ?? '',
    location: cell(row, mapping.location),
    description: cell(row, mapping.description),
    startDate,
    // An end before the start is meaningless; drop it rather than import a
    // negative span.
    endDate: endDate && startDate && endDate < startDate ? null : endDate,
    applicationDeadline: parseLooseDate(cell(row, mapping.applicationDeadline)),
    boothFee: parseMoney(cell(row, mapping.boothFee)),
    contactName: cell(row, mapping.contactName),
    contactEmail: cell(row, mapping.contactEmail),
    contactPhone: cell(row, mapping.contactPhone),
    error,
  }
}

export interface ParsedCsv {
  headers: string[]
  mapping: ColumnMapping
  rows: ParsedRow[]
  /** Required fields with no column assigned — the import can't run yet. */
  missingRequired: ImportField[]
}

export function parseFestivalNetCsv(csv: string, override?: ColumnMapping): ParsedCsv {
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  })

  const headers = (result.meta.fields ?? []).filter((h) => h.length > 0)
  const mapping = { ...detectColumnMapping(headers), ...(override ?? {}) }
  const missingRequired = REQUIRED_FIELDS.filter((f) => !mapping[f])

  const rows = (result.data ?? []).map((row, i) => normalizeRow(row, mapping, i + 1))

  return { headers, mapping, rows, missingRequired }
}
