import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { parseQuery } from '@/lib/api'
import { toCsv } from '@/lib/csv'

/**
 * GET /api/admin/fundraisers/participants/export
 *
 * Exports fundraiser participants as CSV. Each row carries its fundraiser slug so
 * the file round-trips back through the participants importer. Optionally scoped
 * to a single fundraiser via `?fundraiserId=`.
 */
export async function GET(request: NextRequest) {
  const user = await requirePermission('content:read')

  const query = parseQuery(request)
  const where: any = {}
  if (query.fundraiserId) {
    where.fundraiserId = query.fundraiserId
  }

  const participants = await prisma.fundraiserParticipant.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { fundraiser: { select: { slug: true, name: true } } },
  })

  const headers = [
    'Fundraiser',
    'Fundraiser Name',
    'Name',
    'Email',
    'Phone',
    'Referral Code',
    'Status',
    'Total Orders',
    'Total Revenue',
    'Total Commission',
    'Created At',
  ]

  const rows = participants.map((p) => [
    p.fundraiser.slug,
    p.fundraiser.name,
    p.name,
    p.email,
    p.phone ?? '',
    p.referralCode,
    p.status,
    p.totalOrders,
    p.totalRevenue.toString(),
    p.totalCommission.toString(),
    p.createdAt.toISOString(),
  ])

  await logAudit({
    userId: user.id,
    action: 'fundraisers.participants.export',
    entityType: 'fundraiserParticipant',
    entityId: 'bulk',
    changes: { count: participants.length },
  })

  const csv = toCsv(headers, rows)

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="fundraiser-participants-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
}
