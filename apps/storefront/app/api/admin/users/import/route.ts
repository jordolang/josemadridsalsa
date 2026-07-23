import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import {
  type UserMapping,
  type ParsedUser,
  parseUserCsv,
} from '@/lib/users/user-import'

/**
 * POST /api/admin/users/import
 *
 * Imports user accounts from a CSV. Dry run by default; writes only when
 * `commit` is true. Keyed on email. New accounts get no password (users set one
 * via password reset / OAuth). Roles of existing accounts are never modified by
 * an import — see the security note in `lib/users/user-import.ts`.
 */

const MAX_ROWS = 20000

type RowAction = 'create' | 'update' | 'error'

interface PreviewRow {
  rowNumber: number
  action: RowAction
  reason: string | null
  cells: Record<string, string | null>
}

function displayCells(row: ParsedUser): Record<string, string | null> {
  return {
    name: row.name,
    email: row.email || null,
    phone: row.phone,
    role: row.role,
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission('users:write')

    const body = await req.json().catch(() => null)
    if (!body || typeof body.csv !== 'string' || !body.csv.trim()) {
      return fail('No CSV content provided', 400)
    }

    const commit = body.commit === true
    const mapping: UserMapping | undefined =
      body.mapping && typeof body.mapping === 'object' ? body.mapping : undefined

    const parsed = parseUserCsv(body.csv, mapping)

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

    const emails = parsed.rows.filter((r) => !r.error).map((r) => r.email)
    const existing = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { email: true },
    })
    const known = new Set(existing.map((e) => e.email.toLowerCase()))
    const seen = new Set<string>()

    const preview: PreviewRow[] = parsed.rows.map((row) => {
      const cells = displayCells(row)
      if (row.error) {
        return { rowNumber: row.rowNumber, action: 'error', reason: row.error, cells }
      }
      if (seen.has(row.email)) {
        return {
          rowNumber: row.rowNumber,
          action: 'error',
          reason: 'Duplicate email earlier in the file',
          cells,
        }
      }
      seen.add(row.email)
      const exists = known.has(row.email)
      return {
        rowNumber: row.rowNumber,
        action: exists ? 'update' : 'create',
        reason: exists ? 'Matches an account already on file' : null,
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
        if (preview[i].action === 'update') {
          // Never change role on update — an import must not elevate or demote
          // an existing account.
          await prisma.user.update({
            where: { email: row.email },
            data: {
              name: row.name ?? undefined,
              phone: row.phone ?? undefined,
            },
          })
          updated++
        } else {
          await prisma.user.create({
            data: {
              email: row.email,
              name: row.name,
              phone: row.phone,
              role: row.role,
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
      action: 'users.import',
      entityType: 'user',
      entityId: 'bulk',
      changes: { created, updated, failed: failures.length },
    })

    return ok({ ...base, committed: true, created, updated, failures })
  } catch (error: any) {
    console.error('[POST /api/admin/users/import] Error:', error)
    return fail(error.message || 'Failed to import users', 500)
  }
}
