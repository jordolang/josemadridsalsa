import { describe, it, expect } from 'vitest'
import {
  addMonths,
  businessDayKey,
  clampToRange,
  endOfBusinessDay,
  formatDateInput,
  formatDecimalHours,
  formatDuration,
  groupEntriesByDay,
  parseDateInput,
  punchDurationMs,
  resolveRange,
  startOfBusinessDay,
  sumDayPayrollHours,
  timeClockRangeBounds,
  totalDurationMs,
  type TimeClockPunch,
} from '@/lib/timeclock'

function punch(
  id: string,
  clockInAt: string,
  clockOutAt: string | null,
  notes: string | null = null
): TimeClockPunch {
  return {
    id,
    clockInAt: new Date(clockInAt),
    clockOutAt: clockOutAt ? new Date(clockOutAt) : null,
    clockInIp: '203.0.113.7',
    clockOutIp: clockOutAt ? '203.0.113.7' : null,
    notes,
  }
}

describe('parseDateInput', () => {
  it('accepts MM/DD/YYYY and single-digit month/day', () => {
    expect(parseDateInput('08/01/2026')).toEqual({ year: 2026, month: 8, day: 1 })
    expect(parseDateInput('8/1/2026')).toEqual({ year: 2026, month: 8, day: 1 })
    expect(parseDateInput('  12/31/2025 ')).toEqual({ year: 2025, month: 12, day: 31 })
  })

  it('rejects dates that do not exist rather than rolling over', () => {
    expect(parseDateInput('02/30/2026')).toBeNull()
    expect(parseDateInput('13/01/2026')).toBeNull()
    expect(parseDateInput('00/10/2026')).toBeNull()
    expect(parseDateInput('04/31/2026')).toBeNull()
  })

  it('accepts a real leap day and rejects a fake one', () => {
    expect(parseDateInput('02/29/2024')).toEqual({ year: 2024, month: 2, day: 29 })
    expect(parseDateInput('02/29/2026')).toBeNull()
  })

  it('rejects malformed input', () => {
    expect(parseDateInput('')).toBeNull()
    expect(parseDateInput('2026-08-01')).toBeNull()
    expect(parseDateInput('08/01/26')).toBeNull()
    expect(parseDateInput('August 1, 2026')).toBeNull()
  })

  it('round-trips through formatDateInput', () => {
    expect(formatDateInput({ year: 2026, month: 8, day: 1 })).toBe('08/01/2026')
    expect(parseDateInput(formatDateInput({ year: 2026, month: 8, day: 1 }))).toEqual({
      year: 2026,
      month: 8,
      day: 1,
    })
  })
})

describe('business day boundaries', () => {
  it('starts an EDT day at 04:00 UTC', () => {
    // Summer: America/New_York is UTC-4.
    expect(startOfBusinessDay({ year: 2026, month: 8, day: 1 }).toISOString()).toBe(
      '2026-08-01T04:00:00.000Z'
    )
    expect(endOfBusinessDay({ year: 2026, month: 8, day: 1 }).toISOString()).toBe(
      '2026-08-02T03:59:59.999Z'
    )
  })

  it('starts an EST day at 05:00 UTC', () => {
    // Winter: America/New_York is UTC-5.
    expect(startOfBusinessDay({ year: 2026, month: 1, day: 15 }).toISOString()).toBe(
      '2026-01-15T05:00:00.000Z'
    )
  })

  it('handles the spring-forward day, which is only 23 hours long', () => {
    // DST begins 2026-03-08 at 02:00 local.
    const start = startOfBusinessDay({ year: 2026, month: 3, day: 8 })
    const end = endOfBusinessDay({ year: 2026, month: 3, day: 8 })
    expect(start.toISOString()).toBe('2026-03-08T05:00:00.000Z')
    expect(end.toISOString()).toBe('2026-03-09T03:59:59.999Z')
    expect(end.getTime() - start.getTime()).toBeLessThan(23 * 60 * 60 * 1000)
  })

  it('handles the fall-back day, which is 25 hours long', () => {
    // DST ends 2026-11-01 at 02:00 local.
    const start = startOfBusinessDay({ year: 2026, month: 11, day: 1 })
    const end = endOfBusinessDay({ year: 2026, month: 11, day: 1 })
    expect(end.getTime() - start.getTime()).toBeGreaterThan(24 * 60 * 60 * 1000)
  })

  it('assigns a late-evening punch to the local day, not the UTC day', () => {
    // 2026-08-01 22:30 EDT is 2026-08-02 02:30 UTC.
    expect(businessDayKey(new Date('2026-08-02T02:30:00.000Z'))).toBe('2026-08-01')
  })
})

