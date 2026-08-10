import { NextRequest, NextResponse } from 'next/server'

import { requirePermission } from '@/lib/rbac'
import { toCsv } from '@/lib/csv'
import { getTaxReport } from '@/lib/analytics/tax-report.server'
import { isTaxPeriodKey, UNKNOWN_JURISDICTION } from '@/lib/analytics/tax-report'

/**
 * GET /api/admin/financials/tax-report/export?period=this-quarter
 *
 * The jurisdiction table as CSV, for handing to an accountant. Read-only, so no audit entry —
 * consistent with the other analytics exports.
 */
export async function GET(request: NextRequest) {
  await requirePermission('financials:read')

  const requested = request.nextUrl.searchParams.get('period') ?? undefined
  const period = isTaxPeriodKey(requested) ? requested : 'this-quarter'

  const report = await getTaxReport(period)

  const toDollars = (cents: number) => (cents / 100).toFixed(2)

  const rows = report.summary.byState.map((row) => [
    row.state === UNKNOWN_JURISDICTION ? 'No shipping address' : row.state,
    row.orderCount,
    row.untaxedOrderCount,
    toDollars(row.grossSalesCents),
    toDollars(row.taxCents),
    row.effectiveRate === null ? '' : (row.effectiveRate * 100).toFixed(2),
  ])

  // A total row, because the first thing anyone does with this file is check it adds up.
  rows.push([
    'TOTAL',
    report.summary.orderCount,
    report.summary.untaxedOrderCount,
    toDollars(report.summary.grossSalesCents),
    toDollars(report.summary.taxCents),
    '',
  ])

  const csv = toCsv(
    [
      'Jurisdiction',
      'Orders',
      'Untaxed orders',
      'Gross sales',
      'Tax collected',
      'Effective rate %',
    ],
    rows
  )

  const filename = `tax-collected-${report.period.label.replace(/\s+/g, '-').toLowerCase()}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
