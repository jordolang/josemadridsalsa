import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'

/**
 * Audit Logs API - View and filter audit logs
 * Requires analytics:read permission
 */

const AuditLogsQuerySchema = z.object({
  action: z.string().optional(),
  userId: z.string().optional(),
  entityType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.coerce.number().min(1).max(1000).default(100),
  offset: z.coerce.number().min(0).default(0),
})

export async function GET(request: Request) {
  try {
    // Authentication check
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'analytics:read'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const query = {
      action: searchParams.get('action') || undefined,
      userId: searchParams.get('userId') || undefined,
      entityType: searchParams.get('entityType') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
    }

    const parsed = AuditLogsQuerySchema.safeParse(query)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { action, userId, entityType, startDate, endDate, limit, offset } =
      parsed.data

    // Build where clause
    const where: any = {}

    if (action) {
      where.action = action
    }

    if (userId) {
      where.userId = userId
    }

    if (entityType) {
      where.entityType = entityType
    }

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate)
      }
    }

    // Fetch logs and total count
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ])

    return NextResponse.json({
      logs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    })
  } catch (error) {
    console.error('[Audit Logs API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }
}
