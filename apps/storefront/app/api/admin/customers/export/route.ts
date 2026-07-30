import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { parseQuery } from '@/lib/api'
import { toCsvRow } from '@/lib/csv'
import {
  buildCustomerOrderBy,
  buildCustomerWhere,
  resolveSortColumn,
  resolveSortDirection,
} from '@/lib/customers/customer-list'

/**
 * GET /api/admin/customers/export
 *
 * Exports customers as CSV. Column order matches the importer's field aliases so
 * an export can be edited and re-imported cleanly.
 *
 * Shares `buildCustomerWhere` / `buildCustomerOrderBy` with the Customers list
 * page, so the download is exactly the rows on screen — every page of them — in
 * the order they are displayed.
 *
 * The response is streamed rather than built as one string: a Vercel Function
 * caps a buffered response body at 4.5 MB, and a full export of the current
 * customer book is ~11 MB, which would fail with FUNCTION_PAYLOAD_TOO_LARGE.
 * Streamed responses have no such cap.
 */

const CSV_HEADERS = [
  'Email address',
  'First name',
  'Last name',
  'Phone',
  'Email status',
  'Email permission status',
  'Source Name',
  'Source',
  'Account type',
  'Total orders',
  'Total spent',
  'Last order',
  'Notes',
  'Created At',
]

/**
 * Rows fetched per round trip while streaming. Measured against the full
 * ~22,700-row book: 5,000 takes ~19s over 5 round trips versus ~25s over 12 at
 * 2,000. Chunk size doesn't reintroduce the payload cap — that applies to
 * buffered bodies, not stream chunks.
 */
const BATCH = 5000

export async function GET(request: NextRequest) {
  const user = await requirePermission('users:export')

  const query = parseQuery(request)
  const where = buildCustomerWhere({
    search: query.search,
    source: query.source,
    accountType: query.accountType,
  })
  const orderBy = buildCustomerOrderBy(
    resolveSortColumn(query.sortBy),
    resolveSortDirection(query.sortDir)
  )

  const total = await prisma.customer.count({ where })

  await logAudit({
    userId: user.id,
    action: 'customers.export',
    entityType: 'customer',
    entityId: 'bulk',
    changes: { count: total },
  })

  const encoder = new TextEncoder()
  let skip = 0

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(toCsvRow(CSV_HEADERS)))
    },
    async pull(controller) {
      try {
        // Offset paging rather than a cursor: the export honours the user's
        // chosen sort, which is not `id`, so there is no single column to
        // resume from. `orderBy` always ends with a unique tie-break on email,
        // which is what keeps the offset windows stable.
        const batch = await prisma.customer.findMany({
          where,
          orderBy,
          skip,
          take: BATCH,
        })

        if (batch.length === 0) {
          controller.close()
          return
        }
        skip += batch.length

        const chunk = batch
          .map((c) =>
            toCsvRow([
              c.email,
              c.firstName ?? '',
              c.lastName ?? '',
              c.phone ?? '',
              c.emailStatus ?? '',
              c.emailPermissionStatus ?? '',
              c.sourceName ?? '',
              c.source,
              c.accountType,
              c.totalOrders,
              c.totalSpent.toString(),
              c.lastOrderAt ? c.lastOrderAt.toISOString() : '',
              c.notes ?? '',
              c.createdAt.toISOString(),
            ])
          )
          .join('\r\n')

        controller.enqueue(encoder.encode(`\r\n${chunk}`))

        if (batch.length < BATCH) controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="customers-${new Date().toISOString().split('T')[0]}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
