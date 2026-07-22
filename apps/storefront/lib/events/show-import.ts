import Papa from 'papaparse'

/**
 * Import of the strict 20-column "Show import" CSV.
 *
 * Unlike the loose FestivalNet export importer (`festivalnet-import.ts`), this
 * format is fully specified: the header is verbatim and every row is validated
 * before anything is accepted. A single bad row rejects the whole file rather
 * than importing part of it — exports regenerate on demand, so a re-run costs
 * nothing, whereas a half-imported list is expensive to untangle.
 *
 * Three things this format carries that a naive importer flattens and loses:
 * the `*` estimated flags on Booth Fee / Attendance / # of Exhibitors, the
 * "not published" distinction between an empty cell and a zero, and the
 * Application Deadline that is often prose ("until full") rather than a date.
 */

/** Header row, verbatim. Any mismatch rejects the file. */
export const SHOW_CSV_COLUMNS = [
  'Event Name',
  'Venue',
  'Address',
  'City',
  'ST',
  'Drive-Time',
  'Start Date',
  'End Date',
  'Times',
  'Application Deadline',
  'Booth Fee',
  'Attendance',
  '# of Exhibitors',
  'Cost of Fuel',
  'Lodging',
  'Meals',
  'Contact Name',
  'Contact Email Address',
  'Application Information',
  'URL of Festivalnet posting',
] as const

export const SHOW_CSV_HEADER = SHOW_CSV_COLUMNS.join(',')

/** Columns that must never be empty, by zero-based index. */
const REQUIRED_INDEXES = [0, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 18, 19]

/** Thrown for any file-level rejection. The whole import is refused. */
export class ShowImportError extends Error {
  /** 1-based line number in the source file, when the failure is row-scoped. */
  readonly line: number | null

  constructor(message: string, line: number | null = null) {
    super(line === null ? message : `Line ${line}: ${message}`)
    this.name = 'ShowImportError'
    this.line = line
  }
}

/** A value that may be flagged estimated by a trailing `*`. */
interface Estimated<T> {
  value: T
  estimated: boolean
}

export interface ShowRow {
  /** 1-based line number in the source file (header is line 1). */
  lineNumber: number
  eventName: string
  venue: string | null
  address: string | null
  city: string
  state: string
  driveTime: string
  startDate: Date
  endDate: Date
  times: string | null
  /** Parsed deadline, null when the cell is prose like "until full". */
  applicationDeadline: Date | null
  /** The deadline cell exactly as written. Always present. */
  applicationDeadlineText: string
  boothFee: number
  boothFeeEstimated: boolean
  /** Parenthetical after the fee, e.g. "$750.00* (Contact)" -> "Contact". */
  boothFeeNote: string | null
  attendance: number
  attendanceEstimated: boolean
  exhibitors: number
  exhibitorsEstimated: boolean
  costOfFuel: number
  lodging: number
  meals: number
  contactName: string
  contactEmail: string | null
  applicationInfo: string
  /** The natural key. Upserts match on this, never on the event name. */
  url: string
}

const BOM = '﻿'

const stripBom = (text: string) => (text.startsWith(BOM) ? text.slice(BOM.length) : text)

/**
 * True when `text` is this format. Checked against the header alone so the
 * caller can route a file to the strict parser or the loose one before paying
 * for a full parse.
 */
export function isShowCsv(text: string): boolean {
  const firstLine = stripBom(text).split(/\r?\n/, 1)[0] ?? ''
  return firstLine.trim() === SHOW_CSV_HEADER
}

/** Splits `$750.00* (Contact)` into its number, estimated flag, and note. */
function parseMoneyCell(
  raw: string,
  column: string,
  line: number
): { value: number; estimated: boolean; note: string | null } {
  let rest = raw.trim()

  // The note comes off first — it can contain anything, including `*` and `$`.
  let note: string | null = null
  const noteMatch = rest.match(/\s*\(([^)]*)\)$/)
  if (noteMatch) {
    note = noteMatch[1].trim() || null
    rest = rest.slice(0, noteMatch.index).trim()
  }

  const estimated = rest.endsWith('*')
  if (estimated) rest = rest.slice(0, -1).trim()

  if (!/^\$[\d,]+(\.\d{2})?$/.test(rest)) {
    throw new ShowImportError(`${column} must look like $0.00, got "${raw}"`, line)
  }

  const value = Number(rest.replace(/[$,]/g, ''))
  if (!Number.isFinite(value)) {
    throw new ShowImportError(`${column} is not a number: "${raw}"`, line)
  }

  return { value, estimated, note }
}

/** Integer with an optional trailing `*` meaning estimated, not published. */
function parseCountCell(raw: string, column: string, line: number): Estimated<number> {
  let rest = raw.trim()
  const estimated = rest.endsWith('*')
  if (estimated) rest = rest.slice(0, -1).trim()

  if (!/^[\d,]+$/.test(rest)) {
    throw new ShowImportError(`${column} must be a whole number, got "${raw}"`, line)
  }

  return { value: Number(rest.replace(/,/g, '')), estimated }
}

/**
 * Strict MM/DD/YYYY. Anchored at noon local time so a timezone shift can't roll
 * a date onto the day before. Returns null when the string isn't a date at all.
 */
function parseSlashDate(raw: string): Date | null {
  const m = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null

  const month = Number(m[1])
  const day = Number(m[2])
  const year = Number(m[3])
  const date = new Date(year, month - 1, day, 12)

  // Rejects overflow like 02/31/2026, which the Date constructor would roll
  // forward into March rather than refuse.
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}

