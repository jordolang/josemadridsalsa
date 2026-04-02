import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import type { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'content:read'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: Prisma.EmailLogWhereInput = {
      ...(search
        ? {
            OR: [
              { recipientEmail: { contains: search, mode: 'insensitive' } },
              { subject: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(status && status !== 'ALL' ? { status: status as Prisma.EnumEmailLogStatusFilter } : {}),
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
    }

    const [logs, total] = await Promise.all([
      prisma.emailLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          recipientEmail: true,
          recipientName: true,
          subject: true,
          status: true,
          from: true,
          sentAt: true,
          openedAt: true,
          clickedAt: true,
          failedAt: true,
          bouncedAt: true,
          errorMessage: true,
          createdAt: true,
        },
      }),
      prisma.emailLog.count({ where }),
    ])

    return NextResponse.json({ logs, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
  }
}
