import { describe, expect, it } from 'vitest'
import { format } from 'date-fns'
import {
  MAX_EVENT_SPAN_DAYS,
  dayKey,
  eventDays,
  weekendDays,
  weekendStart,
} from '@/lib/events/calendar-view'

/** Local-time construction; `new Date('2026-07-24')` would parse as UTC. */
const at = (y: number, m: number, d: number, h = 0) => new Date(y, m - 1, d, h)

describe('weekendStart', () => {
  // Anchor week: Fri 2026-07-24, Sat 07-25, Sun 07-26.
  it('looks forward from Monday to the coming Friday', () => {
    expect(dayKey(weekendStart(at(2026, 7, 20)))).toBe('2026-07-24')
  })

  it('looks forward from Thursday to the next day', () => {
    expect(dayKey(weekendStart(at(2026, 7, 23)))).toBe('2026-07-24')
  })

  it('returns today when today is Friday', () => {
    expect(dayKey(weekendStart(at(2026, 7, 24)))).toBe('2026-07-24')
  })

  it('looks back on Saturday to the weekend in progress', () => {
    expect(dayKey(weekendStart(at(2026, 7, 25)))).toBe('2026-07-24')
  })

  it('looks back on Sunday to the weekend in progress', () => {
    expect(dayKey(weekendStart(at(2026, 7, 26)))).toBe('2026-07-24')
  })

  it('ignores the time of day', () => {
    expect(dayKey(weekendStart(at(2026, 7, 25, 23)))).toBe('2026-07-24')
  })

  it('crosses a month boundary', () => {
    // Wed 2026-09-30 -> Fri 2026-10-02
    expect(dayKey(weekendStart(at(2026, 9, 30)))).toBe('2026-10-02')
  })
})

describe('weekendDays', () => {
  it('returns Friday, Saturday, Sunday', () => {
    const days = weekendDays(at(2026, 7, 22))
    expect(days.map(dayKey)).toEqual(['2026-07-24', '2026-07-25', '2026-07-26'])
    expect(days.map((d) => format(d, 'EEE'))).toEqual(['Fri', 'Sat', 'Sun'])
  })
})

describe('eventDays', () => {
  const iso = (y: number, m: number, d: number) => at(y, m, d, 12).toISOString()

  it('returns a single day when there is no end date', () => {
    expect(eventDays(iso(2026, 7, 24)).map(dayKey)).toEqual(['2026-07-24'])
  })

  it('spans every day of a Friday-to-Sunday show', () => {
    expect(eventDays(iso(2026, 7, 24), iso(2026, 7, 26)).map(dayKey)).toEqual([
      '2026-07-24',
      '2026-07-25',
      '2026-07-26',
    ])
  })

  it('collapses to one day when the end precedes the start', () => {
    expect(eventDays(iso(2026, 7, 24), iso(2026, 7, 20)).map(dayKey)).toEqual(['2026-07-24'])
  })

  it('caps a runaway end date instead of painting the whole calendar', () => {
    const days = eventDays(iso(2026, 1, 1), iso(2030, 1, 1))
    expect(days).toHaveLength(MAX_EVENT_SPAN_DAYS + 1)
  })

  it('returns nothing for an unparseable start', () => {
    expect(eventDays('not-a-date')).toEqual([])
  })

  it('collapses to the start day for an unparseable end', () => {
    expect(eventDays(iso(2026, 7, 24), 'not-a-date').map(dayKey)).toEqual(['2026-07-24'])
  })
})
