import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { createMetadata } from '@/lib/metadata'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Users, DollarSign, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { ParticipantList } from '@/components/fundraising/participant-list'
import { AddParticipantForm } from '@/components/fundraising/add-participant-form'

export const metadata: Metadata = createMetadata({
  title: 'Participants - Jose Madrid Salsa Admin',
  description: 'Manage fundraiser participants.',
  pathname: '/admin/fundraisers',
})

async function getFundraiserParticipants(fundraiserId: string) {
  const fundraiser = await prisma.fundraiser.findUnique({
    where: { id: fundraiserId },
    select: {
      id: true,
      name: true,
      slug: true,
      organizationName: true,
    },
  })

  if (!fundraiser) {
    notFound()
  }

  const [participants, stats] = await Promise.all([
    prisma.fundraiserParticipant.findMany({
      where: { fundraiserId },
      orderBy: { totalRevenue: 'desc' },
    }),
    prisma.fundraiserParticipant.aggregate({
      where: { fundraiserId, status: 'ACTIVE' },
      _sum: {
        totalOrders: true,
        totalRevenue: true,
        totalCommission: true,
      },
      _count: true,
    }),
  ])

  return {
    fundraiser,
    participants,
    stats: {
      totalParticipants: stats._count,
      totalOrders: stats._sum.totalOrders || 0,
      totalRevenue: stats._sum.totalRevenue || 0,
      totalCommission: stats._sum.totalCommission || 0,
    },
  }
}

export default async function ParticipantsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'orders:read'))) {
    redirect('/admin/fundraisers')
  }

  const canWrite = await hasPermission(user, 'orders:write')
  const { fundraiser, participants, stats } = await getFundraiserParticipants(id)

  // Construct base URL for referral links
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const referralBaseUrl = `${baseUrl}/fundraisers/${fundraiser.slug}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="mb-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/admin/fundraisers/${fundraiser.id}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Campaign
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold">Participants</h1>
          <p className="text-muted-foreground">
            {fundraiser.name} - {fundraiser.organizationName}
          </p>
        </div>
        {canWrite && <AddParticipantForm fundraiserId={fundraiser.id} />}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-purple-600" />
            <div>
              <p className="text-sm text-muted-foreground">Total Participants</p>
              <p className="text-2xl font-bold">{stats.totalParticipants}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold">${Number(stats.totalRevenue).toFixed(2)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Total Commission</p>
              <p className="text-2xl font-bold">${Number(stats.totalCommission).toFixed(2)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-orange-600" />
            <div>
              <p className="text-sm text-muted-foreground">Total Orders</p>
              <p className="text-2xl font-bold">{stats.totalOrders}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Participants Table */}
      <Card className="p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">All Participants</h2>
          <p className="text-sm text-muted-foreground">
            Manage participants and track their performance
          </p>
        </div>
        <ParticipantList
          participants={participants}
          fundraiserId={fundraiser.id}
          canWrite={canWrite}
          baseUrl={referralBaseUrl}
        />
      </Card>
    </div>
  )
}
