import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import {
  type ColumnMapping,
  type ParsedRow,
  fallbackKey,
  parseFestivalNetCsv,
} from '@/lib/events/festivalnet-import'

/**
 * POST /api/admin/events/import
 *
 * Imports a FestivalNet "Export My List" CSV. Runs as a dry run by default —
 * nothing is written unless `commit` is true — because their export re-sends
 * the whole list every time and is billed per record, so a blind import is
 * both a duplicate risk and a waste of money.
 */

const MAX_ROWS = 2000

type RowAction = 'create' | 'update' | 'error'

interface PreviewRow {
  rowNumber: number
  title: string
  location: string | null
  startDate: string | null
  applicationDeadline: string | null
  boothFee: number | null
  action: RowAction
  reason: string | null
  /** Existing event this row resolved to, when updating. */
  matchedId: string | null
}

const VALID_STATUSES = [
  'INTERESTED',
  'APPLIED',
  'WAITLISTED',
  'ACCEPTED',
  'CONFIRMED',
  'DECLINED',
  'CANCELLED',
] as const

type BookingStatus = (typeof VALID_STATUSES)[number]

/**
 * Resolves each parsed row to an existing event, if any. Prefers FestivalNet's
 * own id; falls back to name + start date for rows that lack one.
 */
async function resolveMatches(rows: ParsedRow[]) {
  const usable = rows.filter((r) => !r.error && r.startDate)
  const byExternalId = new Map<string, string>()
  const byFallback = new Map<string, string>()

  if (usable.length === 0) return { byExternalId, byFallback }

  const externalIds = usable.map((r) => r.externalId).filter((v): v is string => Boolean(v))

  if (externalIds.length > 0) {
    const matches = await prisma.featuredEvent.findMany({
      where: { source: 'FESTIVALNET', externalId: { in: externalIds } },
      select: { id: true, externalId: true },
    })
    for (const m of matches) {
      if (m.externalId) byExternalId.set(m.externalId, m.id)
    }
  }

  // Narrow the fallback scan to the date span actually present in the file.
  const times = usable.map((r) => r.startDate!.getTime())
  const from = new Date(Math.min(...times))
  const to = new Date(Math.max(...times))
  from.setDate(from.getDate() - 1)
  to.setDate(to.getDate() + 1)

  const candidates = await prisma.featuredEvent.findMany({
    where: { startDate: { gte: from, lte: to } },
    select: { id: true, title: true, startDate: true },
  })
  for (const c of candidates) {
    byFallback.set(fallbackKey(c.title, c.startDate), c.id)
  }

  return { byExternalId, byFallback }
}

