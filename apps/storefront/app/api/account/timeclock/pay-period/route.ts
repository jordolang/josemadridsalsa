import { NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, fail, forbidden, unauthorized, serverError } from '@/lib/api'
import { getRequestMetadata } from '@/lib/audit'
import { getCurrentUser, isStaff } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import {
  businessCalendarDate,
  compareCalendarDates,
  formatDateInput,
  parseDateInput,
  startOfBusinessDay,
  TIMECLOCK_EPOCH,
} from '@/lib/timeclock'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const payPeriodSchema = z.object({
  /** `MM/DD/YYYY`; defaults to today. */
  start: z.string().trim().optional(),
})

/**
 * POST /api/account/timeclock/pay-period
 * Start a new pay period for the caller on the given day (today by default).
 * The period runs until the next one is started. Punches are never removed;
 * this only moves where the default view and its total begin. A start can be
 * backdated to any day since the timeclock went live, but not set in the future.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized()
    if (!isStaff(user)) return forbidden('Timeclock access is limited to staff accounts')

    const body = await request.json().catch(() => ({}))
    const parsed = payPeriodSchema.safeParse(body)
    if (!parsed.success) {
      return fail('Invalid pay period', 400, parsed.error.issues)
    }

    const today = businessCalendarDate(new Date())
    const start = parsed.data.start ? parseDateInput(parsed.data.start) : today
    if (!start) return fail('Enter the start date as MM/DD/YYYY', 400)
    if (compareCalendarDates(start, today) > 0) {
      return fail('A pay period cannot start in the future', 400)
    }
    if (compareCalendarDates(start, TIMECLOCK_EPOCH) < 0) {
      return fail(`A pay period cannot start before ${formatDateInput(TIMECLOCK_EPOCH)}`, 400)
    }

    const { ipAddress, userAgent } = getRequestMetadata(request)
    const period = await prisma.$transaction(async (tx) => {
      const created = await tx.timeClockPayPeriod.create({
        data: { userId: user.id, startsAt: startOfBusinessDay(start) },
        select: { id: true, startsAt: true },
      })
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'TIMECLOCK_PAY_PERIOD_START',
          entityType: 'TimeClockPayPeriod',
          entityId: created.id,
          ipAddress,
          userAgent,
          changes: { start: formatDateInput(start) },
        },
      })
      return created
    })

    return ok({ id: period.id, start: formatDateInput(start) }, 201)
  } catch (error: unknown) {
    return serverError('Failed to start pay period', error)
  }
}
