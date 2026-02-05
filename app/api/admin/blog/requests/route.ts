import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { ok, fail } from '@/lib/api'
import { logAudit } from '@/lib/audit'

/**
 * GET /api/admin/blog/requests
 * List all blog access requests (admin)
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission('content:write')

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || ''
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = 20
    const skip = (page - 1) * limit

    const where: any = {}
    if (status && status !== 'all') {
      where.status = status
    }

    const [requests, total, statusCounts] = await Promise.all([
      prisma.blogAccessRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
            },
          },
        },
      }),
      prisma.blogAccessRequest.count({ where }),
      prisma.blogAccessRequest.groupBy({
        by: ['status'],
        _count: true,
      }),
    ])

    return ok({
      requests,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      statusCounts,
    })
  } catch (error: any) {
    return fail(error.message, error.status || 500)
  }
}
