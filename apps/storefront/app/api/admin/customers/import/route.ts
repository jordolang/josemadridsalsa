import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import {
  type CustomerMapping,
  type ParsedCustomer,
  customerDisplayName,
  parseCustomerCsv,
} from '@/lib/customers/customer-import'

/**
 * POST /api/admin/customers/import
 *
 * Imports a customer/contact CSV. Runs as a dry run by default — nothing is
 * written unless `commit` is true — so the admin can review the create/update
 * preview first. Customers are keyed on email; a re-import updates in place and
 * fills blanks rather than overwriting existing values with empty cells.
 */

const MAX_ROWS = 20000

type RowAction = 'create' | 'update' | 'error'

interface PreviewRow {
  rowNumber: number
  action: RowAction
  reason: string | null
  cells: Record<string, string | null>
}

function displayCells(row: ParsedCustomer): Record<string, string | null> {
  return {
    name: customerDisplayName(row),
    email: row.email || null,
    phone: row.phone,
    status: row.emailStatus,
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
    const mapping: CustomerMapping | undefined =
      body.mapping && typeof body.mapping === 'object' ? body.mapping : undefined

    const parsed = parseCustomerCsv(body.csv, mapping)

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

    // Resolve which emails already exist so each row previews as create vs update.
    const emails = parsed.rows.filter((r) => !r.error).map((r) => r.email)
    const existing = await prisma.customer.findMany({
      where: { email: { in: emails } },
      select: { email: true },
    })
    const known = new Set(existing.map((e) => e.email))

    // A commit upserts row-by-row, so a duplicate email within the file would
    // just update twice; flag the later occurrence as skipped to keep the
    // preview counts honest.
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
        reason: exists ? 'Matches a customer already on file' : null,
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

    const batchId = `cust_${Date.now()}`
    const now = new Date()
    let created = 0
    let updated = 0
    const failures: Array<{ rowNumber: number; message: string }> = []

    for (let i = 0; i < parsed.rows.length; i++) {
      const row = parsed.rows[i]
      if (preview[i].action === 'error') continue

      try {
        await prisma.customer.upsert({
          where: { email: row.email },
          create: {
            email: row.email,
            firstName: row.firstName,
            lastName: row.lastName,
            phone: row.phone,
            emailStatus: row.emailStatus,
            emailPermissionStatus: row.emailPermissionStatus,
            sourceName: row.sourceName,
            notes: row.notes,
            source: 'IMPORT',
            importSource: 'csv',
            importBatchId: batchId,
            importedAt: now,
          },
          // `?? undefined` leaves a stored value untouched when the CSV cell is
          // blank, so a re-import enriches rather than erases.
          update: {
            firstName: row.firstName ?? undefined,
            lastName: row.lastName ?? undefined,
            phone: row.phone ?? undefined,
            emailStatus: row.emailStatus ?? undefined,
            emailPermissionStatus: row.emailPermissionStatus ?? undefined,
            sourceName: row.sourceName ?? undefined,
            notes: row.notes ?? undefined,
            importSource: 'csv',
            importBatchId: batchId,
            importedAt: now,
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
      action: 'customers.import',
      entityType: 'customer',
      entityId: 'bulk',
      changes: { created, updated, failed: failures.length, batchId },
    })

    return ok({ ...base, committed: true, created, updated, failures })
  } catch (error: any) {
    console.error('[POST /api/admin/customers/import] Error:', error)
    return fail(error.message || 'Failed to import customers', 500)
  }
}
