import { addDays, eachDayOfInterval, format, startOfDay } from 'date-fns'

/** Map key for a calendar cell. */
export const dayKey = (d: Date) => format(d, 'yyyy-MM-dd')

/**
 * Friday of the weekend we're heading into.
 *
 * Monday through Friday look forward to the coming Friday. Saturday and Sunday
 * look *back* at the weekend already in progress — on a Saturday morning the
 * useful answer is "the show you're working today", not one six days out.
 */
export function weekendStart(today: Date): Date {
  const day = startOfDay(today)
  const dow = day.getDay()
  if (dow === 6) return addDays(day, -1) // Saturday -> yesterday
  if (dow === 0) return addDays(day, -2) // Sunday -> Friday
  return addDays(day, 5 - dow)
}

/** The three days [Fri, Sat, Sun] of the weekend containing or following `today`. */
export function weekendDays(today: Date): Date[] {
  const friday = weekendStart(today)
  return [friday, addDays(friday, 1), addDays(friday, 2)]
}

/**
 * A show that runs Friday to Sunday should appear on all three days, so we
 * expand each event into the days it covers. Capped so a mistyped end date
 * (say, a year out) can't paint the entire calendar.
 */
export const MAX_EVENT_SPAN_DAYS = 90

export function eventDays(startDate: string, endDate?: string | null): Date[] {
  const start = startOfDay(new Date(startDate))
  if (Number.isNaN(start.getTime())) return []

  const cap = addDays(start, MAX_EVENT_SPAN_DAYS)
  const parsedEnd = endDate ? startOfDay(new Date(endDate)) : start

  // An end before the start, or an unparseable one, collapses to a single day.
  const end =
    Number.isNaN(parsedEnd.getTime()) || parsedEnd < start
      ? start
      : parsedEnd > cap
        ? cap
        : parsedEnd

  return eachDayOfInterval({ start, end })
}
