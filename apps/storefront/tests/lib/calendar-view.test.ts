import { describe, expect, it } from 'vitest'
import { format } from 'date-fns'
import {
  MAX_EVENT_SPAN_DAYS,
  dayKey,
  eventDays,
  shiftWeek,
  weekBounds,
  weekDays,
  weekRangeLabel,
  weekStart,
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

describe('weekDays', () => {
  it('returns Sunday through Saturday of the containing week', () => {
    // Thu 2026-08-20 sits in the week of Sun 2026-08-16.
    expect(weekDays(at(2026, 8, 20)).map(dayKey)).toEqual([
      '2026-08-16',
      '2026-08-17',
      '2026-08-18',
      '2026-08-19',
      '2026-08-20',
      '2026-08-21',
      '2026-08-22',
    ])
  })

  it('treats Sunday as the first day of its own week, not the last', () => {
    expect(dayKey(weekDays(at(2026, 8, 16))[0])).toBe('2026-08-16')
  })

  it('ignores the time of day', () => {
    expect(dayKey(weekStart(at(2026, 8, 20, 23)))).toBe('2026-08-16')
  })
})

describe('shiftWeek', () => {
  it('steps backwards a week at a time', () => {
    expect(dayKey(shiftWeek(at(2026, 8, 20), -1))).toBe('2026-08-09')
  })

  it('steps forwards a week at a time', () => {
    expect(dayKey(shiftWeek(at(2026, 8, 20), 2))).toBe('2026-08-30')
  })

  it('crosses a year boundary', () => {
    expect(dayKey(shiftWeek(at(2026, 12, 30), 1))).toBe('2027-01-03')
  })
})

describe('weekBounds', () => {
  it('is half-open, so the next Sunday belongs to the next week', () => {
    const { start, end } = weekBounds(at(2026, 8, 20))
    expect(dayKey(start)).toBe('2026-08-16')
    expect(dayKey(end)).toBe('2026-08-23')
    expect(end.getTime() - start.getTime()).toBe(7 * 86_400_000)
  })
})

describe('weekRangeLabel', () => {
  it('collapses the repeated month', () => {
    expect(weekRangeLabel(at(2026, 8, 20))).toBe('Aug 16 – 22, 2026')
  })

  it('spells out both months across a month boundary', () => {
    // Week of Sun 2026-08-30 runs into September.
    expect(weekRangeLabel(at(2026, 8, 31))).toBe('Aug 30 – Sep 5, 2026')
  })

  it('spells out both years across a year boundary', () => {
    // Week of Sun 2026-12-27 runs into 2027.
    expect(weekRangeLabel(at(2026, 12, 28))).toBe('Dec 27, 2026 – Jan 2, 2027')
  })
})
