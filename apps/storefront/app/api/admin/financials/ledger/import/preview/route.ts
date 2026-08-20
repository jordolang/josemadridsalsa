import { NextRequest } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail, failFromError } from '@/lib/api'
import { parseCsv } from '@/lib/csv'
import {
  MATCH_WINDOW_DAYS,
  detectStatementMapping,
  mappingProblems,
  parseStatementRows,
  reviewStatementRows,
  statementRowHash,
  type StatementMapping,
} from '@/lib/financials/statement-import'

/**
 * `POST /api/admin/financials/ledger/import/preview`
 *
 * Reads an uploaded statement and says what *would* happen. Writes nothing.
 *
 * The interesting work is the exclusion pass: most of a bank statement is money the ledger already
 * holds, recorded from the orders that produced it, and importing it wholesale would double every
 * figure the ledger reports. So the reviewer is shown a marked-up list — with duplicates and
 * processor payouts already excluded — rather than a raw file to approve.
 */

/** A statement covering more than this is more likely a mis-picked file than a real upload. */
const MAX_ROWS = 5_000
const MAX_BYTES = 2 * 1024 * 1024

const PreviewSchema = z.object({
  csv: z.string().min(1, 'The file is empty').max(MAX_BYTES, 'That file is too large'),
  accountLabel: z.string().trim().min(1, 'Name the account this statement came from').max(120),
  /** Column choices from the mapping step. Omitted on the first pass, which auto-detects. */
  mapping: z
    .object({
      date: z.string().optional(),
      description: z.string().optional(),
      amount: z.string().optional(),
      debit: z.string().optional(),
      credit: z.string().optional(),
    })
    .optional(),
})

export async function POST(req: NextRequest) {
  try {
    await requirePermission('financials:write')

    const parsed = PreviewSchema.safeParse(await req.json())
    if (!parsed.success) return fail(parsed.error.issues[0]?.message || 'Invalid request', 400)
    const { csv, accountLabel } = parsed.data

    const { headers, rows: rawRows } = parseCsv(csv)
    if (headers.length === 0) return fail('That file has no header row', 400)
    if (rawRows.length > MAX_ROWS) {
      return fail(`That file has ${rawRows.length} rows; the limit is ${MAX_ROWS}`, 400)
    }

    // Only the columns the user actually chose are honoured — an empty string from an unset
    // dropdown must not be treated as a column name.
    const chosen: StatementMapping = {}
    for (const [field, column] of Object.entries(parsed.data.mapping ?? {})) {
      if (column && headers.includes(column)) chosen[field as keyof StatementMapping] = column
    }
    const mapping = Object.keys(chosen).length > 0 ? chosen : detectStatementMapping(headers)

    const problems = mappingProblems(mapping)
    if (problems.length > 0) {
      // Not an error: the client shows the mapping step so the user can pick the columns.
      return ok({ headers, mapping, problems, rows: [], errors: [], needsMapping: true })
    }

    const { rows, errors } = parseStatementRows(rawRows, mapping)
    if (rows.length === 0) {
      return ok({ headers, mapping, problems: [], rows: [], errors, needsMapping: false })
    }

    // Only the ledger rows that could plausibly match are loaded — the statement's own date range,
    // widened by the settlement window on both sides.
    const times = rows.map((r) => r.date.getTime())
    const pad = MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000
    const existingLedger = await prisma.ledgerEntry.findMany({
      where: {
        date: { gte: new Date(Math.min(...times) - pad), lte: new Date(Math.max(...times) + pad) },
      },
      select: { date: true, amountCents: true },
    })

    // Which of these lines have been imported before. The hash is content-based, so an overlapping
    // re-export of the same statement period lands on the rows it already created.
    const seen = await prisma.ledgerEntry.findMany({
      where: {
        dedupeKey: { in: rows.map((r) => `import:${statementRowHash(r, accountLabel)}`) },
      },
      select: { dedupeKey: true },
    })
    const importedHashes = new Set(
      seen.map((s) => (s.dedupeKey ?? '').replace(/^import:/, '')).filter(Boolean)
    )

    const reviewed = reviewStatementRows({ rows, accountLabel, existingLedger, importedHashes })

    return ok({
      headers,
      mapping,
      problems: [],
      needsMapping: false,
      rows: reviewed,
      errors,
      summary: {
        parsed: reviewed.length,
        excluded: reviewed.filter((r) => r.excludedReason !== null).length,
        alreadyImported: reviewed.filter((r) => r.alreadyImported).length,
        unreadable: errors.length,
      },
    })
  } catch (error: unknown) {
    console.error('[POST /api/admin/financials/ledger/import/preview] Error:', error)
    return failFromError(error, 'Failed to read that statement')
  }
}
