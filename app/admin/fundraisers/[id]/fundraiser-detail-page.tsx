import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { createMetadata } from '@/lib/metadata'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DollarSign, TrendingUp, Users, Package,
  Edit, Calendar, Target, Mail, Phone, Building2
} from 'lucide-react'
import Link from 'next/link'
import { FundraiserStatus } from '@prisma/client'
import { format } from 'date-fns'

export const metadata: Metadata = createMetadata({
  title: 'Fundraiser Details - Jose Madrid Salsa Admin',
  description: 'View fundraiser campaign details.',
  pathname: '/admin/fundraisers',
})

async function getFundraiserWithStats(fundraiserId: string) {
  const [fundraiser, participants, orders] = await Promise.all([
    prisma.fundraiser.findUnique({
      where: { id: fundraiserId },
      include: {
        _count: {
          select: {
            products: true,
            orders: true,
            participants: true,
          },
        },
      },
    }),
    prisma.fundraiserParticipant.findMany({
      where: {
        fundraiserId,
        status: 'ACTIVE',
      },
      orderBy: { totalRevenue: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        email: true,
        totalOrders: true,
        totalRevenue: true,
        totalCommission: true,
      },
    }),
    prisma.order.findMany({
      where: { fundraiserId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        participant: {
          select: {
            name: true,
          },
        },
      },
    }),
  ])

  if (!fundraiser) {
    notFound()
  }

  return { fundraiser, participants, orders }
}

const statusColors: Record<FundraiserStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-800',
  ACTIVE: 'bg-green-100 text-green-800',
  ENDED: 'bg-blue-100 text-blue-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

export default async function FundraiserDetailPage({
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
  const { fundraiser, participants, orders } = await getFundraiserWithStats(id)

  // Calculate progress toward goal
  const goalProgress = fundraiser.goal
    ? Math.min(100, (Number(fundraiser.totalRevenue) / Number(fundraiser.goal)) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{fundraiser.name}</h1>
            <Badge className={statusColors[fundraiser.status]}>
              {fundraiser.status}
            </Badge>
          </div>
          <p className="mt-1 text-slate-600">{fundraiser.organizationName}</p>
        </div>
        {canWrite && (
          <Button asChild>
            <Link href={`/admin/fundraisers/${fundraiser.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Campaign
            </Link>
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-slate-600">Total Revenue</p>
              <p className="text-2xl font-bold">${Number(fundraiser.totalRevenue).toFixed(2)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm text-slate-600">Total Commission</p>
              <p className="text-2xl font-bold">${Number(fundraiser.totalCommission).toFixed(2)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Package className="h-8 w-8 text-purple-600" />
            <div>
              <p className="text-sm text-slate-600">Total Orders</p>
              <p className="text-2xl font-bold">{fundraiser.totalOrders}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-orange-600" />
            <div>
              <p className="text-sm text-slate-600">Participants</p>
              <p className="text-2xl font-bold">{fundraiser._count.participants}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="participants">Participants</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Campaign Info */}
            <Card className="p-6">
              <h3 className="mb-4 text-lg font-semibold">Campaign Information</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Building2 className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-600">Organization</p>
                    <p className="font-medium">{fundraiser.organizationName}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-600">Campaign Period</p>
                    <p className="font-medium">
                      {format(new Date(fundraiser.startDate), 'MMM d, yyyy')} - {format(new Date(fundraiser.endDate), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
                {fundraiser.goal && (
                  <div className="flex items-start gap-2">
                    <Target className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div className="flex-1">
                      <p className="text-sm text-slate-600">Goal Progress</p>
                      <p className="font-medium">${Number(fundraiser.totalRevenue).toFixed(2)} / ${Number(fundraiser.goal).toFixed(2)}</p>
                      <div className="mt-2 h-2 w-full rounded-full bg-slate-200">
                        <div
                          className="h-2 rounded-full bg-green-600 transition-all"
                          style={{ width: `${goalProgress}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{goalProgress.toFixed(1)}% of goal</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <TrendingUp className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-600">Commission Rate</p>
                    <p className="font-medium">{Number(fundraiser.commissionRate)}%</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Contact Info */}
            <Card className="p-6">
              <h3 className="mb-4 text-lg font-semibold">Contact Information</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Mail className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-600">Email</p>
                    <p className="font-medium">{fundraiser.contactEmail}</p>
                  </div>
                </div>
                {fundraiser.contactPhone && (
                  <div className="flex items-start gap-2">
                    <Phone className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-sm text-slate-600">Phone</p>
                      <p className="font-medium">{fundraiser.contactPhone}</p>
                    </div>
                  </div>
                )}
                {fundraiser.description && (
                  <div>
                    <p className="text-sm text-slate-600">Description</p>
                    <p className="mt-1 text-sm">{fundraiser.description}</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Participants Tab */}
        <TabsContent value="participants" className="space-y-4">
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Top Participants</h3>
              {canWrite && (
                <Button size="sm" asChild>
                  <Link href={`/admin/fundraisers/${fundraiser.id}/participants`}>
                    View All
                  </Link>
                </Button>
              )}
            </div>

            {participants.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                <Users className="mx-auto mb-2 h-12 w-12 text-slate-300" />
                <p>No participants yet</p>
                {canWrite && (
                  <Button className="mt-4" size="sm" asChild>
                    <Link href={`/admin/fundraisers/${fundraiser.id}/participants`}>
                      Add Participants
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{participant.name}</p>
                      <p className="text-sm text-slate-600">{participant.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${Number(participant.totalRevenue).toFixed(2)}</p>
                      <p className="text-sm text-slate-600">{participant.totalOrders} orders</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders" className="space-y-4">
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Recent Orders</h3>
              <Button size="sm" variant="outline" asChild>
                <Link href="/admin/orders">View All Orders</Link>
              </Button>
            </div>

            {orders.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                <Package className="mx-auto mb-2 h-12 w-12 text-slate-300" />
                <p>No orders yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">Order #{order.orderNumber}</p>
                      <p className="text-sm text-slate-600">
                        {order.participant ? `By ${order.participant.name}` : 'Direct order'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {format(new Date(order.createdAt), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${Number(order.total).toFixed(2)}</p>
                      <Badge variant="outline" className="text-xs">
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
