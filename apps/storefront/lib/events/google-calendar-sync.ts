/**
 * The two-way reconciler between FeaturedEvent and one Google Calendar.
 *
 * Reads a window of the calendar, pairs it against our records, asks
 * `google-sync-rules` what each pair needs, and carries it out. The rules and
 * the field mapping live in their own modules and are tested directly; what is
 * here is the ordering, the persistence, and the error containment.
 */

import { prisma } from '@/lib/prisma'
import type { GoogleCalendarConnection } from '@prisma/client'
import {
  deleteEvent,
  getAccessToken,
  insertEvent,
  listEvents,
  updateEvent,
} from './google-calendar-client'
import {
  fromGoogleEvent,
  toGoogleEvent,
  type GoogleEventResource,
} from './google-event-mapping'
import {
  decideSyncAction,
  pairEvents,
  type GoogleConflictPolicy,
  type LocalSide,
  type RemoteSide,
} from './google-sync-rules'

/**
 * How much of the calendar to reconcile per run: a year back, two forward.
 *
 * A bounded window rather than an incremental `syncToken` because the volume is
 * a few dozen shows a year — the whole window is one or two API pages — and a
 * sync token adds an expiry path (410 → full resync) that would be exercised
 * so rarely it could only ever be broken.
 */
const WINDOW_DAYS_BACK = 365
const WINDOW_DAYS_FORWARD = 730

export interface SyncResult {
  pushed: number
  pulled: number
  deleted: number
  unlinked: number
  conflicts: number
  failed: number
  /** Human-readable, one per event that could not be settled. */
  errors: string[]
}

function syncWindow(now: Date) {
  return {
    timeMin: new Date(now.getTime() - WINDOW_DAYS_BACK * 86_400_000),
    timeMax: new Date(now.getTime() + WINDOW_DAYS_FORWARD * 86_400_000),
  }
}

function toLocalSide(event: {
  isWhereIsJose: boolean
  updatedAt: Date
  googleSyncedAt: Date | null
  googleEventId: string | null
  googleEtag: string | null
}): LocalSide {
  return {
    isWhereIsJose: event.isWhereIsJose,
    updatedAt: event.updatedAt,
    pushedAt: event.googleSyncedAt,
    googleEventId: event.googleEventId,
    googleEtag: event.googleEtag,
  }
}

function toRemoteSide(resource: GoogleEventResource): RemoteSide {
  return {
    id: resource.id,
    etag: resource.etag ?? '',
    cancelled: resource.status === 'cancelled',
  }
}

/**
 * Marks the pair agreed. Written in the same update as the content change so
 * `googleSyncedAt` can never lag the `updatedAt` it is compared against — that
 * skew would make every synced event look locally dirty forever.
 */
function agreedFields(resource: GoogleEventResource, now: Date) {
  return {
    googleEventId: resource.id,
    googleEtag: resource.etag ?? null,
    googleSyncedAt: now,
    googleSyncState: 'IN_SYNC' as const,
    googleSyncError: null,
    lastGoogleSync: now,
  }
}

