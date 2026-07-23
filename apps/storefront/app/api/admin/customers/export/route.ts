import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { parseQuery } from '@/lib/api'
import { toCsv } from '@/lib/csv'

/**
 * GET /api/admin/customers/export
 *
 * Exports customers as CSV. Column order matches the importer's field aliases so
 * an export can be edited and re-imported cleanly. Honors the same search/source
 * filters as the Customers list.
 */
export async function GET(request: NextRequest) {
  const user = await requirePermission('users:export')

  const query = parseQuery(request)
  const where: any = {}

  if (query.search) {
    where.OR = [
      { email: { contains: query.search, mode: 'insensitive' } },
      { firstName: { contains: query.search, mode: 'insensitive' } },
      { lastName: { contains: query.search, mode: 'insensitive' } },
    ]
  }

  if (query.source && query.source !== 'all') {
    where.source = query.source
  }

  const customers = await prisma.customer.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  const headers = [
    'Email address',
    'First name',
    'Last name',
    'Phone',
    'Email status',
    'Email permission status',
    'Source Name',
    'Source',
    'Total orders',
    'Total spent',
    'Last order',
    'Notes',
    'Created At',
  ]

  const rows = customers.map((c) => [
    c.email,
    c.firstName ?? '',
    c.lastName ?? '',
    c.phone ?? '',
    c.emailStatus ?? '',
    c.emailPermissionStatus ?? '',
    c.sourceName ?? '',
    c.source,
    c.totalOrders,
    c.totalSpent.toString(),
    c.lastOrderAt ? c.lastOrderAt.toISOString() : '',
    c.notes ?? '',
    c.createdAt.toISOString(),
  ])

  await logAudit({
    userId: user.id,
    action: 'customers.export',
    entityType: 'customer',
    entityId: 'bulk',
    changes: { count: customers.length },
  })

  const csv = toCsv(headers, rows)

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="customers-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
}