function requireDate(raw: string, column: string, line: number): Date {
  const date = parseSlashDate(raw)
  if (!date) {
    throw new ShowImportError(`${column} must be MM/DD/YYYY, got "${raw}"`, line)
  }
  return date
}

function parseRow(fields: string[], lineNumber: number): ShowRow {
  if (fields.length !== SHOW_CSV_COLUMNS.length) {
    throw new ShowImportError(
      `expected ${SHOW_CSV_COLUMNS.length} fields, found ${fields.length}`,
      lineNumber
    )
  }

  const values = fields.map((f) => f.trim())

  for (const i of REQUIRED_INDEXES) {
    if (!values[i]) {
      throw new ShowImportError(`${SHOW_CSV_COLUMNS[i]} is required`, lineNumber)
    }
  }

  // An empty optional cell means "not published" — never zero, never "".
  const optional = (i: number) => values[i] || null

  const state = values[4]
  if (!/^[A-Z]{2}$/.test(state)) {
    throw new ShowImportError(`ST must be two uppercase letters, got "${state}"`, lineNumber)
  }

  const driveTime = values[5]
  if (!/^\d+h \d{2}m$/.test(driveTime)) {
    throw new ShowImportError(
      `Drive-Time must look like "7h 04m", got "${driveTime}"`,
      lineNumber
    )
  }

  const startDate = requireDate(values[6], 'Start Date', lineNumber)
  const endDate = requireDate(values[7], 'End Date', lineNumber)
  if (endDate < startDate) {
    throw new ShowImportError(
      `End Date (${values[7]}) is before Start Date (${values[6]})`,
      lineNumber
    )
  }

  const contactEmail = optional(17)
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    throw new ShowImportError(
      `Contact Email Address is not an email: "${contactEmail}"`,
      lineNumber
    )
  }

  const url = values[19]
  if (!/^https:\/\/\S+$/.test(url)) {
    throw new ShowImportError(
      `URL of Festivalnet posting must be an absolute https:// URL, got "${url}"`,
      lineNumber
    )
  }

  const boothFee = parseMoneyCell(values[10], 'Booth Fee', lineNumber)
  const attendance = parseCountCell(values[11], 'Attendance', lineNumber)
  const exhibitors = parseCountCell(values[12], '# of Exhibitors', lineNumber)

  return {
    lineNumber,
    eventName: values[0],
    venue: optional(1),
    address: optional(2),
    city: values[3],
    state,
    driveTime,
    startDate,
    endDate,
    times: optional(8),
    // Not always a date: "until full" and "Not listed" are real values. Keep
    // both so the prose survives and the date is still queryable when present.
    applicationDeadline: parseSlashDate(values[9]),
    applicationDeadlineText: values[9],
    boothFee: boothFee.value,
    boothFeeEstimated: boothFee.estimated,
    boothFeeNote: boothFee.note,
    attendance: attendance.value,
    attendanceEstimated: attendance.estimated,
    exhibitors: exhibitors.value,
    exhibitorsEstimated: exhibitors.estimated,
    costOfFuel: parseMoneyCell(values[13], 'Cost of Fuel', lineNumber).value,
    lodging: parseMoneyCell(values[14], 'Lodging', lineNumber).value,
    meals: parseMoneyCell(values[15], 'Meals', lineNumber).value,
    contactName: values[16],
    contactEmail,
    applicationInfo: values[18],
    url,
  }
}

/**
 * Parses a Show import CSV, or throws `ShowImportError` describing the first
 * problem found. Nothing partial is ever returned.
 */
export function parseShowCsv(text: string): ShowRow[] {
  const body = stripBom(text)

  const result = Papa.parse<string[]>(body, {
    header: false,
    delimiter: ',',
    quoteChar: '"',
    escapeChar: '"',
    // `# of Exhibitors` starts with `#`; comment stripping would eat the column.
    comments: false,
    skipEmptyLines: false,
  })

  const lines = (result.data ?? []).filter(
    // Papa emits a trailing [''] for the newline that ends the last row.
    (fields, i) => !(i > 0 && fields.length === 1 && fields[0].trim() === '')
  )

  if (lines.length === 0) {
    throw new ShowImportError('The file is empty')
  }

  const header = lines[0].map((h) => h.trim()).join(',')
  if (header !== SHOW_CSV_HEADER) {
    throw new ShowImportError(
      `Header row does not match the Show import format.\nExpected: ${SHOW_CSV_HEADER}\nFound:    ${header}`
    )
  }

  if (lines.length === 1) {
    throw new ShowImportError('The file contains a header but no shows')
  }

  const rows: ShowRow[] = []
  const seenUrls = new Map<string, number>()

  for (let i = 1; i < lines.length; i++) {
    const lineNumber = i + 1
    const row = parseRow(lines[i], lineNumber)

    // The URL is the natural key, so a duplicate inside one file makes the
    // import ambiguous — two rows would fight over the same record.
    const duplicate = seenUrls.get(row.url)
    if (duplicate !== undefined) {
      throw new ShowImportError(
        `duplicate URL of Festivalnet posting, already used on line ${duplicate}: ${row.url}`,
        lineNumber
      )
    }
    seenUrls.set(row.url, lineNumber)

    rows.push(row)
  }

  return rows
}
