import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import { createMetadata } from '@/lib/metadata'
import { ParticipantDashboard } from '@/components/fundraising/participant-dashboard'

interface PageProps {
  params: Promise<{
    slug: string
    participantCode: string
  }>
}

async function getParticipantDashboardData(slug: string, participantCode: string) {
  // Find the fundraiser by slug
  const fundraiser = await prisma.fundraiser.findUnique({
    where: {
      slug,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      organizationName: true,
      commissionRate: true,
      goal: true,
      totalRevenue: true,
      startDate: true,
      endDate: true,
    },
  })

  if (!fundraiser) {
    return null
  }

  // Find the participant by referral code
  const participant = await prisma.fundraiserParticipant.findUnique({
    where: {
      referralCode: participantCode,
    },
    select: {
      id: true,
      fundraiserId: true,
      name: true,
      email: true,
      referralCode: true,
      status: true,
      totalOrders: true,
      totalRevenue: true,
      totalCommission: true,
    },
  })

  // Validate participant belongs to this fundraiser and is active
  if (
    !participant ||
    participant.fundraiserId !== fundraiser.id ||
    participant.status !== 'ACTIVE'
  ) {
    return null
  }

  // Fetch orders attributed to this participant
  const orders = await prisma.order.findMany({
    where: {
      participantId: participant.id,
      fundraiserId: fundraiser.id,
    },
    select: {
      id: true,
      orderNumber: true,
      total: true,
      status: true,
      createdAt: true,
      items: {
        select: {
          productName: true,
          quantity: true,
          unitPrice: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 50, // Limit to recent 50 orders
  })

  return { fundraiser, participant, orders }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, participantCode } = await params
  const data = await getParticipantDashboardData(slug, participantCode)

  if (!data) {
    return createMetadata({
      title: 'Dashboard Not Found',
      description: 'The participant dashboard you are looking for could not be found.',
    })
  }

  const { fundraiser, participant } = data

  return createMetadata({
    title: `${participant.name}'s Dashboard - ${fundraiser.name}`,
    description: `Track your fundraising progress for ${fundraiser.organizationName}`,
    pathname: `/fundraisers/${slug}/dashboard/${participantCode}`,
  })
}

export default async function ParticipantDashboardPage({ params }: PageProps) {
  const { slug, participantCode } = await params
  const data = await getParticipantDashboardData(slug, participantCode)

  if (!data) {
    notFound()
  }

  const { fundraiser, participant, orders } = data

  // Build the referral URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const referralUrl = `${baseUrl}/fundraisers/${fundraiser.slug}/${participant.referralCode}`

  // Convert Prisma data to component props format
  const dashboardData = {
    participant: {
      id: participant.id,
      name: participant.name,
      email: participant.email,
      referralCode: participant.referralCode,
      totalOrders: participant.totalOrders,
      totalRevenue: Number(participant.totalRevenue),
      totalCommission: Number(participant.totalCommission),
    },
    fundraiser: {
      name: fundraiser.name,
      slug: fundraiser.slug,
      organizationName: fundraiser.organizationName,
      commissionRate: Number(fundraiser.commissionRate),
      goal: fundraiser.goal ? Number(fundraiser.goal) : undefined,
      totalRevenue: Number(fundraiser.totalRevenue),
      startDate: fundraiser.startDate,
      endDate: fundraiser.endDate,
    },
    orders: orders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      total: Number(order.total),
      status: order.status,
      createdAt: order.createdAt,
      items: order.items.map(item => ({
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
      })),
    })),
    referralUrl,
  }

  return <ParticipantDashboard {...dashboardData} />
}
