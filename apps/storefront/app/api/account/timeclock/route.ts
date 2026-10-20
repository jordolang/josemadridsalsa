import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { ok, fail, forbidden, unauthorized, serverError } from '@/lib/api'
import { getRequestMetadata } from '@/lib/audit'
import { getCurrentUser, isStaff } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { buildTimeClockView, findOpenEntry, punchLocationSchema } from '@/lib/timeclock-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const clockInSchema = z.object({
  location: punchLocationSchema.optional(),
})

/**
 * GET /api/account/timeclock?start=MM/DD/YYYY&end=MM/DD/YYYY
 * The signed-in staff member's own punches for a pay period.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized()
    if (!isStaff(user)) return forbidden('Timeclock access is limited to staff accounts')

    const { searchParams } = new URL(request.url)
    const view = await buildTimeClockView(
      user.id,
      searchParams.get('start'),
      searchParams.get('end')
    )

    return ok(view)
  } catch (error: unknown) {
    return serverError('Failed to load timeclock', error)
  }
}

/**
 * POST /api/account/timeclock
 * Clock in. The punch time is taken from the server — never from the browser —
 * so the record cannot be moved by changing the client's clock. The body may
 * carry the device's GPS fix; it is recorded when present.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized()
    if (!isStaff(user)) return forbidden('Timeclock access is limited to staff accounts')

    const body = await request.json().catch(() => ({}))
    const parsed = clockInSchema.safeParse(body)
    if (!parsed.success) {
      return fail('Invalid location', 400, parsed.error.issues)
    }

    const existing = await findOpenEntry(user.id)
    if (existing) {
      return fail('You are already clocked in. Clock out before starting a new shift.', 409)
    }

    const { ipAddress } = getRequestMetadata(request)
    const { location } = parsed.data

    const entry = await prisma.timeClockEntry.create({
      data: {
        userId: user.id,
        clockInAt: new Date(),
        clockInIp: ipAddress,
        clockInLatitude: location?.latitude ?? null,
        clockInLongitude: location?.longitude ?? null,
        clockInAccuracyMeters: location?.accuracyMeters ?? null,
      },
      select: { id: true, clockInAt: true, clockInIp: true },
    })

    return ok(
      {
        id: entry.id,
        clockInAt: entry.clockInAt.toISOString(),
        clockInIp: entry.clockInIp,
      },
      201
    )
  } catch (error: unknown) {
    // The partial unique index catches a double-click that slipped past the
    // check above.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return fail('You are already clocked in. Clock out before starting a new shift.', 409)
    }
    return serverError('Failed to clock in', error)
  }
}
