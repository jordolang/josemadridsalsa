/**
 * Pure helpers for the staff timeclock.
 *
 * Every punch is stored as a UTC instant, but a work day is a *local* business
 * day in Zanesville, Ohio. All bucketing therefore goes through `Intl` against
 * a fixed timezone so daylight-saving transitions can't shift a shift onto the
 * wrong day or drift period totals twice a year.
 */

export const TIMECLOCK_TIMEZONE = 'America/New_York'

/** How far back and forward the history view is allowed to look. */
export const TIMECLOCK_RANGE_MONTHS = 2

export interface TimeClockPunch {
  id: string
  clockInAt: Date
  clockOutAt: Date | null
  clockInIp: string | null
  clockOutIp: string | null
  notes: string | null
}

export interface TimeClockDay {
  /** Business-local day, `YYYY-MM-DD`. */
  dayKey: string
  entries: TimeClockPunch[]
  /** Sum of completed pairs on this day. Open entries contribute nothing. */
  totalMs: number
}

export interface CalendarDate {
  year: number
  month: number
  day: number
}

/**
 * Offset in milliseconds between the given instant and its wall-clock reading
 * in `timeZone` (positive west of UTC would be negative here — it is simply
 * `local - utc`).
 */
function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)

  const read: Record<string, number> = {}
  for (const part of parts) {
    if (part.type !== 'literal') read[part.type] = Number(part.value)
  }

  const asUtc = Date.UTC(
    read.year,
    read.month - 1,
    read.day,
    // Intl can render midnight as hour 24 in some engines.
    read.hour % 24,
    read.minute,
    read.second
  )

  // Zone offsets are whole minutes, so drop sub-second precision before diffing.
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

/** The instant at which the given business-local wall time occurs. */
function businessWallTimeToInstant(
  { year, month, day }: CalendarDate,
  hour: number,
  minute: number,
  second: number,
  ms: number
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, second, ms)
  // One refinement pass settles DST boundaries: the first guess uses the offset
  // on the wrong side of a transition, the second uses the correct one.
  let instant = naive - timeZoneOffsetMs(new Date(naive), TIMECLOCK_TIMEZONE)
  instant = naive - timeZoneOffsetMs(new Date(instant), TIMECLOCK_TIMEZONE)
  return new Date(instant)
}

/** The business-local calendar date on which an instant falls. */
export function businessCalendarDate(date: Date): CalendarDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMECLOCK_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const read: Record<string, number> = {}
  for (const part of parts) {
    if (part.type !== 'literal') read[part.type] = Number(part.value)
  }

  return { year: read.year, month: read.month, day: read.day }
}

/** Business-local day key, `YYYY-MM-DD`. */
export function businessDayKey(date: Date): string {
  const { year, month, day } = businessCalendarDate(date)
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** First instant of the business-local day containing `date`. */
export function startOfBusinessDay(date: CalendarDate): Date {
  return businessWallTimeToInstant(date, 0, 0, 0, 0)
}

/** Last instant of the business-local day containing `date`. */
export function endOfBusinessDay(date: CalendarDate): Date {
  return businessWallTimeToInstant(date, 23, 59, 59, 999)
}

/**
 * Parse the `MM/DD/YYYY` a user typed. Returns `null` for anything that isn't a
 * real calendar date — `02/30/2026` and `13/01/2026` are both rejected rather
 * than silently rolling over into the next month.
 */
export function parseDateInput(value: string): CalendarDate | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim())
  if (!match) return null

  const month = Number(match[1])
  const day = Number(match[2])
  const year = Number(match[3])

  if (month < 1 || month > 12 || day < 1 || year < 1970) return null

  // Reject days that don't exist in the given month.
  const probe = new Date(Date.UTC(year, month - 1, day))
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null

  return { year, month, day }
}

