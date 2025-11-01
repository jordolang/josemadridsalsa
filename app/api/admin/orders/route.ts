import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import {
  ok,
  paginated,
  parsePagination,
  parseSearch,
  parseQuery,
} from '@/lib/api'

export async function GET(request: NextRequest) {
  await requirePermission('orders:read')

  const { page, limit, skip } = parsePagination(request)
  const search = parseSearch(request)
  const query = parseQuery(request)

  const where: any = {}

  // Search
  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: 'insensitive' } },
      { guestEmail: { contains: search, mode: 'insensitive' } },
      {
        user: {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
          ],
        },
      },
    ]
  }

  // Status filter
  if (query.status && query.status !== 'all') {
    where.status = query.status
  }

  // Date range filter
  if (query.startDate || query.endDate) {
    where.createdAt = {}
    if (query.startDate) {
      where.createdAt.gte = new Date(query.startDate)
    }
    if (query.endDate) {
      where.createdAt.lte = new Date(query.endDate)
    }
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: {
          select: {
            id: true,
            quantity: true,
          },
        },
      },
    }),
    prisma.order.count({ where }),
  ])

  return paginated(orders, total, page, limit)
}
