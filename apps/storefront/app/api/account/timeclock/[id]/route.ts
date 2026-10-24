import { NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, fail, forbidden, unauthorized, serverError } from '@/lib/api'
import { getRequestMetadata } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, isDeveloper } from '@/lib/rbac'
import { resolvePunchCorrection } from '@/lib/timeclock-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const clockOutCorrectionSchema = z.object({
  /** Business-local `YYYY-MM-DDTHH:mm`, as the `datetime-local` input sends it. */
  clockOutAt: z.string().min(1, 'Set a clock-out time'),
  reason: z.string().trim().min(3, 'Give a reason for the correction').max(500),
})

/**
 * PATCH /api/account/timeclock/:id
 * Change the clock-out time of one of the caller's own punches, from the
 * timeclock window. Developer accounts only; other punches are corrected
 * through the developer-only `PATCH /api/admin/timeclock/:id`.
 *
 * Clock-in and notes are kept as stored. Like the admin correction, the read,
 * overlap check, update and audit entry share one serializable transaction.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized()
    if (!isDeveloper(user)) return forbidden('Only developer accounts can edit punch times')

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const parsed = clockOutCorrectionSchema.safeParse(body)
    if (!parsed.success) {
      return fail('Invalid clock-out correction', 400, parsed.error.issues)
    }

    const { ipAddress, userAgent } = getRequestMetadata(request)
    const result = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.timeClockEntry.findUnique({
          where: { id },
          select: { id: true, userId: true, clockInAt: true, clockOutAt: true, notes: true },
        })
        if (!existing || existing.userId !== user.id) return 'not-found' as const

        const correction = resolvePunchCorrection(
          { clockOutAt: parsed.data.clockOutAt, notes: existing.notes ?? '', reason: parsed.data.reason },
          existing
        )
        if (!correction.ok) return correction

        // Overlapping punches would pay the same minutes twice.
        const overlap = await tx.timeClockEntry.findFirst({
          where: {
            userId: existing.userId,
            id: { not: id },
            clockInAt: { lt: correction.clockOutAt },
            OR: [{ clockOutAt: null }, { clockOutAt: { gt: correction.clockInAt } }],
          },
          select: { id: true },
        })
        if (overlap) return 'overlap' as const

        const entry = await tx.timeClockEntry.update({
          where: { id },
          data: { clockOutAt: correction.clockOutAt },
          select: { id: true, clockInAt: true, clockOutAt: true, notes: true },
        })

        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'TIMECLOCK_CORRECTION',
            entityType: 'TimeClockEntry',
            entityId: id,
            ipAddress,
            userAgent,
            changes: {
              employeeId: existing.userId,
              reason: correction.reason,
              before: {
                clockInAt: existing.clockInAt.toISOString(),
                clockOutAt: existing.clockOutAt?.toISOString() ?? null,
                notes: existing.notes,
              },
              after: {
                clockInAt: entry.clockInAt.toISOString(),
                clockOutAt: entry.clockOutAt!.toISOString(),
                notes: entry.notes,
              },
            },
          },
        })

        return { ok: true as const, entry }
      },
      { isolationLevel: 'Serializable' }
    )
    if (result === 'not-found') return fail('Punch not found', 404)
    if (result === 'overlap') return fail('That clock-out overlaps another punch', 409)
    if (!result.ok) return fail(result.error, 400)

    return ok({
      id: result.entry.id,
      clockInAt: result.entry.clockInAt.toISOString(),
      clockOutAt: result.entry.clockOutAt!.toISOString(),
    })
  } catch (error: unknown) {
    if ((error as { code?: string } | null)?.code === 'P2034') {
      return fail('Another change to these punches was saved at the same time. Try again.', 409)
    }
    return serverError('Failed to correct clock-out', error)
  }
}
