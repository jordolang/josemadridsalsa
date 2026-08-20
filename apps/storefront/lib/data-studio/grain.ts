/**
 * Time bucketing for Data Studio, in the business's own timezone.
 *
 * Every bucket key is derived from the business-local reading of an instant, not from UTC. That is
 * not a nicety: Vercel runs functions with `TZ=UTC`, the business is in Zanesville, Ohio, and a sale
 * rung up at 8pm ET on 31 December is stored as 01:00 UTC on 1 January. Bucketed in UTC it lands in
 * the wrong **tax year** — unacceptable for a tool whose whole purpose includes annual reporting.
 *
 * The DST-safe primitives already exist in `lib/timeclock.ts`, which solved this same problem for
 * shifts, so they are reused rather than reimplemented — the two-pass offset refinement around a
 * daylight-saving boundary is exactly the kind of code that should exist once. The timezone constant
 * is named for that module because that is where it lives today; both callers mean "the business's
 * local day".
 *
 * Bucketing here always emits **every** bucket in the window, in order, zeros included — the same
 * rule `lib/analytics/monthly-series.ts` records, for the same reason: a series that omits an empty
 * period silently joins November to January and draws a trend that never happened.
 */
import {
  TIMECLOCK_TIMEZONE,
  businessCalendarDate,
  endOfBusinessDay,
  startOfBusinessDay,
  type CalendarDate,
} from '@/lib/timeclock'

import type { TimeGrain } from './types'

export const BUSINESS_TIMEZONE = TIMECLOCK_TIMEZONE

/** Bucket label shown for rows whose date or year column is null. Such rows are never dropped. */
export const UNKNOWN_BUCKET_KEY = 'unknown'
export const UNKNOWN_BUCKET_LABEL = 'Unknown'

export interface TimeBucket {
  /** Sort key. Lexicographic order matches chronological order for every grain. */
  key: string
  label: string
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

const pad = (value: number, width = 2): string => String(value).padStart(width, '0')

/** Parse the `YYYY-MM-DD` a date input produces. Returns null for anything that isn't a real date. */
export function parseIsoDate(value: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  // Reject rollovers: 2026-02-30 parses digit-wise but is not a date.
  const probe = new Date(Date.UTC(year, month - 1, day))
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null
  }
  return { year, month, day }
}

