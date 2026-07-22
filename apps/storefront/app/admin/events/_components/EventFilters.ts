/**
 * Pure filtering/sorting for the events list. Kept out of the component so the
 * matching rules are testable without rendering.
 */

export interface FilterableEvent {
  id: string
  title: string
  location?: string | null
  startDate: string
  endDate?: string | null
  applicationDeadline?: string | null
  bookingStatus?: string | null
  isWhereIsJose: boolean
}

export type TimeFilter = 'upcoming' | 'past' | 'weekend' | 'deadlines' | 'all'
export type SortKey = 'startDate' | 'deadline' | 'title'

export interface EventFilterState {
  search: string
  statuses: string[]
  time: TimeFilter
  sort: SortKey
}

export const DEFAULT_FILTERS: EventFilterState = {
  search: '',
  statuses: [],
  time: 'upcoming',
  sort: 'startDate',
}

const startOfDayLocal = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

/** An event is "past" only once its last day is over, not on day one. */
function lastDay(event: FilterableEvent): Date {
  const end = event.endDate ? new Date(event.endDate) : new Date(event.startDate)
  const valid = Number.isNaN(end.getTime()) ? new Date(event.startDate) : end
  return startOfDayLocal(valid)
}

function matchesSearch(event: FilterableEvent, search: string): boolean {
  const q = search.trim().toLowerCase()
  if (!q) return true
  return (
    event.title.toLowerCase().includes(q) ||
    (event.location ?? '').toLowerCase().includes(q)
  )
}

function matchesTime(event: FilterableEvent, time: TimeFilter, today: Date): boolean {
  const todayStart = startOfDayLocal(today)

  switch (time) {
    case 'all':
      return true
    case 'past':
      return lastDay(event) < todayStart
    case 'upcoming':
      return lastDay(event) >= todayStart
    case 'weekend': {
      const dow = todayStart.getDay()
      const offset = dow === 6 ? -1 : dow === 0 ? -2 : 5 - dow
      const friday = new Date(todayStart)
      friday.setDate(friday.getDate() + offset)
      const sunday = new Date(friday)
      sunday.setDate(sunday.getDate() + 2)
      const start = startOfDayLocal(new Date(event.startDate))
      // Overlap test: the show runs across any part of Fri–Sun.
      return start <= sunday && lastDay(event) >= friday
    }
    case 'deadlines': {
      if (!event.applicationDeadline) return false
      const due = startOfDayLocal(new Date(event.applicationDeadline))
      return !Number.isNaN(due.getTime()) && due >= todayStart
    }
  }
}

export function filterEvents<T extends FilterableEvent>(
  events: T[],
  filters: EventFilterState,
  today: Date = new Date()
): T[] {
  const filtered = events.filter((event) => {
    if (!matchesSearch(event, filters.search)) return false
    if (!matchesTime(event, filters.time, today)) return false
    if (
      filters.statuses.length > 0 &&
      !filters.statuses.includes(event.bookingStatus ?? 'CONFIRMED')
    ) {
      return false
    }
    return true
  })

  const sorted = [...filtered]
  sorted.sort((a, b) => {
    switch (filters.sort) {
      case 'title':
        return a.title.localeCompare(b.title)
      case 'deadline': {
        // Events with no deadline sort last rather than jumping to the front.
        const av = a.applicationDeadline ? new Date(a.applicationDeadline).getTime() : Infinity
        const bv = b.applicationDeadline ? new Date(b.applicationDeadline).getTime() : Infinity
        if (av === bv) return a.title.localeCompare(b.title)
        return av - bv
      }
      case 'startDate':
      default:
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    }
  })

  return sorted
}
