import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  endOfBusinessDay,
  formatDateInput,
  punchDurationMs,
  resolveRange,
  startOfBusinessDay,
  timeClockRangeBounds,
} from '@/lib/timeclock'

/** Roles that can clock in (see `isStaff`), so the ones with punches to edit. */
const CLOCK_ROLES: UserRole[] = [UserRole.STAFF, UserRole.ADMIN, UserRole.DEVELOPER]

export interface DeveloperTimeclockPunch {
  id: string
  employee: { id: string; name: string }
  clockInAt: Date
  clockOutAt: Date | null
  notes: string | null
}

export interface DeveloperTimeclockView {
  range: { start: string; end: string }
  bounds: { earliest: string; latest: string }
  employees: { id: string; name: string }[]
  /** The employee filter actually applied; null means everyone. */
  selectedUserId: string | null
  punches: DeveloperTimeclockPunch[]
  /** Worked time per employee over the range, completed pairs only. */
  totals: { employeeId: string; name: string; totalMs: number }[]
}

function displayName(user: { name: string | null; email: string }): string {
  return user.name || user.email
}

/**
 * Everything the Developer Console timeclock page renders: every employee's
 * punches in the requested period (or one employee's), newest first. The range
 * is clamped to the same ±2 month window as the employee view.
 */
export async function loadDeveloperTimeclock({
  userId,
  startInput,
  endInput,
  now = new Date(),
}: {
  userId: string | null
  startInput: string | null
  endInput: string | null
  now?: Date
}): Promise<DeveloperTimeclockView> {
  const { start, end } = resolveRange(startInput, endInput, now)
  const { earliest, latest } = timeClockRangeBounds(now)

  const users = await prisma.user.findMany({
    where: { OR: [{ role: { in: CLOCK_ROLES } }, { timeClockEntries: { some: {} } }] },
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
    select: { id: true, name: true, email: true },
  })
  const employees = users.map((user) => ({ id: user.id, name: displayName(user) }))
  const selectedUserId = userId && employees.some((e) => e.id === userId) ? userId : null

  const entries = await prisma.timeClockEntry.findMany({
    where: {
      ...(selectedUserId ? { userId: selectedUserId } : {}),
      clockInAt: { gte: startOfBusinessDay(start), lte: endOfBusinessDay(end) },
    },
    orderBy: { clockInAt: 'desc' },
    select: {
      id: true,
      clockInAt: true,
      clockOutAt: true,
      notes: true,
      user: { select: { id: true, name: true, email: true } },
    },
  })

  const punches = entries.map((entry) => ({
    id: entry.id,
    employee: { id: entry.user.id, name: displayName(entry.user) },
    clockInAt: entry.clockInAt,
    clockOutAt: entry.clockOutAt,
    notes: entry.notes,
  }))

  const totalsById = new Map<string, { employeeId: string; name: string; totalMs: number }>()
  for (const punch of punches) {
    const total = totalsById.get(punch.employee.id) ?? {
      employeeId: punch.employee.id,
      name: punch.employee.name,
      totalMs: 0,
    }
    total.totalMs += punchDurationMs(punch)
    totalsById.set(punch.employee.id, total)
  }

  return {
    range: { start: formatDateInput(start), end: formatDateInput(end) },
    bounds: { earliest: formatDateInput(earliest), latest: formatDateInput(latest) },
    employees,
    selectedUserId,
    punches,
    totals: [...totalsById.values()].sort((a, b) => a.name.localeCompare(b.name)),
  }
}