export function formatIsoDate({ year, month, day }: CalendarDate): string {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`
}

/**
 * The instants bounding a business-local date range, inclusive of both endpoints.
 *
 * Used to build the Prisma `where` for a timestamp axis, so a range typed as whole local days
 * selects whole local days rather than shifted UTC windows.
 */
export function rangeBounds(from: CalendarDate, to: CalendarDate): { start: Date; end: Date } {
  return { start: startOfBusinessDay(from), end: endOfBusinessDay(to) }
}

/** Weekday of a calendar date, 0 = Sunday. Pure calendar arithmetic; no timezone involved. */
function weekdayOf({ year, month, day }: CalendarDate): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

function addDays(date: CalendarDate, days: number): CalendarDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days))
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  }
}

/** Monday of the week containing `date`. Weeks start Monday, matching ISO. */
function startOfWeek(date: CalendarDate): CalendarDate {
  const weekday = weekdayOf(date)
  // Sunday (0) belongs to the week that began six days earlier, not the one starting tomorrow.
  const backtrack = weekday === 0 ? 6 : weekday - 1
  return addDays(date, -backtrack)
}

const quarterOf = (month: number): number => Math.floor((month - 1) / 3) + 1

/** The bucket a business-local calendar date falls into, for the given grain. */
export function bucketKeyOfCalendarDate(date: CalendarDate, grain: TimeGrain): string {
  switch (grain) {
    case 'day':
      return formatIsoDate(date)
    case 'week':
      return formatIsoDate(startOfWeek(date))
    case 'month':
      return `${pad(date.year, 4)}-${pad(date.month)}`
    case 'quarter':
      return `${pad(date.year, 4)}-Q${quarterOf(date.month)}`
    case 'year':
      return pad(date.year, 4)
  }
}

/**
 * The bucket an instant falls into, read in the business timezone.
 *
 * `null` in — a nullable `showDate`, say — yields the explicit unknown bucket rather than dropping
 * the row, because a row with money on it and no date is a fact about the data worth seeing.
 */
export function bucketKeyOf(date: Date | null | undefined, grain: TimeGrain): string {
  if (!date) return UNKNOWN_BUCKET_KEY
  return bucketKeyOfCalendarDate(businessCalendarDate(date), grain)
}

/** The bucket a bare year column falls into. Only the `year` grain is meaningful for such a column. */
export function yearBucketKey(year: number | null | undefined): string {
  return year === null || year === undefined ? UNKNOWN_BUCKET_KEY : pad(year, 4)
}

export function bucketLabel(key: string, grain: TimeGrain): string {
  if (key === UNKNOWN_BUCKET_KEY) return UNKNOWN_BUCKET_LABEL

  switch (grain) {
    case 'day':
    case 'week': {
      const parsed = parseIsoDate(key)
      if (!parsed) return key
      const label = `${MONTH_NAMES[parsed.month - 1]} ${parsed.day}`
      return grain === 'week' ? `Week of ${label}` : label
    }
    case 'month': {
      const [year, month] = key.split('-')
      const index = Number(month) - 1
      return MONTH_NAMES[index] ? `${MONTH_NAMES[index]} ${year}` : key
    }
    case 'quarter':
      return key.replace('-', ' ')
    case 'year':
      return key
  }
}

/**
 * Every bucket between two business-local dates, oldest first.
 *
 * The caller folds rows into these, so a period with no rows shows as a zero rather than vanishing.
 */
export function bucketsBetween(from: CalendarDate, to: CalendarDate, grain: TimeGrain): TimeBucket[] {
  const buckets: TimeBucket[] = []
  const seen = new Set<string>()
  const guard = 10_000

  let cursor: CalendarDate =
    grain === 'week' ? startOfWeek(from) : { ...from, day: grain === 'day' ? from.day : 1 }
  if (grain === 'month' || grain === 'quarter' || grain === 'year') cursor = { ...cursor, day: 1 }
  if (grain === 'quarter') cursor = { ...cursor, month: (quarterOf(from.month) - 1) * 3 + 1 }
  if (grain === 'year') cursor = { ...cursor, month: 1 }

  const endKey = bucketKeyOfCalendarDate(to, grain)

  for (let i = 0; i < guard; i += 1) {
    const key = bucketKeyOfCalendarDate(cursor, grain)
    if (!seen.has(key)) {
      seen.add(key)
      buckets.push({ key, label: bucketLabel(key, grain) })
    }
    if (key >= endKey) break

    switch (grain) {
      case 'day':
        cursor = addDays(cursor, 1)
        break
      case 'week':
        cursor = addDays(cursor, 7)
        break
      case 'month':
        cursor = { year: cursor.month === 12 ? cursor.year + 1 : cursor.year, month: cursor.month === 12 ? 1 : cursor.month + 1, day: 1 }
        break
      case 'quarter':
        cursor = { year: cursor.month >= 10 ? cursor.year + 1 : cursor.year, month: cursor.month >= 10 ? 1 : cursor.month + 3, day: 1 }
        break
      case 'year':
        cursor = { year: cursor.year + 1, month: 1, day: 1 }
        break
    }
  }

  return buckets
}

/** Every year bucket in an inclusive span, oldest first. */
export function yearBucketsBetween(fromYear: number, toYear: number): TimeBucket[] {
  const buckets: TimeBucket[] = []
  for (let year = fromYear; year <= toYear && buckets.length < 500; year += 1) {
    buckets.push({ key: pad(year, 4), label: pad(year, 4) })
  }
  return buckets
}
