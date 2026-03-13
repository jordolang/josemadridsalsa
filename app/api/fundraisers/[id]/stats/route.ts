import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/fundraisers/[id]/stats
 * Get aggregated statistics for a fundraiser campaign
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const fundraiserId = params.id

    // Verify fundraiser exists
    const fundraiser = await prisma.fundraiser.findUnique({
      where: { id: fundraiserId },
      select: {
        id: true,
        name: true,
        goal: true,
        startDate: true,
        endDate: true,
        totalOrders: true,
        totalRevenue: true,
        totalCommission: true,
        status: true,
      },
    })

    if (!fundraiser) {
      return NextResponse.json({ error: 'Fundraiser not found' }, { status: 404 })
    }

    // Get aggregated participant stats
    const [participantCount, participantStats, topParticipants, recentOrders] =
      await Promise.all([
        // Total participant count
        prisma.fundraiserParticipant.count({
          where: { fundraiserId },
        }),

        // Aggregated participant stats
        prisma.fundraiserParticipant.aggregate({
          where: { fundraiserId },
          _sum: {
            totalOrders: true,
            totalRevenue: true,
            totalCommission: true,
          },
        }),

        // Top 5 participants by revenue
        prisma.fundraiserParticipant.findMany({
          where: { fundraiserId },
          orderBy: { totalRevenue: 'desc' },
          take: 5,
          select: {
            id: true,
            name: true,
            email: true,
            referralCode: true,
            totalOrders: true,
            totalRevenue: true,
            totalCommission: true,
          },
        }),

        // Recent 10 orders
        prisma.order.findMany({
          where: { fundraiserId },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            orderNumber: true,
            total: true,
            status: true,
            createdAt: true,
            participant: {
              select: {
                name: true,
                referralCode: true,
              },
            },
          },
        }),
      ])

    // Calculate progress metrics
    const now = new Date()
    const isActive = fundraiser.status === 'ACTIVE'
    const hasStarted = now >= fundraiser.startDate
    const hasEnded = now > fundraiser.endDate
    const daysRemaining = hasEnded
      ? 0
      : Math.ceil(
          (fundraiser.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        )

    // Calculate goal progress
    let goalProgress = null
    if (fundraiser.goal) {
      const goalAmount = Number(fundraiser.goal)
      const currentRevenue = Number(fundraiser.totalRevenue)
      goalProgress = {
        goal: goalAmount,
        current: currentRevenue,
        percentage: goalAmount > 0 ? (currentRevenue / goalAmount) * 100 : 0,
        remaining: Math.max(0, goalAmount - currentRevenue),
      }
    }

    // Calculate average order value
    const avgOrderValue =
      fundraiser.totalOrders > 0
        ? Number(fundraiser.totalRevenue) / fundraiser.totalOrders
        : 0

    return NextResponse.json({
      fundraiser: {
        id: fundraiser.id,
        name: fundraiser.name,
        status: fundraiser.status,
        isActive,
        hasStarted,
        hasEnded,
        daysRemaining,
        startDate: fundraiser.startDate.toISOString(),
        endDate: fundraiser.endDate.toISOString(),
      },
      overview: {
        totalOrders: fundraiser.totalOrders,
        totalRevenue: Number(fundraiser.totalRevenue),
        totalCommission: Number(fundraiser.totalCommission),
        participantCount,
        avgOrderValue: Number(avgOrderValue.toFixed(2)),
      },
      goalProgress,
      participants: {
        total: participantCount,
        activeCount: participantCount, // Could be filtered by status if needed
        totalOrders: participantStats._sum.totalOrders || 0,
        totalRevenue: Number(participantStats._sum.totalRevenue || 0),
        totalCommission: Number(participantStats._sum.totalCommission || 0),
        topPerformers: topParticipants.map((p) => ({
          id: p.id,
          name: p.name,
          email: p.email,
          referralCode: p.referralCode,
          totalOrders: p.totalOrders,
          totalRevenue: Number(p.totalRevenue),
          totalCommission: Number(p.totalCommission),
        })),
      },
      recentOrders: recentOrders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        total: Number(order.total),
        status: order.status,
        createdAt: order.createdAt.toISOString(),
        participant: order.participant
          ? {
              name: order.participant.name,
              referralCode: order.participant.referralCode,
            }
          : null,
      })),
    })
  } catch (error) {
    console.error('[Fundraiser Stats API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch fundraiser statistics' },
      { status: 500 }
    )
  }
}
