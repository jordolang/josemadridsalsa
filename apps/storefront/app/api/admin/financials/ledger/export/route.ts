import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { fail, failFromError } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { buildLedgerWhere } from '@/lib/financials/ledger-filters'
import {
  LEDGER_EXPORT_FORMATS,
  exportFilename,
  renderLedgerExport,
  resolveAccountMap,
  type LedgerExportFormat,
} from '@/lib/financials/ledger-export'
import { getLedgerAccountOverrides } from '@/lib/quickbooks/ledger-account-settings'

/**
 * `GET /api/admin/financials/ledger/export`
 *
 * Downloads the filtered ledger as CSV in one of three shapes (see `lib/financials/ledger-export.ts`).
 * The filter is the same builder the list endpoint uses, so what downloads is what is on screen.
 *
 * `markExported=true` stamps `exportedAt` on the rows in the file, which is what makes
 * `onlyUnexported=true` mean "everything since the last time I did this". It is **opt-in**: a
 * preview or a second copy of last month's file must not silently make rows look filed. The stamp
 * is written after the rows are read and only when the render succeeded, so a failed export never
 * marks anything.
 */

/** Enough rows to cover years of this business's volume while still fitting a buffered response. */
const MAX_ROWS = 20_000

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission('financials:export')

    const params = req.nextUrl.searchParams
    const format = (params.get('format') ?? 'detail') as LedgerExportFormat
    if (!(LEDGER_EXPORT_FORMATS as readonly string[]).includes(format)) {
      return fail(`Unknown export format "${format}"`, 400)
    }

    // Downloading is a read; *marking* rows as exported changes what the ledger reports as
    // outstanding, so it needs write access on top rather than riding along with the download.
    const markExported = params.get('markExported') === 'true'
    if (markExported) await requirePermission('financials:write')

    const where = buildLedgerWhere(params)
    const entries = await prisma.ledgerEntry.findMany({
      where,
      // Oldest first: an accounting file reads forwards, and QuickBooks lists an import in the
      // order it was given.
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      take: MAX_ROWS,
    })

    if (entries.length === 0) {
      return fail('No ledger entries match those filters', 404)
    }

    const csv = renderLedgerExport(format, entries, {
      accounts: resolveAccountMap(await getLedgerAccountOverrides()),
    })

    if (markExported) {
      await prisma.ledgerEntry.updateMany({
        where: { id: { in: entries.map((e) => e.id) } },
        data: { exportedAt: new Date() },
      })
    }

    await logAudit({
      userId: user.id,
      action: 'financials.ledger-export',
      entityType: 'ledgerEntry',
      entityId: 'bulk',
      changes: {
        format,
        rows: entries.length,
        marked: markExported,
        truncated: entries.length === MAX_ROWS,
      },
    })

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${exportFilename(format, new Date())}"`,
      },
    })
  } catch (error: unknown) {
    console.error('[GET /api/admin/financials/ledger/export] Error:', error)
    return failFromError(error, 'Failed to export the ledger')
  }
}