function planRow(
  row: ParsedRow,
  byExternalId: Map<string, string>,
  byFallback: Map<string, string>
): PreviewRow {
  const base = {
    rowNumber: row.rowNumber,
    title: row.title,
    location: row.location,
    startDate: row.startDate?.toISOString() ?? null,
    applicationDeadline: row.applicationDeadline?.toISOString() ?? null,
    boothFee: row.boothFee,
  }

  if (row.error || !row.startDate) {
    return { ...base, action: 'error', reason: row.error ?? 'Missing start date', matchedId: null }
  }

  const matchedId =
    (row.externalId ? byExternalId.get(row.externalId) : undefined) ??
    byFallback.get(fallbackKey(row.title, row.startDate)) ??
    null

  return {
    ...base,
    action: matchedId ? 'update' : 'create',
    reason: matchedId ? 'Matches an event already on file' : null,
    matchedId,
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission('events:write')

    const body = await req.json().catch(() => null)
    if (!body || typeof body.csv !== 'string' || !body.csv.trim()) {
      return fail('No CSV content provided', 400)
    }

    const commit = body.commit === true
    const mapping: ColumnMapping | undefined =
      body.mapping && typeof body.mapping === 'object' ? body.mapping : undefined

    const defaultStatus: BookingStatus = VALID_STATUSES.includes(body.defaultStatus)
      ? body.defaultStatus
      : 'INTERESTED'

    const parsed = parseFestivalNetCsv(body.csv, mapping)

    if (parsed.rows.length === 0) {
      return fail('The file contained no data rows', 400)
    }
    if (parsed.rows.length > MAX_ROWS) {
      return fail(`File has ${parsed.rows.length} rows; the limit is ${MAX_ROWS}`, 400)
    }
    if (parsed.missingRequired.length > 0) {
      return ok({
        headers: parsed.headers,
        mapping: parsed.mapping,
        missingRequired: parsed.missingRequired,
        rows: [],
        summary: { create: 0, update: 0, error: 0 },
        committed: false,
      })
    }

    const { byExternalId, byFallback } = await resolveMatches(parsed.rows)
    const preview = parsed.rows.map((r) => planRow(r, byExternalId, byFallback))

    const summary = {
      create: preview.filter((r) => r.action === 'create').length,
      update: preview.filter((r) => r.action === 'update').length,
      error: preview.filter((r) => r.action === 'error').length,
    }

    if (!commit) {
      return ok({
        headers: parsed.headers,
        mapping: parsed.mapping,
        missingRequired: [],
        rows: preview,
        summary,
        committed: false,
      })
    }

    let created = 0
    let updated = 0
    const failures: Array<{ rowNumber: number; message: string }> = []

    for (let i = 0; i < parsed.rows.length; i++) {
      const row = parsed.rows[i]
      const plan = preview[i]
      if (plan.action === 'error' || !row.startDate) continue

      try {
        if (plan.matchedId) {
          // Deliberately does NOT touch bookingStatus: where a show sits in our
          // pipeline is our decision, and a re-import must not undo it.
          await prisma.featuredEvent.update({
            where: { id: plan.matchedId },
            data: {
              location: row.location ?? undefined,
              description: row.description ?? undefined,
              startDate: row.startDate,
              endDate: row.endDate,
              applicationDeadline: row.applicationDeadline,
              boothFee: row.boothFee,
              source: 'FESTIVALNET',
              externalId: row.externalId ?? undefined,
            },
          })
          updated++
        } else {
          const event = await prisma.featuredEvent.create({
            data: {
              title: row.title,
              location: row.location,
              description: row.description,
              startDate: row.startDate,
              endDate: row.endDate,
              // The featured window mirrors the event dates, as the event form does.
              featuredFrom: row.startDate,
              featuredTo: row.endDate,
              applicationDeadline: row.applicationDeadline,
              boothFee: row.boothFee,
              bookingStatus: defaultStatus,
              source: 'FESTIVALNET',
              externalId: row.externalId,
              // Imported rows are not hand-edited, so calendar sync may still
              // manage them.
              manuallyModified: false,
            },
          })
          created++

          // Contacts are attached on create only; re-importing must not stack
          // duplicate organizer rows onto an existing event.
          if (row.contactName || row.contactEmail || row.contactPhone) {
            await prisma.eventContact.create({
              data: {
                eventId: event.id,
                name: row.contactName ?? 'Event organizer',
                email: row.contactEmail,
                phone: row.contactPhone,
                role: 'Organizer',
              },
            })
          }
        }
      } catch (error: any) {
        failures.push({
          rowNumber: row.rowNumber,
          message: error?.message ?? 'Failed to save',
        })
      }
    }

    await logAudit({
      userId: user.id,
      action: 'events.import',
      entityType: 'featuredEvent',
      entityId: 'bulk',
      changes: { created, updated, failed: failures.length, source: 'FESTIVALNET' },
    })

    return ok({
      headers: parsed.headers,
      mapping: parsed.mapping,
      missingRequired: [],
      rows: preview,
      summary,
      committed: true,
      created,
      updated,
      failures,
    })
  } catch (error: any) {
    console.error('[POST /api/admin/events/import] Error:', error)
    return fail(error.message || 'Failed to import events', 500)
  }
}
