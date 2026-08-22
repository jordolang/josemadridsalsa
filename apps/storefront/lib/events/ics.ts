/**
 * iCalendar (RFC 5545) output for shows.
 *
 * Written by hand rather than pulled from a library: we emit one VEVENT shape
 * and the escaping rules are short, so a dependency would be more surface than
 * the ~80 lines it replaces.
 */

import type { EventBookingStatus } from '@prisma/client'

const CRLF = '\r\n'

/** Product identifier advertised in the feed, per RFC 5545 §3.7.3. */
const PRODID = '-//Jose Madrid Salsa//Events//EN'

export interface IcsEvent {
  /** Stable across exports — calendars key updates on this. */
  uid: string
  title: string
  description?: string | null
  location?: string | null
  start: Date
  /** Inclusive last day (all-day) or the finish time (timed). */
  end?: Date | null
  allDay: boolean
  url?: string | null
  status?: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED'
}

/**
 * A booking status is not a calendar status. Everything we have not actually
 * been given a booth for is TENTATIVE, so a subscriber's calendar shows it as
 * unconfirmed rather than as a commitment we have not made.
 */
export function icsStatusFor(bookingStatus: string): IcsEvent['status'] {
  switch (bookingStatus) {
    case 'CONFIRMED':
    case 'ACCEPTED':
      return 'CONFIRMED'
    case 'DECLINED':
    case 'CANCELLED':
      return 'CANCELLED'
    default:
      return 'TENTATIVE'
  }
}

/** RFC 5545 §3.3.11: backslash first, or the later escapes get double-escaped. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/**
 * RFC 5545 §3.1: content lines are folded at 75 *octets*, continued with a
 * leading space. Measured in UTF-8 bytes and broken on code-point boundaries —
 * splitting mid-character produces a file Apple Calendar rejects outright.
 */
function foldLine(line: string): string {
  const encoder = new TextEncoder()
  if (encoder.encode(line).length <= 75) return line

  const parts: string[] = []
  let current = ''
  let bytes = 0
  // Continuation lines spend one of their 75 octets on the leading space.
  let limit = 75

  for (const char of line) {
    const size = encoder.encode(char).length
    if (bytes + size > limit) {
      parts.push(current)
      current = ''
      bytes = 0
      limit = 74
    }
    current += char
    bytes += size
  }
  parts.push(current)

  return parts.join(`${CRLF} `)
}

const pad = (n: number) => String(n).padStart(2, '0')

/** DATE-TIME in UTC: 20260829T140000Z */
function toUtcStamp(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  )
}

/**
 * DATE for an all-day event: 20260829.
 *
 * Read from UTC parts, because of the storage invariant an all-day event obeys:
 * **`startDate` sits on UTC midnight of the calendar date.** That is how the
 * Google ingest writes a bare `YYYY-MM-DD` and how the backfill classified the
 * existing rows. Reading local parts instead would render the previous day for
 * anyone west of UTC — including a developer in Ohio, though not the UTC server
 * that ships the file, which is exactly the kind of split that hides in review.
 */
function toDateStamp(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`
}

function addOneDay(date: Date): Date {
  return new Date(date.getTime() + 86_400_000)
}

function line(name: string, value: string): string {
  return foldLine(`${name}:${escapeText(value)}`)
}

function vevent(event: IcsEvent, stamp: string): string[] {
  const lines: string[] = ['BEGIN:VEVENT', line('UID', event.uid), `DTSTAMP:${stamp}`]

  if (event.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${toDateStamp(event.start)}`)
    // DTEND is exclusive for DATE values, so a one-day show ends the next day.
    const lastDay = event.end && event.end >= event.start ? event.end : event.start
    lines.push(`DTEND;VALUE=DATE:${toDateStamp(addOneDay(lastDay))}`)
  } else {
    lines.push(`DTSTART:${toUtcStamp(event.start)}`)
    if (event.end && event.end > event.start) {
      lines.push(`DTEND:${toUtcStamp(event.end)}`)
    }
  }

  lines.push(line('SUMMARY', event.title))
  if (event.location) lines.push(line('LOCATION', event.location))
  if (event.description) lines.push(line('DESCRIPTION', event.description))
  if (event.url) lines.push(line('URL', event.url))
  if (event.status) lines.push(`STATUS:${event.status}`)

  lines.push('END:VEVENT')
  return lines
}

export interface BuildIcsOptions {
  /** Shown as the calendar's name when the file is imported or subscribed to. */
  calendarName: string
  /** Injectable so tests are not time-dependent. */
  now?: Date
}

export function buildIcs(events: IcsEvent[], options: BuildIcsOptions): string {
  const stamp = toUtcStamp(options.now ?? new Date())

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    line('X-WR-CALNAME', options.calendarName),
    ...events.flatMap((event) => vevent(event, stamp)),
    'END:VCALENDAR',
  ]

  // Trailing CRLF: RFC 5545 §3.1 requires every content line to be terminated.
  return `${lines.join(CRLF)}${CRLF}`
}

/** The event fields the exporters need. A subset of FeaturedEvent. */
export interface ExportableEvent {
  id: string
  title: string
  description: string | null
  location: string | null
  venue?: string | null
  city?: string | null
  state?: string | null
  startDate: Date
  endDate: Date | null
  isAllDay: boolean
  bookingStatus: EventBookingStatus | string
}

/** Best available human location: the free-text field, else the parsed parts. */
export function eventLocationLine(event: ExportableEvent): string | null {
  if (event.location) return event.location
  const parts = [event.venue, event.city, event.state].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : null
}

export function toIcsEvent(event: ExportableEvent, siteUrl: string): IcsEvent {
  return {
    uid: `event-${event.id}@josemadrid.net`,
    title: event.title,
    description: event.description,
    location: eventLocationLine(event),
    start: event.startDate,
    end: event.endDate,
    allDay: event.isAllDay,
    url: `${siteUrl.replace(/\/$/, '')}/where-is-jose`,
    status: icsStatusFor(String(event.bookingStatus)),
  }
}
