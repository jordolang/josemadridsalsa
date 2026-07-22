import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FILTERS,
  type EventFilterState,
  type FilterableEvent,
  filterEvents,
} from '@/app/admin/events/_components/EventFilters'

// Anchor: Wednesday 2026-07-22. That week's weekend is Fri 24 – Sun 26.
const TODAY = new Date(2026, 6, 22, 9)

const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString()

const event = (over: Partial<FilterableEvent> & { id: string }): FilterableEvent => ({
  title: 'Some Fest',
  location: null,
  startDate: iso(2026, 8, 1),
  endDate: null,
  applicationDeadline: null,
  bookingStatus: 'CONFIRMED',
  isWhereIsJose: false,
  ...over,
})

const filters = (over: Partial<EventFilterState> = {}): EventFilterState => ({
  ...DEFAULT_FILTERS,
  ...over,
})

describe('filterEvents — time', () => {
  const past = event({ id: 'past', startDate: iso(2026, 7, 1) })
  const future = event({ id: 'future', startDate: iso(2026, 9, 1) })

  it('upcoming excludes finished shows', () => {
    const ids = filterEvents([past, future], filters({ time: 'upcoming' }), TODAY).map((e) => e.id)
    expect(ids).toEqual(['future'])
  })

  it('past keeps only finished shows', () => {
    const ids = filterEvents([past, future], filters({ time: 'past' }), TODAY).map((e) => e.id)
    expect(ids).toEqual(['past'])
  })

  it('all keeps everything', () => {
    expect(filterEvents([past, future], filters({ time: 'all' }), TODAY)).toHaveLength(2)
  })

  it('treats a multi-day show as upcoming until its last day passes', () => {
    // Started two days ago, still running today.
    const running = event({ id: 'running', startDate: iso(2026, 7, 20), endDate: iso(2026, 7, 24) })
    const ids = filterEvents([running], filters({ time: 'upcoming' }), TODAY).map((e) => e.id)
    expect(ids).toEqual(['running'])
  })
})

describe('filterEvents — weekend', () => {
  it('includes a show on the coming Saturday', () => {
    const sat = event({ id: 'sat', startDate: iso(2026, 7, 25) })
    expect(filterEvents([sat], filters({ time: 'weekend' }), TODAY).map((e) => e.id)).toEqual([
      'sat',
    ])
  })

  it('includes a show spanning into the weekend', () => {
    const spanning = event({
      id: 'span',
      startDate: iso(2026, 7, 23),
      endDate: iso(2026, 7, 25),
    })
    expect(filterEvents([spanning], filters({ time: 'weekend' }), TODAY)).toHaveLength(1)
  })

  it('excludes the following weekend', () => {
    const nextWeek = event({ id: 'next', startDate: iso(2026, 8, 1) })
    expect(filterEvents([nextWeek], filters({ time: 'weekend' }), TODAY)).toHaveLength(0)
  })

  it('excludes a Thursday show', () => {
    const thu = event({ id: 'thu', startDate: iso(2026, 7, 23) })
    expect(filterEvents([thu], filters({ time: 'weekend' }), TODAY)).toHaveLength(0)
  })

  it('on Saturday still shows the weekend in progress', () => {
    const saturday = new Date(2026, 6, 25, 9)
    const fri = event({ id: 'fri', startDate: iso(2026, 7, 24) })
    expect(filterEvents([fri], filters({ time: 'weekend' }), saturday)).toHaveLength(1)
  })
})

describe('filterEvents — deadlines', () => {
  it('keeps only future deadlines', () => {
    const soon = event({ id: 'soon', applicationDeadline: iso(2026, 8, 1) })
    const gone = event({ id: 'gone', applicationDeadline: iso(2026, 7, 1) })
    const none = event({ id: 'none' })
    const ids = filterEvents([soon, gone, none], filters({ time: 'deadlines' }), TODAY).map(
      (e) => e.id
    )
    expect(ids).toEqual(['soon'])
  })
})

describe('filterEvents — search and status', () => {
  const a = event({ id: 'a', title: 'Dublin Irish Fest', location: 'Dublin, OH' })
  const b = event({ id: 'b', title: 'Zanesville Art Fest', bookingStatus: 'APPLIED' })

  it('matches on title, case-insensitively', () => {
    expect(filterEvents([a, b], filters({ search: 'dublin' }), TODAY).map((e) => e.id)).toEqual([
      'a',
    ])
  })

  it('matches on location', () => {
    expect(filterEvents([a, b], filters({ search: 'OH' }), TODAY).map((e) => e.id)).toEqual(['a'])
  })

  it('ignores surrounding whitespace', () => {
    expect(filterEvents([a, b], filters({ search: '  dublin  ' }), TODAY)).toHaveLength(1)
  })

  it('filters by status', () => {
    expect(
      filterEvents([a, b], filters({ statuses: ['APPLIED'] }), TODAY).map((e) => e.id)
    ).toEqual(['b'])
  })

  it('treats a missing status as CONFIRMED', () => {
    const legacy = event({ id: 'legacy', bookingStatus: null })
    expect(filterEvents([legacy], filters({ statuses: ['CONFIRMED'] }), TODAY)).toHaveLength(1)
  })

  it('an empty status list means no status filtering', () => {
    expect(filterEvents([a, b], filters({ statuses: [] }), TODAY)).toHaveLength(2)
  })
})

describe('filterEvents — sorting', () => {
  it('sorts by start date ascending by default', () => {
    const late = event({ id: 'late', startDate: iso(2026, 9, 1) })
    const early = event({ id: 'early', startDate: iso(2026, 8, 1) })
    expect(filterEvents([late, early], filters(), TODAY).map((e) => e.id)).toEqual([
      'early',
      'late',
    ])
  })

  it('sorts undated deadlines last', () => {
    const withDeadline = event({ id: 'with', applicationDeadline: iso(2026, 8, 5) })
    const without = event({ id: 'without' })
    const ids = filterEvents([without, withDeadline], filters({ sort: 'deadline' }), TODAY).map(
      (e) => e.id
    )
    expect(ids).toEqual(['with', 'without'])
  })

  it('sorts by title', () => {
    const z = event({ id: 'z', title: 'Zanesville' })
    const d = event({ id: 'd', title: 'Dublin' })
    expect(filterEvents([z, d], filters({ sort: 'title' }), TODAY).map((e) => e.id)).toEqual([
      'd',
      'z',
    ])
  })

  it('does not mutate the input array', () => {
    const list = [event({ id: 'b', startDate: iso(2026, 9, 1) }), event({ id: 'a' })]
    const before = list.map((e) => e.id)
    filterEvents(list, filters(), TODAY)
    expect(list.map((e) => e.id)).toEqual(before)
  })
})
