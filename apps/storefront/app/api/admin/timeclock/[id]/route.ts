import { NextRequest } from 'next/server'
import { ok, fail, forbidden, unauthorized, serverError } from '@/lib/api'
import { getRequestMetadata } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { punchCorrectionSchema, resolvePunchCorrection } from '@/lib/timeclock-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * PATCH /api/admin/timeclock/:id
 * Correct a punch's times and job duties. Employees can only clock in and out,
 * so this is the one place a punch changes after the fact; every correction
 * writes an audit entry with the before/after values, who made it, and why.
 *
 * The read, the overlap check, the update and the audit entry share one serializable
 * transaction: a correction is never saved without its audit record, and two
 * concurrent corrections can't both pass the overlap check.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let admin: Awaited<ReturnType<typeof requirePermission>>
  try {
    admin = await requirePermission('users:write')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : ''
    return message.includes('Unauthorized') ? unauthorized() : forbidden(message || undefined)
  }

  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const parsed = punchCorrectionSchema.safeParse(body)
    if (!parsed.success) {
      return fail('Invalid punch correction', 400, parsed.error.issues)
    }

    const { ipAddress, userAgent } = getRequestMetadata(request)
    const result = await prisma.$transaction(
      async (tx) => {
        // Read inside the transaction so the audit "before" is what was overwritten.
        const existing = await tx.timeClockEntry.findUnique({
          where: { id },
          select: { id: true, userId: true, clockInAt: true, clockOutAt: true, notes: true },
        })
        if (!existing) return 'not-found' as const

        const correction = resolvePunchCorrection(parsed.data, existing)
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
          data: {
            clockInAt: correction.clockInAt,
            clockOutAt: correction.clockOutAt,
            notes: correction.notes,
          },
          select: { id: true, clockInAt: true, clockOutAt: true, notes: true },
        })

        await tx.auditLog.create({
          data: {
            userId: admin.id,
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
    if (result === 'overlap') return fail('These times overlap another punch for this employee', 409)
    if (!result.ok) return fail(result.error, 400)
    const updated = result.entry

    return ok({
      id: updated.id,
      clockInAt: updated.clockInAt.toISOString(),
      clockOutAt: updated.clockOutAt!.toISOString(),
      notes: updated.notes,
    })
  } catch (error: unknown) {
    if ((error as { code?: string } | null)?.code === 'P2034') {
      return fail('Another change to these punches was saved at the same time. Try again.', 409)
    }
    return serverError('Failed to correct punch', error)
  }
}
