import { NextResponse } from 'next/server'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'

/**
 * Audit Logs Stats API - Get aggregated statistics
 * Requires analytics:read permission
 */

export async function GET(request: Request) {
  try {
    // Authentication check
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'analytics:read'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get date range from query params (default: last 30 days)
    const { searchParams } = new URL(request.url)
    const daysBack = parseInt(searchParams.get('days') || '30', 10)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysBack)

    // Aggregate statistics
    const [
      totalLogs,
      aiChatLogs,
      uniqueUsers,
      topActions,
      recentLogs,
      aiChatStats,
    ] = await Promise.all([
      // Total logs in period
      prisma.auditLog.count({
        where: { createdAt: { gte: startDate } },
      }),

      // AI chat specific logs
      prisma.auditLog.count({
        where: {
          action: 'AI_CHAT',
          createdAt: { gte: startDate },
        },
      }),

      // Unique users
      prisma.auditLog.findMany({
        where: { createdAt: { gte: startDate } },
        select: { userId: true },
        distinct: ['userId'],
      }),

      // Top actions
      prisma.auditLog.groupBy({
        by: ['action'],
        where: { createdAt: { gte: startDate } },
        _count: true,
        orderBy: { _count: { action: 'desc' } },
        take: 10,
      }),

      // Recent activity
      prisma.auditLog.findMany({
        where: { createdAt: { gte: startDate } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          action: true,
          createdAt: true,
          userId: true,
        },
      }),

      // AI chat specific stats
      prisma.auditLog.findMany({
        where: {
          action: 'AI_CHAT',
          createdAt: { gte: startDate },
        },
        select: {
          changes: true,
          createdAt: true,
        },
      }),
    ])

    // Calculate AI chat metrics
    const aiChatMetrics = {
      totalRequests: aiChatLogs,
      successfulRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0,
      totalMessages: 0,
      guestRequests: 0,
      authenticatedRequests: 0,
    }

    let totalResponseTime = 0

    for (const log of aiChatStats) {
      const changes = log.changes as any

      if (changes?.success) {
        aiChatMetrics.successfulRequests++
      } else {
        aiChatMetrics.failedRequests++
      }

      if (changes?.responseTimeMs) {
        totalResponseTime += changes.responseTimeMs
      }

      if (changes?.messageCount) {
        aiChatMetrics.totalMessages += changes.messageCount
      }

      if (changes?.userEmail === 'guest') {
        aiChatMetrics.guestRequests++
      } else {
        aiChatMetrics.authenticatedRequests++
      }
    }

    if (aiChatStats.length > 0) {
      aiChatMetrics.avgResponseTime = Math.round(
        totalResponseTime / aiChatStats.length
      )
    }

    return NextResponse.json({
      period: {
        days: daysBack,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
      overview: {
        totalLogs,
        uniqueUsers: uniqueUsers.filter((u) => u.userId !== null).length,
      },
      aiChat: aiChatMetrics,
      topActions: topActions.map((a) => ({
        action: a.action,
        count: a._count,
      })),
      recentActivity: recentLogs,
    })
  } catch (error) {
    console.error('[Audit Logs Stats API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audit log statistics' },
      { status: 500 }
    )
  }
}
