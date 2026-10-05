'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getBattleStandings } from '@/lib/arena/standings'

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

/**
 * The live standings for one month's battle, from the same `getBattleStandings` the season-end
 * route crowns its champion with — the season's roster ranked by sales placed during the battle.
 */
export async function getMonthlyChampionship(month: number, year: number) {
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) {
    throw new Error('Invalid month')
  }
  const period = `${year}-${String(month).padStart(2, '0')}`

  const [standings, history] = await Promise.all([
    getBattleStandings(period),
    prisma.fundraiserChampionship.findMany({
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: 12,
    }),
  ])

  return {
    period,
    currentLeaderboard: standings.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      organizationName: t.school,
      logoUrl: t.logoUrl,
      salesCount: t.battleSales,
      totalRevenue: t.battleRaised,
      topParticipant: t.topSeller ? { name: t.topSeller.name, revenue: t.topSeller.raised } : null,
    })),
    history,
  }
}

export async function postSupportMessage(fundraiserSlugOrId: string, content: string, orderId?: string) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    throw new Error('Not authenticated - Please log in to leave a message')
  }

  // Resolve slug or id to a fundraiser
  const fundraiser = await prisma.fundraiser.findFirst({
    where: { OR: [{ id: fundraiserSlugOrId }, { slug: fundraiserSlugOrId }] },
    select: { id: true },
  })
  if (!fundraiser) throw new Error('Fundraiser not found')

  const userId = (session.user as any).id as string | null
  const userImage = (session.user as any).image as string | null

  const newMsg = await prisma.fundraiserMessage.create({
    data: {
      fundraiserId: fundraiser.id,
      content,
      authorId: userId,
      authorName: session.user.name || 'Anonymous',
      authorAvatar: userImage,
      orderId: orderId || null,
    },
  })

  revalidatePath(`/fundraisers/${fundraiserSlugOrId}`)
  return newMsg
}
