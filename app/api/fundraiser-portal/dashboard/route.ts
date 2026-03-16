import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireFundraiserAccess, getCurrentFundraiserAccount } from '@/lib/rbac'

export async function GET() {
  try {
    await requireFundraiserAccess()
    const account = await getCurrentFundraiserAccount()
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const fundraiser = await prisma.fundraiser.findUnique({
      where: { id: account.fundraiserId },
      include: {
        _count: { select: { orders: true, participants: true } },
      },
    })

    if (!fundraiser) {
      return NextResponse.json({ error: 'Fundraiser not found' }, { status: 404 })
    }

    return NextResponse.json({
      totalRevenue: Number(fundraiser.totalRevenue),
      totalCommission: Number(fundraiser.totalCommission),
      totalOrders: fundraiser.totalOrders,
      participantCount: fundraiser._count.participants,
      goal: fundraiser.goal ? Number(fundraiser.goal) : null,
      commissionRate: Number(fundraiser.commissionRate),
      status: fundraiser.status,
      isActive: fundraiser.isActive,
      startDate: fundraiser.startDate,
      endDate: fundraiser.endDate,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('Unauthorized') ? 401 : message.includes('Forbidden') ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
