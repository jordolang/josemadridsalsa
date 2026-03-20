'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function getFundraiserTimeline(fundraiserSlug: string) {
  const fundraiser = await prisma.fundraiser.findUnique({
    where: { slug: fundraiserSlug },
    include: {
      messages: {
        where: { isApproved: true, isHidden: false },
        include: {
          author: { select: { name: true, id: true } },
          order: { select: { total: true, id: true, participant: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      },
      orders: {
        where: {
          status: { in: ['CONFIRMED', 'SHIPPED', 'DELIVERED', 'PROCESSING'] },
        },
        include: {
          participant: { select: { name: true } },
          supportMessages: true
        },
        orderBy: { createdAt: 'desc' }
      }
    }
  })

  if (!fundraiser) {
    throw new Error('Fundraiser not found')
  }

  // Interleave and format
  const timelineEvents: Array<{
    id: string
    type: 'MESSAGE' | 'ORDER'
    content?: string
    authorName: string
    authorAvatar?: string | null
    amount?: number
    createdAt: Date
    participantName?: string | null
  }> = []

  const messages = fundraiser.messages || []
  const orders = fundraiser.orders || []

  for (const msg of messages) {
    timelineEvents.push({
      id: msg.id,
      type: 'MESSAGE',
      content: msg.content,
      authorName: msg.authorName || msg.author?.name || 'Anonymous',
      authorAvatar: msg.authorAvatar || undefined,
      amount: msg.order?.total?.toNumber(),
      createdAt: msg.createdAt,
      participantName: msg.order?.participant?.name
    })
  }

  for (const order of orders) {
    if (!order.supportMessages || order.supportMessages.length === 0) {
      let customerName = 'Anonymous Supporter'
      if (order.guestEmail || order.guestPhone) {
        customerName = order.guestEmail?.split('@')[0] || order.guestPhone || 'Guest'
      }
      
      timelineEvents.push({
        id: order.id,
        type: 'ORDER',
        amount: order.total.toNumber(),
        authorName: customerName,
        createdAt: order.createdAt,
        participantName: order.participant?.name
      })
    }
  }

  timelineEvents.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  return { 
    timelineEvents, 
    goal: fundraiser.goal?.toNumber() || 0, 
    currentTotal: fundraiser.totalRevenue.toNumber(), 
    enableSocialFeatures: fundraiser.enableSocialFeatures 
  }
}

export async function getFundraiserHeavyHitters(fundraiserSlug: string) {
  const fundraiser = await prisma.fundraiser.findUnique({
    where: { slug: fundraiserSlug },
    select: { id: true, enableSocialFeatures: true }
  })
  
  if (!fundraiser || !fundraiser.enableSocialFeatures) return []

  const topParticipants = await prisma.fundraiserParticipant.findMany({
    where: { fundraiserId: fundraiser.id, status: 'ACTIVE' },
    orderBy: { totalRevenue: 'desc' },
    take: 3,
    select: {
      id: true,
      name: true,
      totalRevenue: true,
      totalOrders: true,
    }
  })

  return topParticipants.map(p => ({
    ...p,
    totalRevenue: p.totalRevenue.toNumber()
  }))
}

export async function getMonthlyChampionship(month: number, year: number) {
  const startOfMonth = new Date(year, month - 1, 1)
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999)

  const activeFundraisers = await prisma.fundraiser.findMany({
    where: {
      status: 'ACTIVE',
      startDate: { lte: endOfMonth },
      endDate: { gte: startOfMonth }
    },
    select: {
      id: true,
      name: true,
      slug: true,
      organizationName: true,
      totalRevenue: true,
      logoUrl: true,
      participants: {
        orderBy: { totalRevenue: 'desc' },
        take: 1,
        select: { name: true, totalRevenue: true }
      }
    },
    orderBy: {
      totalRevenue: 'desc'
    }
  })

  const history = await prisma.fundraiserChampionship.findMany({
    orderBy: [ { year: 'desc' }, { month: 'desc' } ],
    take: 12
  })

  return { 
    currentLeaderboard: activeFundraisers.map(f => ({
      ...f,
      totalRevenue: f.totalRevenue.toNumber(),
      topParticipant: f.participants[0] ? {
        name: f.participants[0].name,
        revenue: f.participants[0].totalRevenue.toNumber()
      } : null
    })),
    history 
  }
}

export async function postSupportMessage(fundraiserId: string, content: string, orderId?: string) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    throw new Error('Not authenticated - Please log in with Facebook or Google to leave a message')
  }

  const newMsg = await prisma.fundraiserMessage.create({
    data: {
      fundraiserId,
      content,
      authorId: session.user.id,
      authorName: session.user.name || 'Anonymous',
      authorAvatar: session.user.image,
      orderId: orderId || null
    }
  })

  revalidatePath('/[fundraiser-subdomain]/[slug]', 'page')
  return newMsg
}