/** Render a calendar date back as `MM/DD/YYYY`. */
export function formatDateInput({ year, month, day }: CalendarDate): string {
  return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`
}

/** Shift a calendar date by a whole number of months, clamping the day. */
export function addMonths(date: CalendarDate, months: number): CalendarDate {
  const target = new Date(Date.UTC(date.year, date.month - 1 + months, 1))
  const year = target.getUTCFullYear()
  const month = target.getUTCMonth() + 1
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { year, month, day: Math.min(date.day, lastDay) }
}

/**
 * The window the history view may address: two months either side of `now`,
 * in business-local terms.
 */
export function timeClockRangeBounds(now: Date): { earliest: CalendarDate; latest: CalendarDate } {
  const today = businessCalendarDate(now)
  return {
    earliest: addMonths(today, -TIMECLOCK_RANGE_MONTHS),
    latest: addMonths(today, TIMECLOCK_RANGE_MONTHS),
  }
}

/** Order two calendar dates. Negative when `a` is earlier. */
export function compareCalendarDates(a: CalendarDate, b: CalendarDate): number {
  return a.year - b.year || a.month - b.month || a.day - b.day
}

/** Clamp a calendar date into the allowed ±2 month window. */
export function clampToRange(date: CalendarDate, now: Date): CalendarDate {
  const { earliest, latest } = timeClockRangeBounds(now)
  if (compareCalendarDates(date, earliest) < 0) return earliest
  if (compareCalendarDates(date, latest) > 0) return latest
  return date
}

/**
 * Resolve the pay period a request asked for. Anything unparseable falls back
 * to a sensible default, and both ends are clamped to the ±2 month window so a
 * hand-crafted query can't page through unbounded history.
 */
export function resolveRange(
  startInput: string | null,
  endInput: string | null,
  now: Date
): { start: CalendarDate; end: CalendarDate } {
  const { earliest } = timeClockRangeBounds(now)

  const requestedStart = startInput ? parseDateInput(startInput) : null
  const requestedEnd = endInput ? parseDateInput(endInput) : null

  const start = clampToRange(requestedStart ?? earliest, now)
  let end = clampToRange(requestedEnd ?? businessCalendarDate(now), now)

  // A backwards range would silently return nothing; treat it as a single day.
  if (compareCalendarDates(end, start) < 0) end = start

  return { start, end }
}

/** Worked milliseconds for one punch pair. An open entry counts as zero. */
export function punchDurationMs(entry: Pick<TimeClockPunch, 'clockInAt' | 'clockOutAt'>): number {
  if (!entry.clockOutAt) return 0
  return Math.max(0, entry.clockOutAt.getTime() - entry.clockInAt.getTime())
}

/** Worked milliseconds across every completed pair. */
export function totalDurationMs(entries: Pick<TimeClockPunch, 'clockInAt' | 'clockOutAt'>[]): number {
  return entries.reduce((sum, entry) => sum + punchDurationMs(entry), 0)
}

/**
 * Bucket punches into business-local days, newest day first. A pair is filed
 * under the day it *started*, so an overnight shift stays on one row rather
 * than being split across midnight.
 */
export function groupEntriesByDay(entries: TimeClockPunch[]): TimeClockDay[] {
  const byDay = new Map<string, TimeClockPunch[]>()

  for (const entry of entries) {
    const dayKey = businessDayKey(entry.clockInAt)
    const bucket = byDay.get(dayKey)
    if (bucket) bucket.push(entry)
    else byDay.set(dayKey, [entry])
  }

  return Array.from(byDay.entries())
    .map(([dayKey, dayEntries]) => ({
      dayKey,
      entries: [...dayEntries].sort((a, b) => a.clockInAt.getTime() - b.clockInAt.getTime()),
      totalMs: totalDurationMs(dayEntries),
    }))
    .sort((a, b) => (a.dayKey < b.dayKey ? 1 : a.dayKey > b.dayKey ? -1 : 0))
}

/** `8h 15m`, for reading. */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}h ${String(minutes).padStart(2, '0')}m`
}

/** Hours rounded to hundredths — the unit payroll actually reads. */
export function roundToPayrollHours(ms: number): number {
  return Math.round((ms / 3_600_000) * 100) / 100
}

/** `8.25`, for payroll. Rounded to hundredths of an hour. */
export function formatDecimalHours(ms: number): string {
  return roundToPayrollHours(ms).toFixed(2)
}

/**
 * Period total, summed from the per-day figures shown on screen.
 *
 * Summing raw milliseconds and rounding once at the end is marginally more
 * precise, but it leaves the column not adding up: three days displaying 7.51
 * each would total 22.52 rather than 22.53. A payroll table whose rows don't
 * reconcile is worse than one that is a cent of an hour off, so the visible
 * numbers win. Accumulated in whole hundredths to avoid float drift.
 */
export function sumDayPayrollHours(days: { totalMs: number }[]): number {
  const hundredths = days.reduce(
    (sum, day) => sum + Math.round((day.totalMs / 3_600_000) * 100),
    0
  )
  return hundredths / 100
}

/** `8:03:22 AM` — an instant as read on the clock in Zanesville. */
export function formatBusinessTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TIMECLOCK_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date)
}

/** `Saturday, August 1, 2026` from a `YYYY-MM-DD` day key. */
export function formatDayLabel(dayKey: string): string {
  const [year, month, day] = dayKey.split('-').map(Number)
  // The key already names a business-local day, so render it as-is in UTC
  // rather than re-projecting it through a timezone a second time.
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}
