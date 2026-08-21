/**
 * Translation between a FeaturedEvent and a Google Calendar v3 event resource.
 *
 * Pure, so both directions can be tested without a network. The storage
 * invariant it relies on, shared with the ICS exporter:
 *
 *   **An all-day event's `startDate`/`endDate` sit on UTC midnight of the
 *   calendar date.** Google speaks bare `YYYY-MM-DD` for these, with an
 *   exclusive end; we store an inclusive last day.
 */

import { icsStatusFor } from './ics'

/** The subset of Google's event resource we read. */
export interface GoogleEventResource {
  id: string
  etag?: string
  status?: string
  summary?: string
  description?: string | null
  location?: string | null
  updated?: string
  start?: { date?: string; dateTime?: string } | null
  end?: { date?: string; dateTime?: string } | null
}

/** The body we send on create/update. */
export interface GoogleEventBody {
  summary: string
  description?: string
  location?: string
  start: { date: string } | { dateTime: string }
  end: { date: string } | { dateTime: string }
  status: 'confirmed' | 'tentative'
}

export interface PushableEvent {
  title: string
  description: string | null
  location: string | null
  startDate: Date
  endDate: Date | null
  isAllDay: boolean
  bookingStatus: string
}

export interface PulledEvent {
  title: string
  description: string | null
  location: string | null
  startDate: Date
  endDate: Date | null
  isAllDay: boolean
}

const pad = (n: number) => String(n).padStart(2, '0')

/** `YYYY-MM-DD` from UTC parts, per the all-day storage invariant. */
export function toGoogleDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

/** Bare `YYYY-MM-DD` -> UTC midnight. Never local: that would shift the day. */
export function fromGoogleDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

/**
 * Google will not accept a TENTATIVE status the way iCalendar does for every
 * pipeline state, and only "Where is Jose?" events are ever pushed anyway —
 * those are shows we have committed to. Anything not firmly booked still goes
 * up as tentative so a reader can tell.
 */
function googleStatus(bookingStatus: string): 'confirmed' | 'tentative' {
  return icsStatusFor(bookingStatus) === 'CONFIRMED' ? 'confirmed' : 'tentative'
}

export function toGoogleEvent(event: PushableEvent): GoogleEventBody {
  const body: GoogleEventBody = event.isAllDay
    ? {
        summary: event.title,
        // Google's all-day end is exclusive; ours is the inclusive last day.
        start: { date: toGoogleDate(event.startDate) },
        end: {
          date: toGoogleDate(
            new Date(
              (event.endDate && event.endDate >= event.startDate
                ? event.endDate
                : event.startDate
              ).getTime() + 86_400_000
            )
          ),
        },
        status: googleStatus(event.bookingStatus),
      }
    : {
        summary: event.title,
        start: { dateTime: event.startDate.toISOString() },
        // A timed event with no end is meaningless to Google, so give it one.
        end: {
          dateTime: (event.endDate && event.endDate > event.startDate
            ? event.endDate
            : new Date(event.startDate.getTime() + 3_600_000)
          ).toISOString(),
        },
        status: googleStatus(event.bookingStatus),
      }

  if (event.description) body.description = event.description
  if (event.location) body.location = event.location
  return body
}

/** Null when the resource carries no usable start — we cannot place it. */
export function fromGoogleEvent(resource: GoogleEventResource): PulledEvent | null {
  const startDateOnly = resource.start?.date
  const startTimed = resource.start?.dateTime

  if (startDateOnly) {
    const startDate = fromGoogleDate(startDateOnly)
    if (Number.isNaN(startDate.getTime())) return null

    // Exclusive -> inclusive. A one-day event comes back as start === end,
    // which we store as a null endDate rather than a redundant repeat.
    let endDate: Date | null = null
    if (resource.end?.date) {
      const exclusive = fromGoogleDate(resource.end.date)
      if (!Number.isNaN(exclusive.getTime())) {
        const inclusive = new Date(exclusive.getTime() - 86_400_000)
        endDate = inclusive > startDate ? inclusive : null
      }
    }

    return {
      title: resource.summary?.trim() || 'Untitled Event',
      description: resource.description ?? null,
      location: resource.location ?? null,
      startDate,
      endDate,
      isAllDay: true,
    }
  }

  if (startTimed) {
    const startDate = new Date(startTimed)
    if (Number.isNaN(startDate.getTime())) return null

    let endDate: Date | null = null
    if (resource.end?.dateTime) {
      const parsed = new Date(resource.end.dateTime)
      if (!Number.isNaN(parsed.getTime()) && parsed > startDate) endDate = parsed
    }

    return {
      title: resource.summary?.trim() || 'Untitled Event',
      description: resource.description ?? null,
      location: resource.location ?? null,
      startDate,
      endDate,
      isAllDay: false,
    }
  }

  return null
}
