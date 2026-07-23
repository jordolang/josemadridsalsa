import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { parseQuery } from '@/lib/api'
import { toCsv } from '@/lib/csv'

/**
 * GET /api/admin/fundraisers/export
 *
 * Exports fundraisers as CSV. Column order lines up with the importer's field
 * aliases so an export can be edited and re-imported cleanly.
 */
export async function GET(request: NextRequest) {
  const user = await requirePermission('content:read')

  const query = parseQuery(request)
  const where: any = {}

  if (query.status && query.status !== 'all') {
    where.status = query.status
  }
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { organizationName: { contains: query.search, mode: 'insensitive' } },
    ]
  }

  const fundraisers = await prisma.fundraiser.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  const headers = [
    'Name',
    'Slug',
    'Subdomain',
    'Organization',
    'Contact Email',
    'Contact Phone',
    'Start Date',
    'End Date',
    'Goal',
    'Commission Rate',
    'Status',
    'Description',
    'Mission Statement',
    'Total Orders',
    'Total Revenue',
    'Total Commission',
    'Created At',
  ]

  const rows = fundraisers.map((f) => [
    f.name,
    f.slug,
    f.subdomain ?? '',
    f.organizationName,
    f.contactEmail,
    f.contactPhone ?? '',
    f.startDate.toISOString().split('T')[0],
    f.endDate.toISOString().split('T')[0],
    f.goal ? f.goal.toString() : '',
    f.commissionRate.toString(),
    f.status,
    f.description ?? '',
    f.missionStatement ?? '',
    f.totalOrders,
    f.totalRevenue.toString(),
    f.totalCommission.toString(),
    f.createdAt.toISOString(),
  ])

  await logAudit({
    userId: user.id,
    action: 'fundraisers.export',
    entityType: 'fundraiser',
    entityId: 'bulk',
    changes: { count: fundraisers.length },
  })

  const csv = toCsv(headers, rows)

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="fundraisers-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
}
