import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail, failFromError } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { getConnection } from '@/lib/events/google-calendar-client'

const SettingsSchema = z.object({
  conflictPolicy: z.enum(['LOCAL_WINS', 'GOOGLE_WINS', 'ASK']),
})

/**
 * PATCH /api/admin/events/google/settings
 *
 * Currently just the conflict policy: what happens when an event changed here
 * and on Google since the last sync.
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requirePermission('events:sync-calendar')

    const connection = await getConnection()
    if (!connection) return fail('Google Calendar is not connected.', 400)

    const parsed = SettingsSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return fail('Invalid settings', 400, parsed.error.issues)
    }

    await prisma.googleCalendarConnection.update({
      where: { id: connection.id },
      data: { conflictPolicy: parsed.data.conflictPolicy },
    })

    await logAudit({
      userId: user.id,
      action: 'update',
      entityType: 'google_calendar_connection',
      entityId: connection.calendarId,
      changes: { conflictPolicy: parsed.data.conflictPolicy },
    })

    return ok({ conflictPolicy: parsed.data.conflictPolicy })
  } catch (error) {
    return failFromError(error, 'Failed to update the sync settings')
  }
}
