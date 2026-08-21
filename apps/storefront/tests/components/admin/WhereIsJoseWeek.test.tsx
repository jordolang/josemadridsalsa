import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Radix measures its popper; jsdom has neither of these.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock('sonner', () => ({
  toast: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) },
}))

import WhereIsJoseWeek, {
  type WeekEvent,
} from '@/app/admin/events/_components/WhereIsJoseWeek'

/** Anchor: Thursday 2026-08-20, in the week of Sun 2026-08-16. */
const TODAY = new Date(2026, 7, 20, 9, 0, 0)

/** Local ISO with no zone suffix, so the component parses it in local time. */
const local = (y: number, m: number, d: number, h = 0) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:00:00`

const wijEvent: WeekEvent = {
  id: 'wij1',
  title: 'Zanesville Festival',
  location: 'Riverside Park',
  startDate: local(2026, 8, 21, 10),
  isWhereIsJose: true,
  bookingStatus: 'CONFIRMED',
}

const otherEvent: WeekEvent = {
  id: 'other1',
  title: 'County Fair',
  startDate: local(2026, 8, 22),
  isWhereIsJose: false,
  bookingStatus: 'APPLIED',
}

const nextWeekEvent: WeekEvent = {
  id: 'wij2',
  title: 'Columbus Market',
  startDate: local(2026, 8, 26),
  isWhereIsJose: true,
  bookingStatus: 'CONFIRMED',
}

const deadlineEvent: WeekEvent = {
  id: 'dl1',
  title: 'Apple Butter Fest',
  startDate: local(2026, 10, 3),
  isWhereIsJose: false,
  bookingStatus: 'INTERESTED',
  applicationDeadline: local(2026, 8, 19),
}

const renderWeek = (events: WeekEvent[] = [wijEvent, otherEvent, nextWeekEvent]) => {
  const onRefresh = vi.fn()
  render(<WhereIsJoseWeek events={events} loading={false} onRefresh={onRefresh} />)
  return { onRefresh }
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(TODAY)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  toastSuccess.mockClear()
  toastError.mockClear()
})

describe('week grid', () => {
  it('opens on the week containing today', () => {
    renderWeek()
    expect(screen.getByText('Aug 16 – 22, 2026')).toBeInTheDocument()
  })

  it('renders seven day cells', () => {
    renderWeek()
    expect(screen.getAllByRole('button', { name: /^\w+day, August/ })).toHaveLength(7)
  })

  it('places an event on its own day', () => {
    renderWeek()
    const friday = screen.getByRole('button', { name: /Friday, August 21/ })
    expect(within(friday).getByText('Zanesville Festival')).toBeInTheDocument()
  })

  it('shows shows that are not "Where is Jose?" alongside the ones that are', () => {
    renderWeek()
    const saturday = screen.getByRole('button', { name: /Saturday, August 22/ })
    expect(within(saturday).getByText('County Fair')).toBeInTheDocument()
  })

  it('dims the shows that are not "Where is Jose?"', () => {
    renderWeek()
    // The title sits in a `truncate` span inside the chip; the chip is its parent.
    const wij = screen.getByText('Zanesville Festival').parentElement
    const other = screen.getByText('County Fair').parentElement
    expect(other?.className).toContain('opacity-70')
    expect(wij?.className).not.toContain('opacity-70')
  })

  it('hides events from other weeks', () => {
    renderWeek()
    expect(screen.queryByText('Columbus Market')).not.toBeInTheDocument()
  })

  it('marks an application deadline on the day it falls', () => {
    renderWeek([deadlineEvent])
    const wednesday = screen.getByRole('button', { name: /Wednesday, August 19/ })
    expect(within(wednesday).getByText('Due: Apple Butter Fest')).toBeInTheDocument()
  })

  it('says so when the week holds no "Where is Jose?" events', () => {
    renderWeek([otherEvent])
    expect(
      screen.getByText('No “Where is Jose?” events this week.')
    ).toBeInTheDocument()
  })

  it('stays quiet when the week does hold one', () => {
    renderWeek()
    expect(
      screen.queryByText('No “Where is Jose?” events this week.')
    ).not.toBeInTheDocument()
  })
})

describe('week pagination', () => {
  it('steps forward a week', async () => {
    const user = userEvent.setup()
    renderWeek()
    await user.click(screen.getByRole('button', { name: 'Next week' }))
    expect(screen.getByText('Aug 23 – 29, 2026')).toBeInTheDocument()
    expect(screen.getByText('Columbus Market')).toBeInTheDocument()
  })

  it('steps backward into the past', async () => {
    const user = userEvent.setup()
    renderWeek()
    await user.click(screen.getByRole('button', { name: 'Previous week' }))
    expect(screen.getByText('Aug 9 – 15, 2026')).toBeInTheDocument()
    expect(screen.queryByText('Zanesville Festival')).not.toBeInTheDocument()
  })

  it('jumps several weeks at once from the pager', async () => {
    const user = userEvent.setup()
    renderWeek()
    await user.click(screen.getByRole('button', { name: 'Week of August 30, 2026' }))
    expect(screen.getByText('Aug 30 – Sep 5, 2026')).toBeInTheDocument()
  })

  it('returns to the current week', async () => {
    const user = userEvent.setup()
    renderWeek()
    await user.click(screen.getByRole('button', { name: 'Next week' }))
    await user.click(screen.getByRole('button', { name: 'This week' }))
    expect(screen.getByText('Aug 16 – 22, 2026')).toBeInTheDocument()
  })

  it('crosses a year boundary without losing the label', () => {
    renderWeek()
    // Typed character by character a date input emits half-formed values;
    // a change event is what the browser actually fires on a picked date.
    fireEvent.change(screen.getByLabelText('Jump to week'), {
      target: { value: '2026-12-30' },
    })
    expect(screen.getByText('Dec 27, 2026 – Jan 2, 2027')).toBeInTheDocument()
  })
})

describe('day panel', () => {
  it('opens when a day is clicked', async () => {
    const user = userEvent.setup()
    renderWeek()
    await user.click(screen.getByRole('button', { name: /Friday, August 21/ }))
    expect(
      screen.getByRole('heading', { name: 'Friday, August 21, 2026' })
    ).toBeInTheDocument()
  })

  it('lists that day’s events with an edit link', async () => {
    const user = userEvent.setup()
    renderWeek()
    await user.click(screen.getByRole('button', { name: /Friday, August 21/ }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Zanesville Festival')).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: /Edit/ })).toHaveAttribute(
      'href',
      '/admin/events/wij1/edit'
    )
  })

  it('offers to add an event prefilled with that date', async () => {
    const user = userEvent.setup()
    renderWeek()
    await user.click(screen.getByRole('button', { name: /Wednesday, August 19/ }))
    expect(
      screen.getByRole('link', { name: /Add an event on this day/ })
    ).toHaveAttribute('href', '/admin/events/new?date=2026-08-19&whereIsJose=1')
  })

  it('says when a day is empty rather than showing a blank panel', async () => {
    const user = userEvent.setup()
    renderWeek()
    await user.click(screen.getByRole('button', { name: /Monday, August 17/ }))
    expect(screen.getByText('Nothing scheduled on this day.')).toBeInTheDocument()
  })

  it('shows the start time when one was entered', async () => {
    const user = userEvent.setup()
    renderWeek()
    await user.click(screen.getByRole('button', { name: /Friday, August 21/ }))
    expect(within(screen.getByRole('dialog')).getByText('10:00 AM')).toBeInTheDocument()
  })

  it('shows no time for a midnight start, which means all-day', async () => {
    const user = userEvent.setup()
    renderWeek()
    await user.click(screen.getByRole('button', { name: /Saturday, August 22/ }))
    expect(within(screen.getByRole('dialog')).queryByText(/12:00 AM/)).not.toBeInTheDocument()
  })

  it('surfaces a deadline falling on that day', async () => {
    const user = userEvent.setup()
    renderWeek([deadlineEvent])
    await user.click(screen.getByRole('button', { name: /Wednesday, August 19/ }))
    expect(screen.getByText('Applications due today')).toBeInTheDocument()
  })
})

describe('promoting a show into "Where is Jose?"', () => {
  it('PATCHes the flag on and refreshes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    const { onRefresh } = renderWeek()
    await user.click(screen.getByRole('button', { name: /Saturday, August 22/ }))
    await user.click(screen.getByRole('button', { name: 'Add to WIJ' }))

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/events/other1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ isWhereIsJose: true }),
      })
    )
    expect(onRefresh).toHaveBeenCalled()
  })

  it('offers to demote one that is already flagged', async () => {
    const user = userEvent.setup()
    renderWeek()
    await user.click(screen.getByRole('button', { name: /Friday, August 21/ }))
    expect(screen.getByRole('button', { name: 'Remove from WIJ' })).toBeInTheDocument()
  })

  it('reports a failed update instead of pretending it worked', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, json: async () => ({ error: 'Forbidden' }) })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    const { onRefresh } = renderWeek()
    await user.click(screen.getByRole('button', { name: /Saturday, August 22/ }))
    await user.click(screen.getByRole('button', { name: 'Add to WIJ' }))

    expect(toastError).toHaveBeenCalledWith('Forbidden')
    expect(onRefresh).not.toHaveBeenCalled()
  })
})

describe('export links', () => {
  it('scopes the week export to the week on screen', async () => {
    const user = userEvent.setup()
    renderWeek()
    await user.click(screen.getByRole('button', { name: /Export/ }))

    const link = screen.getByRole('menuitem', { name: /Calendar file/ })
    const url = new URL(link.getAttribute('href')!, 'http://localhost')
    expect(url.searchParams.get('scope')).toBe('range')
    // Sun 2026-08-16 00:00 local through the following Sunday.
    expect(url.searchParams.get('from')).toBe(new Date(2026, 7, 16).toISOString())
    expect(url.searchParams.get('to')).toBe(new Date(2026, 7, 23).toISOString())
  })

  it('offers an all-dates export of every "Where is Jose?" event', async () => {
    const user = userEvent.setup()
    renderWeek()
    await user.click(screen.getByRole('button', { name: /Export/ }))

    const link = screen.getByRole('menuitem', { name: /All .Where is Jose/ })
    expect(link.getAttribute('href')).toContain('scope=wij')
  })

  it('follows the pager, so exporting after paging gets the new week', async () => {
    const user = userEvent.setup()
    renderWeek()
    await user.click(screen.getByRole('button', { name: 'Next week' }))
    await user.click(screen.getByRole('button', { name: /Export/ }))

    const link = screen.getByRole('menuitem', { name: /Calendar file/ })
    const url = new URL(link.getAttribute('href')!, 'http://localhost')
    expect(url.searchParams.get('from')).toBe(new Date(2026, 7, 23).toISOString())
  })
})
