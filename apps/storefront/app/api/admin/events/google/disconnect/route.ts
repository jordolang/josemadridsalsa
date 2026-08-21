import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail, failFromError } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { getConnection } from '@/lib/events/google-calendar-client'

/**
 * POST /api/admin/events/google/disconnect
 *
 * Drops the stored tokens. Events already on the calendar are left there and
 * local records keep their `googleEventId`, so reconnecting the same calendar
 * picks the pairs back up instead of duplicating every show.
 */
export async function POST() {
  try {
    const user = await requirePermission('events:sync-calendar')

    const connection = await getConnection()
    if (!connection) return fail('Google Calendar is not connected.', 400)

    await prisma.googleCalendarConnection.delete({ where: { id: connection.id } })

    await logAudit({
      userId: user.id,
      action: 'disconnect',
      entityType: 'google_calendar_connection',
      entityId: connection.calendarId,
      changes: {},
    })

    return ok({ disconnected: true })
  } catch (error) {
    return failFromError(error, 'Failed to disconnect Google Calendar')
  }
}
