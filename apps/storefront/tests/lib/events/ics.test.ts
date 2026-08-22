import { describe, expect, it } from 'vitest'
import {
  buildIcs,
  eventLocationLine,
  icsStatusFor,
  toIcsEvent,
  type ExportableEvent,
  type IcsEvent,
} from '@/lib/events/ics'

/** Local-time construction; `new Date('2026-08-29')` would parse as UTC. */
const at = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min)

const NOW = new Date(Date.UTC(2026, 7, 21, 10, 30, 0))

/** All-day events obey the storage invariant: UTC midnight of the calendar date. */
const allDayAt = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d))

const baseEvent = (overrides: Partial<IcsEvent> = {}): IcsEvent => ({
  uid: 'event-abc@josemadrid.net',
  title: 'Zanesville Festival',
  start: allDayAt(2026, 8, 29),
  allDay: true,
  ...overrides,
})

const build = (events: IcsEvent[]) =>
  buildIcs(events, { calendarName: 'Where is Jose?', now: NOW })

/** Unfolds RFC 5545 continuation lines back into whole content lines. */
const contentLines = (ics: string) =>
  ics.replace(/\r\n /g, '').split('\r\n').filter(Boolean)

describe('buildIcs envelope', () => {
  it('wraps events in a VCALENDAR with CRLF endings', () => {
    const ics = build([baseEvent()])
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics).toContain('VERSION:2.0')
    expect(ics).toContain('X-WR-CALNAME:Where is Jose?')
  })

  it('stamps every event with the injected time, in UTC', () => {
    const ics = build([baseEvent(), baseEvent({ uid: 'event-def@josemadrid.net' })])
    const stamps = contentLines(ics).filter((l) => l.startsWith('DTSTAMP:'))
    expect(stamps).toEqual(['DTSTAMP:20260821T103000Z', 'DTSTAMP:20260821T103000Z'])
  })

  it('emits a valid empty calendar when there is nothing to export', () => {
    const ics = build([])
    expect(ics).not.toContain('BEGIN:VEVENT')
    expect(ics).toContain('END:VCALENDAR')
  })
})

describe('all-day events', () => {
  it('uses a DATE value and an exclusive end one day later', () => {
    const ics = build([baseEvent()])
    expect(ics).toContain('DTSTART;VALUE=DATE:20260829')
    expect(ics).toContain('DTEND;VALUE=DATE:20260830')
  })

  it('spans a multi-day show through the day after its last day', () => {
    const ics = build([baseEvent({ end: allDayAt(2026, 8, 31) })])
    expect(ics).toContain('DTSTART;VALUE=DATE:20260829')
    expect(ics).toContain('DTEND;VALUE=DATE:20260901')
  })

  it('reads the date from UTC parts, so the host timezone cannot shift it', () => {
    // The suite runs in the developer's zone and the export runs on a UTC
    // host. Both must emit the 29th for an event stored on the 29th.
    const ics = build([baseEvent({ start: allDayAt(2026, 8, 29) })])
    expect(ics).toContain('DTSTART;VALUE=DATE:20260829')
    expect(ics).toContain('DTEND;VALUE=DATE:20260830')
  })

  it('crosses a month boundary correctly', () => {
    const ics = build([baseEvent({ start: allDayAt(2026, 8, 31) })])
    expect(ics).toContain('DTEND;VALUE=DATE:20260901')
  })

  it('collapses an end that precedes the start to a single day', () => {
    const ics = build([baseEvent({ end: allDayAt(2026, 8, 20) })])
    expect(ics).toContain('DTEND;VALUE=DATE:20260830')
  })
})

describe('timed events', () => {
  const timed = (overrides: Partial<IcsEvent> = {}) =>
    baseEvent({ allDay: false, start: at(2026, 8, 29, 10, 0), ...overrides })

  it('emits UTC DATE-TIME values', () => {
    const ics = build([timed({ end: at(2026, 8, 29, 18, 0) })])
    const start = contentLines(ics).find((l) => l.startsWith('DTSTART:'))
    expect(start).toMatch(/^DTSTART:\d{8}T\d{6}Z$/)
  })

  it('omits DTEND when the end is missing', () => {
    const ics = build([timed({ end: null })])
    expect(ics).not.toContain('DTEND')
  })

  it('omits DTEND when the end is not after the start', () => {
    const ics = build([timed({ end: at(2026, 8, 29, 10, 0) })])
    expect(ics).not.toContain('DTEND')
  })
})

