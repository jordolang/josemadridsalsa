import { requirePermission } from '@/lib/rbac'
import { ok, fail, failFromError } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { getConnection } from '@/lib/events/google-calendar-client'
import { runGoogleCalendarSync } from '@/lib/events/google-calendar-sync'

/**
 * POST /api/admin/events/google/sync
 *
 * Runs one full reconciliation, both directions.
 */
export async function POST() {
  try {
    const user = await requirePermission('events:sync-calendar')

    const connection = await getConnection()
    if (!connection) {
      return fail('Google Calendar is not connected.', 400)
    }

    const result = await runGoogleCalendarSync(connection)

    await logAudit({
      userId: user.id,
      action: 'sync',
      entityType: 'google_calendar_connection',
      entityId: connection.calendarId,
      changes: {
        pushed: result.pushed,
        pulled: result.pulled,
        deleted: result.deleted,
        conflicts: result.conflicts,
        failed: result.failed,
      },
    })

    return ok(result)
  } catch (error) {
    return failFromError(error, 'The Google Calendar sync failed')
  }
}
