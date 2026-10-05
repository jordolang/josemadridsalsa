import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { generateUniqueReferralCode } from '@/lib/fundraisers/referral-code'
import {
  type ParticipantMapping,
  type ParsedParticipant,
  parseParticipantCsv,
} from '@/lib/fundraisers/participant-import'

/**
 * POST /api/admin/fundraisers/participants/import
 *
 * Imports fundraiser participants (sellers/students). Each row names its
 * fundraiser by slug or name, resolved to an id here. Dry run by default; writes
 * only when `commit` is true. A participant is matched within its fundraiser by
 * email — re-import updates in place. New participants get a generated referral
 * code (or the CSV's, if it's free); existing codes are never changed.
 */

const MAX_ROWS = 20000

type RowAction = 'create' | 'update' | 'error'

interface PreviewRow {
  rowNumber: number
  action: RowAction
  reason: string | null
  cells: Record<string, string | null>
}

interface RowPlan {
  fundraiserId: string | null
  /** Existing participant id when this row resolved to an update. */
  matchedId: string | null
}

function displayCells(
  row: ParsedParticipant,
  fundraiserName: string | null
): Record<string, string | null> {
  return {
    fundraiser: fundraiserName ?? row.fundraiserRef ?? null,
    name: row.name || null,
    email: row.email || null,
    status: row.status,
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission('content:write')

    const body = await req.json().catch(() => null)
    if (!body || typeof body.csv !== 'string' || !body.csv.trim()) {
      return fail('No CSV content provided', 400)
    }

    const commit = body.commit === true
    const mapping: ParticipantMapping | undefined =
      body.mapping && typeof body.mapping === 'object' ? body.mapping : undefined

    const parsed = parseParticipantCsv(body.csv, mapping)

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

    // Resolve fundraiser references (slug or name) to ids in one pass.
    const refs = Array.from(
      new Set(
        parsed.rows.filter((r) => !r.error).map((r) => r.fundraiserRef.toLowerCase())
      )
    )
    const fundraisers = refs.length
      ? await prisma.fundraiser.findMany({
          select: { id: true, name: true, slug: true },
        })
      : []
    const bySlug = new Map(fundraisers.map((f) => [f.slug.toLowerCase(), f]))
    const byName = new Map(fundraisers.map((f) => [f.name.toLowerCase(), f]))
    const resolveFundraiser = (ref: string) => {
      const key = ref.toLowerCase()
      return bySlug.get(key) ?? byName.get(key) ?? null
    }

    // Existing participants for the resolved fundraisers, keyed fundraiserId|email.
    const involvedIds = Array.from(
      new Set(
        parsed.rows
          .map((r) => resolveFundraiser(r.fundraiserRef)?.id)
          .filter((v): v is string => Boolean(v))
      )
    )
    const existingParticipants = involvedIds.length
      ? await prisma.fundraiserParticipant.findMany({
          where: { fundraiserId: { in: involvedIds } },
          select: { id: true, fundraiserId: true, email: true },
        })
      : []
    const participantKey = (fundraiserId: string, email: string) =>
      `${fundraiserId}|${email.toLowerCase()}`
    const byParticipant = new Map(
      // App-registered sellers may have no email; they cannot collide with an imported row.
      existingParticipants.flatMap((p) =>
        p.email ? [[participantKey(p.fundraiserId, p.email), p.id] as const] : []
      )
    )

    const seen = new Set<string>()
    const plans: RowPlan[] = []

    const preview: PreviewRow[] = parsed.rows.map((row) => {
      const fundraiser = row.error ? null : resolveFundraiser(row.fundraiserRef)
      const cells = displayCells(row, fundraiser?.name ?? null)

      if (row.error) {
        plans.push({ fundraiserId: null, matchedId: null })
        return { rowNumber: row.rowNumber, action: 'error', reason: row.error, cells }
      }
      if (!fundraiser) {
        plans.push({ fundraiserId: null, matchedId: null })
        return {
          rowNumber: row.rowNumber,
          action: 'error',
          reason: `No fundraiser matches "${row.fundraiserRef}"`,
          cells,
        }
      }

      const key = participantKey(fundraiser.id, row.email)
      if (seen.has(key)) {
        plans.push({ fundraiserId: fundraiser.id, matchedId: null })
        return {
          rowNumber: row.rowNumber,
          action: 'error',
          reason: 'Duplicate participant earlier in the file',
          cells,
        }
      }
      seen.add(key)

      const matchedId = byParticipant.get(key) ?? null
      plans.push({ fundraiserId: fundraiser.id, matchedId })
      return {
        rowNumber: row.rowNumber,
        action: matchedId ? 'update' : 'create',
        reason: matchedId ? 'Matches a participant already on file' : null,
        cells,
      }
    })

    const summary = {
      create: preview.filter((r) => r.action === 'create').length,
      update: preview.filter((r) => r.action === 'update').length,
      error: preview.filter((r) => r.action === 'error').length,
    }

    const base = {
      headers: parsed.headers,
      mapping: parsed.mapping,
      missingRequired: [] as string[],
      rows: preview,
      summary,
    }

    if (!commit) {
      return ok({ ...base, committed: false })
    }

    let created = 0
    let updated = 0
    const failures: Array<{ rowNumber: number; message: string }> = []

    for (let i = 0; i < parsed.rows.length; i++) {
      const row = parsed.rows[i]
      const plan = plans[i]
      if (preview[i].action === 'error' || !plan.fundraiserId) continue

      try {
        if (plan.matchedId) {
          // Referral code is a participant's stable identity — never rewritten.
          await prisma.fundraiserParticipant.update({
            where: { id: plan.matchedId },
            data: {
              name: row.name,
              phone: row.phone ?? undefined,
              status: row.status,
            },
          })
          updated++
        } else {
          // Use the CSV's code only if it's free; otherwise generate one.
          let referralCode = await generateUniqueReferralCode()
          if (row.referralCode) {
            const taken = await prisma.fundraiserParticipant.findUnique({
              where: { referralCode: row.referralCode },
              select: { id: true },
            })
            if (!taken) referralCode = row.referralCode
          }

          await prisma.fundraiserParticipant.create({
            data: {
              fundraiserId: plan.fundraiserId,
              name: row.name,
              email: row.email,
              phone: row.phone,
              referralCode,
              status: row.status,
            },
          })
          created++
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
      action: 'fundraisers.participants.import',
      entityType: 'fundraiserParticipant',
      entityId: 'bulk',
      changes: { created, updated, failed: failures.length },
    })

    return ok({ ...base, committed: true, created, updated, failures })
  } catch (error: any) {
    console.error('[POST /api/admin/fundraisers/participants/import] Error:', error)
    return fail(error.message || 'Failed to import participants', 500)
  }
}
