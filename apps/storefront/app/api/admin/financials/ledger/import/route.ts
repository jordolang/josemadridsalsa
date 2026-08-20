import { NextRequest } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail, failFromError } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { CATEGORY_DIRECTION, LEDGER_CATEGORY_VALUES } from '@/lib/financials/ledger'
import {
  categoryMatchesDirection,
  statementRowHash,
} from '@/lib/financials/statement-import'

/**
 * `POST /api/admin/financials/ledger/import`
 *
 * Writes the rows a person kept after reviewing a statement.
 *
 * The client sends back rows it was shown, so **nothing it sends is trusted**: the direction is
 * derived from the amount rather than accepted, the category is checked against that direction,
 * and the content hash is recomputed here rather than read from the request. Recomputing the hash
 * is what keeps the duplicate guard meaningful — a client that sent a hash of its own choosing
 * could otherwise write the same statement line twice, or overwrite an unrelated row.
 *
 * Rows are upserted on `dedupeKey`, so re-importing an overlapping statement export updates the
 * rows it already created instead of duplicating them.
 */

const MAX_ROWS = 5_000

const RowSchema = z.object({
  /** `YYYY-MM-DD`, as the preview returned it. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Bad date'),
  description: z.string().trim().min(1).max(300),
  /** Signed: positive in, negative out. Zero rows never reach here — the parser rejects them. */
  amountCents: z.number().int().refine((n) => n !== 0, 'Amount is zero'),
  category: z.enum(LEDGER_CATEGORY_VALUES),
  memo: z.string().trim().max(1000).nullable().optional(),
})

const ImportSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  accountLabel: z.string().trim().min(1).max(120),
  rows: z.array(RowSchema).min(1, 'Nothing selected to import').max(MAX_ROWS),
  /** Rows the reviewer left out, recorded on the batch so the import's history is complete. */
  skipped: z.number().int().min(0).max(MAX_ROWS).default(0),
})

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission('financials:write')

    const parsed = ImportSchema.safeParse(await req.json())
    if (!parsed.success) return fail(parsed.error.issues[0]?.message || 'Invalid request', 400)
    const { filename, accountLabel, rows, skipped } = parsed.data

    // A category on the wrong side of the ledger would flip the sign of a figure in every report
    // built on it, so it is refused rather than silently corrected — the mismatch almost always
    // means the wrong category was picked, and correcting it would hide that.
    const misfiled = rows.find((r) => !categoryMatchesDirection(r.category, r.amountCents))
    if (misfiled) {
      const moved = misfiled.amountCents >= 0 ? 'in' : 'out'
      return fail(
        `"${misfiled.description}" is money ${moved}, but ${misfiled.category} is a money-${moved === 'in' ? 'out' : 'in'} category`,
        400
      )
    }

    const batch = await prisma.ledgerImportBatch.create({
      data: {
        filename,
        accountLabel,
        rowsParsed: rows.length + skipped,
        rowsImported: rows.length,
        rowsSkipped: skipped,
        importedById: user.id,
      },
    })

    let written = 0
    for (const row of rows) {
      const date = new Date(`${row.date}T00:00:00.000Z`)
      const amountCents = Math.abs(row.amountCents)
      // Recomputed here, never taken from the request — see the note at the top of this file.
      const contentHash = statementRowHash(
        { lineNumber: 0, date, description: row.description, amountCents: row.amountCents },
        accountLabel
      )

      const data = {
        date,
        direction: CATEGORY_DIRECTION[row.category],
        amountCents,
        category: row.category,
        source: 'IMPORT' as const,
        sourceId: batch.id,
        description: row.description,
        counterparty: null,
        paymentMethod: accountLabel,
        memo: row.memo?.trim() || null,
        // Not manual: a person chose to keep it, but the row came from a file and the backfill
        // must be able to tell the two apart.
        isManual: false,
        enteredById: user.id,
      }

      await prisma.ledgerEntry.upsert({
        where: { dedupeKey: `import:${contentHash}` },
        create: { ...data, dedupeKey: `import:${contentHash}` },
        update: data,
      })
      written++
    }

    await logAudit({
      userId: user.id,
      action: 'financials.ledger-import',
      entityType: 'ledgerImportBatch',
      entityId: batch.id,
      changes: { filename, accountLabel, imported: written, skipped },
    })

    return ok({ batchId: batch.id, imported: written, skipped })
  } catch (error: unknown) {
    console.error('[POST /api/admin/financials/ledger/import] Error:', error)
    return failFromError(error, 'Failed to import that statement')
  }
}
