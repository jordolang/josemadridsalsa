import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { format } from 'date-fns'
import {
  type FundraiserMapping,
  type ParsedFundraiser,
  parseFundraiserCsv,
} from '@/lib/fundraisers/fundraiser-import'

/**
 * POST /api/admin/fundraisers/import
 *
 * Imports fundraisers from a CSV (typically an old spreadsheet of past
 * campaigns). Dry run by default; writes only when `commit` is true. Fundraisers
 * are keyed on slug, so a re-import updates in place. Rollup totals
 * (totalOrders/totalRevenue/totalCommission) are left untouched — those are
 * derived from live orders, not the import.
 */

const MAX_ROWS = 5000

type RowAction = 'create' | 'update' | 'error'

interface PreviewRow {
  rowNumber: number
  action: RowAction
  reason: string | null
  cells: Record<string, string | null>
}

function displayCells(row: ParsedFundraiser): Record<string, string | null> {
  return {
    name: row.name || null,
    organization: row.organizationName || null,
    start: row.startDate ? format(row.startDate, 'MMM d, yyyy') : null,
    end: row.endDate ? format(row.endDate, 'MMM d, yyyy') : null,
    commission: row.commissionRate === null ? null : `${row.commissionRate}%`,
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
    const mapping: FundraiserMapping | undefined =
      body.mapping && typeof body.mapping === 'object' ? body.mapping : undefined

    const parsed = parseFundraiserCsv(body.csv, mapping)

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

    const slugs = parsed.rows.filter((r) => !r.error).map((r) => r.slug)
    const existing = await prisma.fundraiser.findMany({
      where: { slug: { in: slugs } },
      select: { slug: true },
    })
    const known = new Set(existing.map((e) => e.slug))
    const seen = new Set<string>()

    const preview: PreviewRow[] = parsed.rows.map((row) => {
      const cells = displayCells(row)
      if (row.error) {
        return { rowNumber: row.rowNumber, action: 'error', reason: row.error, cells }
      }
      if (seen.has(row.slug)) {
        return {
          rowNumber: row.rowNumber,
          action: 'error',
          reason: `Duplicate slug "${row.slug}" earlier in the file`,
          cells,
        }
      }
      seen.add(row.slug)
      const exists = known.has(row.slug)
      return {
        rowNumber: row.rowNumber,
        action: exists ? 'update' : 'create',
        reason: exists ? 'Matches a fundraiser already on file' : null,
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
      if (preview[i].action === 'error') continue

      try {
        await prisma.fundraiser.upsert({
          where: { slug: row.slug },
          create: {
            name: row.name,
            slug: row.slug,
            subdomain: row.subdomain,
            organizationName: row.organizationName,
            contactEmail: row.contactEmail,
            contactPhone: row.contactPhone,
            startDate: row.startDate!,
            endDate: row.endDate!,
            goal: row.goal,
            commissionRate: row.commissionRate!,
            status: row.status,
            isActive: row.status === 'ACTIVE',
            description: row.description,
            missionStatement: row.missionStatement,
          },
          // Blank cells leave the stored value untouched on re-import.
          update: {
            name: row.name,
            subdomain: row.subdomain ?? undefined,
            organizationName: row.organizationName,
            contactEmail: row.contactEmail,
            contactPhone: row.contactPhone ?? undefined,
            startDate: row.startDate!,
            endDate: row.endDate!,
            goal: row.goal ?? undefined,
            commissionRate: row.commissionRate!,
            status: row.status,
            isActive: row.status === 'ACTIVE',
            description: row.description ?? undefined,
            missionStatement: row.missionStatement ?? undefined,
          },
        })
        if (preview[i].action === 'create') created++
        else updated++
      } catch (error: any) {
        failures.push({
          rowNumber: row.rowNumber,
          message: error?.message ?? 'Failed to save',
        })
      }
    }

    await logAudit({
      userId: user.id,
      action: 'fundraisers.import',
      entityType: 'fundraiser',
      entityId: 'bulk',
      changes: { created, updated, failed: failures.length },
    })

    return ok({ ...base, committed: true, created, updated, failures })
  } catch (error: any) {
    console.error('[POST /api/admin/fundraisers/import] Error:', error)
    return fail(error.message || 'Failed to import fundraisers', 500)
  }
}
