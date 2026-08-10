import { prisma } from '@/lib/prisma'
import {
  endOfBusinessDay,
  formatDateInput,
  groupEntriesByDay,
  resolveRange,
  startOfBusinessDay,
  timeClockRangeBounds,
  type TimeClockPunch,
} from '@/lib/timeclock'

/** A punch as sent to the browser — timestamps as ISO strings. */
export interface SerializedPunch {
  id: string
  clockInAt: string
  clockOutAt: string | null
  clockInIp: string | null
  clockOutIp: string | null
  notes: string | null
  durationMs: number
}

export interface SerializedDay {
  dayKey: string
  totalMs: number
  entries: SerializedPunch[]
}

export interface TimeClockView {
  serverTime: string
  range: { start: string; end: string }
  bounds: { earliest: string; latest: string }
  openEntry: SerializedPunch | null
  days: SerializedDay[]
}

const PUNCH_SELECT = {
  id: true,
  clockInAt: true,
  clockOutAt: true,
  clockInIp: true,
  clockOutIp: true,
  notes: true,
} as const

function serialize(entry: TimeClockPunch, durationMs: number): SerializedPunch {
  return {
    id: entry.id,
    clockInAt: entry.clockInAt.toISOString(),
    clockOutAt: entry.clockOutAt?.toISOString() ?? null,
    clockInIp: entry.clockInIp,
    clockOutIp: entry.clockOutIp,
    notes: entry.notes,
    durationMs,
  }
}

/** The user's currently open punch, if they are on the clock. */
export async function findOpenEntry(userId: string) {
  return prisma.timeClockEntry.findFirst({
    where: { userId, clockOutAt: null },
    orderBy: { clockInAt: 'desc' },
    select: PUNCH_SELECT,
  })
}

/**
 * Everything the timeclock page renders: the punches inside the requested pay
 * period, grouped into business-local days, plus any open entry (which is
 * included even when it falls outside the window, so the user always sees that
 * they are on the clock).
 */
export async function buildTimeClockView(
  userId: string,
  startInput: string | null,
  endInput: string | null,
  now: Date = new Date()
): Promise<TimeClockView> {
  const { start, end } = resolveRange(startInput, endInput, now)
  const { earliest, latest } = timeClockRangeBounds(now)

  const [entries, openEntry] = await Promise.all([
    prisma.timeClockEntry.findMany({
      where: {
        userId,
        clockInAt: { gte: startOfBusinessDay(start), lte: endOfBusinessDay(end) },
      },
      orderBy: { clockInAt: 'desc' },
      select: PUNCH_SELECT,
    }),
    findOpenEntry(userId),
  ])

  const days = groupEntriesByDay(entries).map(day => ({
    dayKey: day.dayKey,
    totalMs: day.totalMs,
    entries: day.entries.map(entry =>
      serialize(entry, entry.clockOutAt ? entry.clockOutAt.getTime() - entry.clockInAt.getTime() : 0)
    ),
  }))

  return {
    serverTime: now.toISOString(),
    range: { start: formatDateInput(start), end: formatDateInput(end) },
    bounds: { earliest: formatDateInput(earliest), latest: formatDateInput(latest) },
    openEntry: openEntry ? serialize(openEntry, 0) : null,
    days,
  }
}
