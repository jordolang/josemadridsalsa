import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { subDays } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'analytics:read'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const since = subDays(new Date(), days)

    const [campaigns, totalSubscribers, recentGrowth, logStats, suppressionCount] = await Promise.all([
      prisma.emailCampaign.findMany({
        where: { createdAt: { gte: since } },
        select: {
          id: true,
          name: true,
          status: true,
          totalRecipients: true,
          sentCount: true,
          failedCount: true,
          bouncedCount: true,
          createdAt: true,
          completedAt: true,
          recipients: {
            select: { status: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.mailingListSubscriber.count({ where: { status: 'SUBSCRIBED' } }),
      prisma.mailingListSubscriber.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true, status: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.emailLog.groupBy({
        by: ['status'],
        where: { createdAt: { gte: since } },
        _count: { status: true },
      }),
      prisma.emailSuppression.count(),
    ])

    // Compute campaign stats
    const campaignStats = campaigns.map((c) => {
      const opened = c.recipients.filter((r) =>
        ['OPENED', 'CLICKED'].includes(r.status)
      ).length
      const clicked = c.recipients.filter((r) => r.status === 'CLICKED').length
      const sent = c.sentCount
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        sent,
        failed: c.failedCount,
        bounced: c.bouncedCount,
        opened,
        clicked,
        openRate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
        clickRate: sent > 0 ? Math.round((clicked / sent) * 100) : 0,
        createdAt: c.createdAt,
        completedAt: c.completedAt,
      }
    })

    // Build subscriber growth by day
    const growthByDay: Record<string, { new: number; unsubscribed: number }> = {}
    for (const sub of recentGrowth) {
      const day = sub.createdAt.toISOString().split('T')[0]
      if (!growthByDay[day]) growthByDay[day] = { new: 0, unsubscribed: 0 }
      if (sub.status === 'SUBSCRIBED') growthByDay[day].new++
      if (sub.status === 'UNSUBSCRIBED') growthByDay[day].unsubscribed++
    }

    const growthChart = Object.entries(growthByDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts }))

    return NextResponse.json({
      campaigns: campaignStats,
      totalSubscribers,
      suppressionCount,
      growthChart,
      logStats,
    })
  } catch (error) {
    console.error('Email analytics error:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
