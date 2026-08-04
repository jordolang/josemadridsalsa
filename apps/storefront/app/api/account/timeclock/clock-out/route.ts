import { NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, fail, forbidden, unauthorized, serverError } from '@/lib/api'
import { getRequestMetadata } from '@/lib/audit'
import { getCurrentUser, isStaff } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const clockOutSchema = z.object({
  notes: z.string().trim().max(2000).optional(),
})

/**
 * POST /api/account/timeclock/clock-out
 * Close the caller's open punch and attach their notes / job duties. This is
 * the only moment notes can be written — there is deliberately no route that
 * updates or deletes a punch once it is closed.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized()
    if (!isStaff(user)) return forbidden('Timeclock access is limited to staff accounts')

    const body = await request.json().catch(() => ({}))
    const parsed = clockOutSchema.safeParse(body)
    if (!parsed.success) {
      return fail('Invalid notes', 400, parsed.error.issues)
    }

    const open = await prisma.timeClockEntry.findFirst({
      where: { userId: user.id, clockOutAt: null },
      orderBy: { clockInAt: 'desc' },
      select: { id: true },
    })

    if (!open) {
      return fail('You are not currently clocked in.', 409)
    }

    const { ipAddress } = getRequestMetadata(request)
    const notes = parsed.data.notes?.trim()

    // Scoped to the caller and to a still-open row, so two concurrent requests
    // can't both close the same punch.
    const result = await prisma.timeClockEntry.updateMany({
      where: { id: open.id, userId: user.id, clockOutAt: null },
      data: {
        clockOutAt: new Date(),
        clockOutIp: ipAddress,
        notes: notes && notes.length > 0 ? notes : null,
      },
    })

    if (result.count === 0) {
      return fail('You are not currently clocked in.', 409)
    }

    const entry = await prisma.timeClockEntry.findUnique({
      where: { id: open.id },
      select: { id: true, clockInAt: true, clockOutAt: true, clockOutIp: true, notes: true },
    })

    return ok({
      id: entry!.id,
      clockInAt: entry!.clockInAt.toISOString(),
      clockOutAt: entry!.clockOutAt!.toISOString(),
      clockOutIp: entry!.clockOutIp,
      notes: entry!.notes,
      durationMs: entry!.clockOutAt!.getTime() - entry!.clockInAt.getTime(),
    })
  } catch (error: unknown) {
    return serverError('Failed to clock out', error)
  }
}