describe('text escaping', () => {
  it('escapes commas, semicolons, and backslashes', () => {
    const ics = build([
      baseEvent({ title: 'Salsa, Chips; and a\\Slash' }),
    ])
    expect(contentLines(ics)).toContain(
      'SUMMARY:Salsa\\, Chips\\; and a\\\\Slash'
    )
  })

  it('escapes the backslash before the characters it would double-escape', () => {
    const ics = build([baseEvent({ title: 'a\\,b' })])
    // Not `a\\\,b` — the literal backslash becomes `\\`, then the comma `\,`.
    expect(contentLines(ics)).toContain('SUMMARY:a\\\\\\,b')
  })

  it('folds newlines into the literal \\n escape', () => {
    const ics = build([baseEvent({ description: 'line one\nline two' })])
    expect(contentLines(ics)).toContain('DESCRIPTION:line one\\nline two')
  })
})

describe('line folding', () => {
  it('leaves lines of 75 octets or fewer alone', () => {
    const title = 'x'.repeat(67) // SUMMARY: is 8 octets
    const ics = build([baseEvent({ title })])
    expect(ics).toContain(`\r\nSUMMARY:${title}\r\n`)
  })

  it('folds longer lines with a leading space on the continuation', () => {
    const title = 'y'.repeat(200)
    const ics = build([baseEvent({ title })])
    const raw = ics.split('\r\n').filter((l) => l.startsWith('SUMMARY:') || l.startsWith(' y'))
    expect(raw.length).toBeGreaterThan(1)
    for (const line of ics.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    }
  })

  it('unfolds back to the original value', () => {
    const title = 'z'.repeat(200)
    const ics = build([baseEvent({ title })])
    expect(contentLines(ics)).toContain(`SUMMARY:${title}`)
  })

  it('never splits a multi-byte character across a fold', () => {
    // Each jalapeño emoji is 4 UTF-8 octets and must land whole on one line.
    const ics = build([baseEvent({ title: '🌶'.repeat(60) })])
    for (const line of ics.split('\r\n')) {
      expect(line).not.toContain('�')
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    }
    expect(contentLines(ics)).toContain(`SUMMARY:${'🌶'.repeat(60)}`)
  })
})

describe('icsStatusFor', () => {
  it('maps booked shows to CONFIRMED', () => {
    expect(icsStatusFor('CONFIRMED')).toBe('CONFIRMED')
    expect(icsStatusFor('ACCEPTED')).toBe('CONFIRMED')
  })

  it('maps dead shows to CANCELLED', () => {
    expect(icsStatusFor('DECLINED')).toBe('CANCELLED')
    expect(icsStatusFor('CANCELLED')).toBe('CANCELLED')
  })

  it('maps everything still in the pipeline to TENTATIVE', () => {
    expect(icsStatusFor('INTERESTED')).toBe('TENTATIVE')
    expect(icsStatusFor('APPLIED')).toBe('TENTATIVE')
    expect(icsStatusFor('WAITLISTED')).toBe('TENTATIVE')
  })
})

describe('all-day comes from the column, not from the clock', () => {
  const base: ExportableEvent = {
    id: 'evt1',
    title: 'Zanesville Festival',
    description: null,
    location: 'Main St',
    startDate: at(2026, 8, 29, 10),
    endDate: null,
    isAllDay: false,
    bookingStatus: 'CONFIRMED',
  }

  it('honours isAllDay even when the start carries a time', () => {
    // A UTC-hosted server and an Eastern-time office disagree about which
    // instant is midnight, so the stored flag is the only reliable answer.
    expect(toIcsEvent({ ...base, isAllDay: true }, 'https://x.test').allDay).toBe(true)
  })

  it('honours a timed event that happens to start at midnight', () => {
    expect(
      toIcsEvent({ ...base, startDate: allDayAt(2026, 8, 29), isAllDay: false }, 'https://x.test')
        .allDay
    ).toBe(false)
  })
})

describe('toIcsEvent', () => {
  const dbEvent: ExportableEvent = {
    id: 'evt1',
    title: 'Zanesville Festival',
    description: null,
    location: null,
    venue: 'Riverside Park',
    city: 'Zanesville',
    state: 'OH',
    startDate: allDayAt(2026, 8, 29),
    endDate: null,
    isAllDay: true,
    bookingStatus: 'APPLIED',
  }

  it('builds a stable UID from the event id', () => {
    expect(toIcsEvent(dbEvent, 'https://www.josemadrid.net').uid).toBe(
      'event-evt1@josemadrid.net'
    )
  })

  it('falls back to the parsed address parts when location is empty', () => {
    expect(eventLocationLine(dbEvent)).toBe('Riverside Park, Zanesville, OH')
  })

  it('prefers the free-text location when it is set', () => {
    expect(eventLocationLine({ ...dbEvent, location: 'Main St' })).toBe('Main St')
  })

  it('returns null when there is no location at all', () => {
    expect(
      eventLocationLine({ ...dbEvent, venue: null, city: null, state: null })
    ).toBeNull()
  })

  it('trims a trailing slash off the site URL', () => {
    expect(toIcsEvent(dbEvent, 'https://www.josemadrid.net/').url).toBe(
      'https://www.josemadrid.net/where-is-jose'
    )
  })
})
