import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, failFromError } from '@/lib/api'
import { getConnection } from '@/lib/events/google-calendar-client'
import { isProviderConfigured } from '@/lib/social/credentials'

/**
 * GET /api/admin/events/google/status
 *
 * What the admin panel needs to render the integration card: whether an OAuth
 * client exists at all, whether a calendar is linked, and what the last run did.
 */
export async function GET() {
  try {
    await requirePermission('events:read')

    const [connection, oauthConfigured, conflicts] = await Promise.all([
      getConnection(),
      isProviderConfigured('google'),
      prisma.featuredEvent.count({ where: { googleSyncState: 'CONFLICT' } }),
    ])

    return ok({
      oauthConfigured,
      // The legacy one-way pull only ever needed this env var; the card still
      // reports it so an unconnected install can explain itself.
      defaultCalendarId: process.env.GOOGLE_CALENDAR_ID?.trim() || null,
      connected: Boolean(connection),
      calendarId: connection?.calendarId ?? null,
      googleEmail: connection?.googleEmail ?? null,
      conflictPolicy: connection?.conflictPolicy ?? 'ASK',
      lastPullAt: connection?.lastPullAt ?? null,
      lastPushAt: connection?.lastPushAt ?? null,
      lastPullCount: connection?.lastPullCount ?? 0,
      lastPushCount: connection?.lastPushCount ?? 0,
      connectionError: connection?.connectionError ?? null,
      conflicts,
    })
  } catch (error) {
    return failFromError(error, 'Failed to read the Google Calendar status')
  }
}
