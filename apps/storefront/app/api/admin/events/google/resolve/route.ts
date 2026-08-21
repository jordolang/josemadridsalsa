import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail, failFromError } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { getConnection } from '@/lib/events/google-calendar-client'
import { resolveEventConflict } from '@/lib/events/google-calendar-sync'

const ResolveSchema = z.object({
  eventId: z.string().min(1),
  /** Which copy survives; the other is overwritten from it. */
  keep: z.enum(['local', 'google']),
})

/**
 * POST /api/admin/events/google/resolve
 *
 * Settles one event flagged CONFLICT by a sync run under the ASK policy.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('events:sync-calendar')

    const connection = await getConnection()
    if (!connection) return fail('Google Calendar is not connected.', 400)

    const parsed = ResolveSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return fail('Invalid request', 400, parsed.error.issues)
    }

    await resolveEventConflict(connection, parsed.data.eventId, parsed.data.keep)

    await logAudit({
      userId: user.id,
      action: 'update',
      entityType: 'featured_event',
      entityId: parsed.data.eventId,
      changes: { conflictResolvedKeeping: parsed.data.keep },
    })

    const remaining = await prisma.featuredEvent.count({
      where: { googleSyncState: 'CONFLICT' },
    })
    return ok({ resolved: true, remaining })
  } catch (error) {
    return failFromError(error, 'Failed to resolve the conflict')
  }
}