describe('punch duration', () => {
  it('measures a completed pair', () => {
    expect(punchDurationMs(punch('a', '2026-08-01T13:00:00Z', '2026-08-01T17:00:00Z'))).toBe(
      4 * 60 * 60 * 1000
    )
  })

  it('counts an open entry as zero so in-progress shifts never inflate totals', () => {
    expect(punchDurationMs(punch('a', '2026-08-01T13:00:00Z', null))).toBe(0)
  })

  it('never returns a negative duration', () => {
    expect(punchDurationMs(punch('a', '2026-08-01T17:00:00Z', '2026-08-01T13:00:00Z'))).toBe(0)
  })
})

describe('groupEntriesByDay', () => {
  it('sums a lunch-split day into one total across two pairs', () => {
    // In 08:00-12:00, out for lunch, back in 13:00-17:00 local (EDT).
    const entries = [
      punch('morning', '2026-08-01T12:00:00Z', '2026-08-01T16:00:00Z', 'Order packing'),
      punch('afternoon', '2026-08-01T17:00:00Z', '2026-08-01T21:00:00Z', 'Label printing'),
    ]

    const days = groupEntriesByDay(entries)

    expect(days).toHaveLength(1)
    expect(days[0].dayKey).toBe('2026-08-01')
    expect(days[0].entries).toHaveLength(2)
    expect(days[0].totalMs).toBe(8 * 60 * 60 * 1000)
    expect(formatDecimalHours(days[0].totalMs)).toBe('8.00')
  })

  it('excludes an open entry from the day total but keeps the row', () => {
    const entries = [
      punch('morning', '2026-08-01T12:00:00Z', '2026-08-01T16:00:00Z'),
      punch('open', '2026-08-01T17:00:00Z', null),
    ]

    const days = groupEntriesByDay(entries)

    expect(days[0].entries).toHaveLength(2)
    expect(days[0].totalMs).toBe(4 * 60 * 60 * 1000)
  })

  it('files an overnight shift under the day it started', () => {
    // In 2026-08-01 21:00 EDT, out 2026-08-02 05:00 EDT.
    const days = groupEntriesByDay([punch('night', '2026-08-02T01:00:00Z', '2026-08-02T09:00:00Z')])

    expect(days).toHaveLength(1)
    expect(days[0].dayKey).toBe('2026-08-01')
    expect(days[0].totalMs).toBe(8 * 60 * 60 * 1000)
  })

  it('orders days newest first and punches within a day oldest first', () => {
    const days = groupEntriesByDay([
      punch('b', '2026-08-01T17:00:00Z', '2026-08-01T21:00:00Z'),
      punch('c', '2026-08-03T12:00:00Z', '2026-08-03T16:00:00Z'),
      punch('a', '2026-08-01T12:00:00Z', '2026-08-01T16:00:00Z'),
    ])

    expect(days.map(d => d.dayKey)).toEqual(['2026-08-03', '2026-08-01'])
    expect(days[1].entries.map(e => e.id)).toEqual(['a', 'b'])
  })

  it('measures a shift spanning spring-forward in real elapsed time', () => {
    // 2026-03-08: in at 01:00 EST, out at 05:00 EDT — 3 wall-clock-labelled
    // hours, but only 3 real hours of work because 02:00 never happened.
    const days = groupEntriesByDay([punch('dst', '2026-03-08T06:00:00Z', '2026-03-08T09:00:00Z')])

    expect(days[0].dayKey).toBe('2026-03-08')
    expect(formatDecimalHours(days[0].totalMs)).toBe('3.00')
  })
})

describe('totalDurationMs', () => {
  it('sums completed pairs across days and ignores open ones', () => {
    const total = totalDurationMs([
      punch('a', '2026-08-01T12:00:00Z', '2026-08-01T16:00:00Z'),
      punch('b', '2026-08-02T12:00:00Z', '2026-08-02T16:30:00Z'),
      punch('open', '2026-08-03T12:00:00Z', null),
    ])

    expect(formatDecimalHours(total)).toBe('8.50')
  })
})

