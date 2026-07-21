import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { getCalendarEvents } from '@/lib/server/google-data'

/**
 * POST /api/admin/events/calendar-sync
 *
 * Imports the events from the public Google Calendar feed (the same feed the
 * homepage and "Where is Jose?" page read) into the database so they can be
 * managed here. Events are matched by their calendar UID (stored as
 * googleEventId). Events that have been manually edited in the admin are left
 * untouched so local changes are never clobbered by a sync.
 */
export async function POST(_req: NextRequest) {
  try {
    const user = await requirePermission('events:sync-calendar')

    const calendarId = process.env.GOOGLE_CALENDAR_ID?.trim()
    if (!calendarId) {
      return fail(
        'Google Calendar is not configured. Set GOOGLE_CALENDAR_ID to enable sync.',
        400
      )
    }

    const calendarEvents = await getCalendarEvents(100)

    let created = 0
    let updated = 0
    let skipped = 0
    const errors: string[] = []

    for (const ev of calendarEvents) {
      if (!ev.id || !ev.start) continue
      try {
        const startDate = new Date(ev.start)
        const endDate = ev.end ? new Date(ev.end) : null

        const existing = await prisma.featuredEvent.findUnique({
          where: { googleEventId: ev.id },
        })

        const data = {
          title: ev.title || 'Untitled Event',
          description: ev.description ?? null,
          location: ev.location ?? null,
          startDate,
          endDate,
          featuredFrom: startDate,
          featuredTo: endDate,
          lastGoogleSync: new Date(),
        }

        if (existing) {
          if (existing.manuallyModified) {
            skipped++
            continue
          }
          await prisma.featuredEvent.update({
            where: { id: existing.id },
            data,
          })
          updated++
        } else {
          await prisma.featuredEvent.create({
            data: { ...data, googleEventId: ev.id },
          })
          created++
        }
      } catch (err) {
        errors.push(`${ev.title || ev.id}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    await logAudit({
      userId: user.id,
      action: 'events.calendar-sync',
      entityType: 'featuredEvent',
      changes: { created, updated, skipped },
    })

    return ok({ created, updated, skipped, errors })
  } catch (error: any) {
    console.error('[POST /api/admin/events/calendar-sync] Error:', error)
    return fail(error.message || 'Failed to sync calendar', 500)
  }
}
