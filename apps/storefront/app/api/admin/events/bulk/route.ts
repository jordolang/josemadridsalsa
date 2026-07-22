import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { logAudit } from '@/lib/audit'

/**
 * POST /api/admin/events/bulk
 * Applies one action to a set of events: a booking-status change, or deletion.
 */

const VALID_STATUSES = [
  'INTERESTED',
  'APPLIED',
  'WAITLISTED',
  'ACCEPTED',
  'CONFIRMED',
  'DECLINED',
  'CANCELLED',
] as const

const MAX_IDS = 500

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission('events:write')

    const body = await req.json().catch(() => null)
    const ids: unknown = body?.ids
    const action: unknown = body?.action

    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((v) => typeof v === 'string')) {
      return fail('No events selected', 400)
    }
    if (ids.length > MAX_IDS) {
      return fail(`Too many events selected (limit ${MAX_IDS})`, 400)
    }

    if (action === 'status') {
      const status = body?.bookingStatus
      if (!VALID_STATUSES.includes(status)) {
        return fail('Invalid booking status', 400)
      }

      const result = await prisma.featuredEvent.updateMany({
        where: { id: { in: ids } },
        data: { bookingStatus: status },
      })

      await logAudit({
        userId: user.id,
        action: 'events.bulk-status',
        entityType: 'featuredEvent',
        entityId: 'bulk',
        changes: { count: result.count, bookingStatus: status },
      })

      return ok({ updated: result.count })
    }

    if (action === 'delete') {
      // Cascades to staff, contacts, and the manifest — including packed-out
      // history, which is why this path is confirmed in the UI.
      const result = await prisma.featuredEvent.deleteMany({ where: { id: { in: ids } } })

      await logAudit({
        userId: user.id,
        action: 'events.bulk-delete',
        entityType: 'featuredEvent',
        entityId: 'bulk',
        changes: { count: result.count },
      })

      return ok({ deleted: result.count })
    }

    return fail('Unknown action', 400)
  } catch (error: any) {
    console.error('[POST /api/admin/events/bulk] Error:', error)
    return fail(error.message || 'Bulk action failed', 500)
  }
}