describe('range bounds', () => {
  const now = new Date('2026-08-01T16:00:00Z')

  it('spans two months either side of today', () => {
    expect(timeClockRangeBounds(now)).toEqual({
      earliest: { year: 2026, month: 6, day: 1 },
      latest: { year: 2026, month: 10, day: 1 },
    })
  })

  it('clamps dates outside the window', () => {
    expect(clampToRange({ year: 2025, month: 1, day: 1 }, now)).toEqual({
      year: 2026,
      month: 6,
      day: 1,
    })
    expect(clampToRange({ year: 2027, month: 1, day: 1 }, now)).toEqual({
      year: 2026,
      month: 10,
      day: 1,
    })
    expect(clampToRange({ year: 2026, month: 7, day: 15 }, now)).toEqual({
      year: 2026,
      month: 7,
      day: 15,
    })
  })

  it('clamps the day when the target month is shorter', () => {
    expect(addMonths({ year: 2026, month: 3, day: 31 }, -1)).toEqual({
      year: 2026,
      month: 2,
      day: 28,
    })
  })
})

describe('sumDayPayrollHours', () => {
  // 7h 30m 18s displays as 7.51; three of them must read as 22.53, not 22.52.
  const awkwardMs = (7 * 3600 + 30 * 60 + 18) * 1000

  it('matches the sum of the day figures shown on screen', () => {
    const days = [{ totalMs: awkwardMs }, { totalMs: awkwardMs }, { totalMs: awkwardMs }]
    const displayed = days.map(d => Number(formatDecimalHours(d.totalMs)))

    expect(displayed).toEqual([7.51, 7.51, 7.51])
    expect(sumDayPayrollHours(days).toFixed(2)).toBe(
      displayed.reduce((a, b) => a + b, 0).toFixed(2)
    )
    expect(sumDayPayrollHours(days).toFixed(2)).toBe('22.53')
  })

  it('does not drift over a long pay period', () => {
    const days = Array.from({ length: 20 }, () => ({ totalMs: awkwardMs }))
    expect(sumDayPayrollHours(days).toFixed(2)).toBe('150.20')
  })

  it('is zero for an empty period', () => {
    expect(sumDayPayrollHours([])).toBe(0)
  })

  it('reconciles with the rows for a lunch-split day', () => {
    const days = groupEntriesByDay([
      punch('morning', '2026-08-01T12:00:00Z', '2026-08-01T16:00:00Z'),
      punch('afternoon', '2026-08-01T17:00:00Z', '2026-08-01T21:00:00Z'),
    ])
    expect(sumDayPayrollHours(days).toFixed(2)).toBe('8.00')
  })
})

describe('resolveRange', () => {
  const now = new Date('2026-08-01T16:00:00Z')

  it('defaults to the earliest allowed date through today', () => {
    expect(resolveRange(null, null, now)).toEqual({
      start: { year: 2026, month: 6, day: 1 },
      end: { year: 2026, month: 8, day: 1 },
    })
  })

  it('honours a pay period the user typed', () => {
    expect(resolveRange('07/13/2026', '07/26/2026', now)).toEqual({
      start: { year: 2026, month: 7, day: 13 },
      end: { year: 2026, month: 7, day: 26 },
    })
  })

  it('falls back rather than throwing on unparseable input', () => {
    expect(resolveRange('not-a-date', '2026-07-26', now)).toEqual({
      start: { year: 2026, month: 6, day: 1 },
      end: { year: 2026, month: 8, day: 1 },
    })
  })

  it('clamps a request that reaches outside the allowed window', () => {
    expect(resolveRange('01/01/2020', '12/31/2030', now)).toEqual({
      start: { year: 2026, month: 6, day: 1 },
      end: { year: 2026, month: 10, day: 1 },
    })
  })

  it('collapses a backwards range to a single day instead of returning nothing', () => {
    expect(resolveRange('07/26/2026', '07/13/2026', now)).toEqual({
      start: { year: 2026, month: 7, day: 26 },
      end: { year: 2026, month: 7, day: 26 },
    })
  })

  it('allows a range that looks forward, since the window extends ahead', () => {
    expect(resolveRange('08/01/2026', '09/15/2026', now)).toEqual({
      start: { year: 2026, month: 8, day: 1 },
      end: { year: 2026, month: 9, day: 15 },
    })
  })
})

describe('formatting', () => {
  it('formats readable durations', () => {
    expect(formatDuration(0)).toBe('0h 00m')
    expect(formatDuration(8 * 60 * 60 * 1000)).toBe('8h 00m')
    expect(formatDuration(8.25 * 60 * 60 * 1000)).toBe('8h 15m')
    expect(formatDuration(35 * 60 * 1000)).toBe('0h 35m')
  })

  it('formats payroll decimals to hundredths', () => {
    expect(formatDecimalHours(0)).toBe('0.00')
    expect(formatDecimalHours(8.25 * 60 * 60 * 1000)).toBe('8.25')
    expect(formatDecimalHours(20 * 60 * 1000)).toBe('0.33')
  })
})