export async function runGoogleCalendarSync(
  connection: GoogleCalendarConnection,
  now = new Date()
): Promise<SyncResult> {
  const result: SyncResult = {
    pushed: 0,
    pulled: 0,
    deleted: 0,
    unlinked: 0,
    conflicts: 0,
    failed: 0,
    errors: [],
  }

  const accessToken = await getAccessToken(connection)
  const window = syncWindow(now)
  const remotes = await listEvents(accessToken, connection.calendarId, window)

  // Local side: everything in the window, plus anything already linked to
  // Google whatever its date — a linked event dragged outside the window still
  // needs its link maintained.
  const locals = await prisma.featuredEvent.findMany({
    where: {
      OR: [
        { startDate: { gte: window.timeMin, lte: window.timeMax } },
        { googleEventId: { not: null } },
      ],
    },
  })

  const policy = connection.conflictPolicy as GoogleConflictPolicy
  const pairs = pairEvents(locals, remotes)

  for (const { local, remote } of pairs) {
    const action = decideSyncAction(
      {
        local: local ? toLocalSide(local) : null,
        remote: remote ? toRemoteSide(remote) : null,
      },
      policy
    )

    if (action === 'none') continue

    try {
      switch (action) {
        case 'push_create': {
          const created = await insertEvent(
            accessToken,
            connection.calendarId,
            toGoogleEvent(local!)
          )
          await prisma.featuredEvent.update({
            where: { id: local!.id },
            data: agreedFields(created, now),
          })
          result.pushed++
          break
        }

        case 'push_update': {
          const updated = await updateEvent(
            accessToken,
            connection.calendarId,
            remote!.id,
            toGoogleEvent(local!)
          )
          await prisma.featuredEvent.update({
            where: { id: local!.id },
            data: agreedFields(updated, now),
          })
          result.pushed++
          break
        }

        case 'push_delete': {
          await deleteEvent(accessToken, connection.calendarId, remote!.id)
          await prisma.featuredEvent.update({
            where: { id: local!.id },
            data: {
              googleEventId: null,
              googleEtag: null,
              googleSyncedAt: now,
              googleSyncState: 'IN_SYNC',
              googleSyncError: null,
            },
          })
          result.deleted++
          break
        }

        case 'pull_create': {
          const parsed = fromGoogleEvent(remote!)
          if (!parsed) break
          await prisma.featuredEvent.create({
            data: {
              ...parsed,
              featuredFrom: parsed.startDate,
              featuredTo: parsed.endDate,
              // Pulled in from the calendar the public page reads, so it is by
              // definition a "Where is Jose?" show.
              isWhereIsJose: true,
              source: 'GOOGLE_CALENDAR',
              ...agreedFields(remote!, now),
            },
          })
          result.pulled++
          break
        }

        case 'pull_update': {
          const parsed = fromGoogleEvent(remote!)
          if (!parsed) break
          await prisma.featuredEvent.update({
            where: { id: local!.id },
            data: { ...parsed, ...agreedFields(remote!, now) },
          })
          result.pulled++
          break
        }

        case 'unlink': {
          await prisma.featuredEvent.update({
            where: { id: local!.id },
            data: {
              googleEventId: null,
              googleEtag: null,
              googleSyncedAt: now,
              googleSyncState: 'IN_SYNC',
              googleSyncError: null,
            },
          })
          result.unlinked++
          break
        }

        case 'conflict': {
          await prisma.featuredEvent.update({
            where: { id: local!.id },
            data: {
              googleSyncState: 'CONFLICT',
              googleSyncError:
                'Changed here and on Google since the last sync. Pick which copy to keep.',
            },
          })
          result.conflicts++
          break
        }
      }
    } catch (error) {
      // One bad event must not abandon the rest of the calendar.
      const message = error instanceof Error ? error.message : String(error)
      result.failed++
      result.errors.push(`${local?.title ?? remote?.summary ?? 'Event'}: ${message}`)

      if (local) {
        await prisma.featuredEvent.update({
          where: { id: local.id },
          data: { googleSyncState: 'PUSH_FAILED', googleSyncError: message },
        })
      }
    }
  }

  await prisma.googleCalendarConnection.update({
    where: { id: connection.id },
    data: {
      lastPullAt: now,
      lastPushAt: now,
      lastPullCount: result.pulled,
      lastPushCount: result.pushed,
      connectionError: result.errors[0] ?? null,
    },
  })

  return result
}

/**
 * Settles one flagged conflict the way the admin chose. `keep` names the copy
 * that survives; the other side is overwritten from it on the next sync, which
 * this triggers immediately for that single event.
 */
export async function resolveEventConflict(
  connection: GoogleCalendarConnection,
  eventId: string,
  keep: 'local' | 'google'
): Promise<void> {
  const event = await prisma.featuredEvent.findUnique({ where: { id: eventId } })
  if (!event) throw new Error('Event not found')
  if (!event.googleEventId) throw new Error('This event is not linked to Google Calendar')

  const accessToken = await getAccessToken(connection)
  const now = new Date()

  if (keep === 'local') {
    const updated = await updateEvent(
      accessToken,
      connection.calendarId,
      event.googleEventId,
      toGoogleEvent(event)
    )
    await prisma.featuredEvent.update({
      where: { id: event.id },
      data: agreedFields(updated, now),
    })
    return
  }

  const remotes = await listEvents(accessToken, connection.calendarId, syncWindow(now))
  const resource = remotes.find((r) => r.id === event.googleEventId)
  if (!resource) throw new Error('The Google copy no longer exists')

  const parsed = fromGoogleEvent(resource)
  if (!parsed) throw new Error('The Google copy has no usable date')

  await prisma.featuredEvent.update({
    where: { id: event.id },
    data: { ...parsed, ...agreedFields(resource, now) },
  })
}
