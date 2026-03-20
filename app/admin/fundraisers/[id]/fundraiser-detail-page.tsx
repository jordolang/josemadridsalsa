import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { createMetadata } from '@/lib/metadata'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DollarSign, TrendingUp, Users, Package,
  Edit, Calendar, Target, Mail, Phone, Building2,
  Trophy, BarChart3, Activity
} from 'lucide-react'
import Link from 'next/link'
import { FundraiserStatus } from '@prisma/client'
import { format, differenceInDays, eachDayOfInterval } from 'date-fns'
import { CampaignStatsCard } from '@/components/fundraising/campaign-stats-card'
import { CampaignChart } from '@/components/fundraising/campaign-chart'

export const metadata: Metadata = createMetadata({
  title: 'Fundraiser Details - Jose Madrid Salsa Admin',
  description: 'View fundraiser campaign details.',
  pathname: '/admin/fundraisers',
})

async function getFundraiserWithStats(fundraiserId: string) {
  const [fundraiser, participants, orders, allOrders] = await Promise.all([
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
      take: 10,
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
    prisma.order.findMany({
      where: { fundraiserId },
      select: {
        createdAt: true,
        total: true,
        status: true,
      },
    }),
  ])

  if (!fundraiser) {
    notFound()
  }

  return { fundraiser, participants, orders, allOrders }
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
  const { fundraiser, participants, orders, allOrders } = await getFundraiserWithStats(id)

  // Calculate progress toward goal
  const goalProgress = fundraiser.goal
    ? Math.min(100, (Number(fundraiser.totalRevenue) / Number(fundraiser.goal)) * 100)
    : 0

  // Calculate campaign duration and days remaining
  const startDate = new Date(fundraiser.startDate)
  const endDate = new Date(fundraiser.endDate)
  const today = new Date()
  const totalDays = differenceInDays(endDate, startDate)
  const daysElapsed = Math.max(0, differenceInDays(today, startDate))
  const daysRemaining = Math.max(0, differenceInDays(endDate, today))

  // Generate revenue timeline data (group orders by day)
  const revenueByDay = new Map<string, number>()
  const days = eachDayOfInterval({ start: startDate, end: today })
  days.forEach(day => {
    revenueByDay.set(format(day, 'yyyy-MM-dd'), 0)
  })

  allOrders.forEach(order => {
    const dateKey = format(new Date(order.createdAt), 'yyyy-MM-dd')
    const current = revenueByDay.get(dateKey) || 0
    revenueByDay.set(dateKey, current + Number(order.total))
  })

  const revenueChartData = Array.from(revenueByDay.entries())
    .map(([date, revenue]) => ({
      name: format(new Date(date), 'MMM d'),
      value: revenue,
    }))
    .slice(-14) // Last 14 days

  // Participant performance data for chart
  const participantChartData = participants.slice(0, 5).map(p => ({
    name: p.name.split(' ')[0], // First name only
    value: Number(p.totalRevenue),
  }))

  // Order status distribution
  const statusCounts = allOrders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const orderStatusData = Object.entries(statusCounts).map(([status, count]) => ({
    name: status,
    value: count,
  }))

  // Calculate average order value
  const avgOrderValue = allOrders.length > 0
    ? allOrders.reduce((sum, order) => sum + Number(order.total), 0) / allOrders.length
    : 0

  return (
    <div className="space-y-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 min-h-screen">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              {fundraiser.name}
            </h1>
            <Badge className={statusColors[fundraiser.status]}>
              {fundraiser.status}
            </Badge>
          </div>
          <p className="mt-2 text-muted-foreground">{fundraiser.organizationName}</p>
        </div>
        <div className="flex items-center gap-4">
          {fundraiser.status === 'ACTIVE' && (
            <Badge variant="outline" className="px-4 py-2 text-lg">
              {daysRemaining} days remaining
            </Badge>
          )}
          {canWrite && (
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href={`/admin/fundraisers/${fundraiser.id}/edit`}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Campaign
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/admin/fundraisers/${fundraiser.id}/manage`}>
                  Manage Campaign
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <CampaignStatsCard
          title="Total Revenue"
          value={`$${Number(fundraiser.totalRevenue).toFixed(2)}`}
          icon={DollarSign}
          iconColor="text-green-600"
          borderColor="border-l-green-500"
          progress={fundraiser.goal ? goalProgress : undefined}
          progressLabel={fundraiser.goal ? `${goalProgress.toFixed(1)}% to $${Number(fundraiser.goal).toFixed(2)} goal` : undefined}
        />
        <CampaignStatsCard
          title="Total Commission"
          value={`$${Number(fundraiser.totalCommission).toFixed(2)}`}
          icon={TrendingUp}
          iconColor="text-blue-600"
          borderColor="border-l-blue-500"
        />
        <CampaignStatsCard
          title="Total Orders"
          value={fundraiser.totalOrders}
          icon={Package}
          iconColor="text-purple-600"
          borderColor="border-l-purple-500"
        />
        <CampaignStatsCard
          title="Active Participants"
          value={fundraiser._count.participants}
          icon={Users}
          iconColor="text-orange-600"
          borderColor="border-l-orange-500"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-teal-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-teal-600" />
              Average Order Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-teal-600">
              ${avgOrderValue.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-indigo-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4 text-indigo-600" />
              Campaign Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-600">
              Day {daysElapsed} of {totalDays}
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-amber-600" />
              Commission Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {Number(fundraiser.commissionRate)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
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

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <CampaignChart
              title="Revenue Over Time"
              description="Last 14 days of campaign revenue"
              data={revenueChartData}
              type="area"
              dataKey="value"
              xAxisKey="name"
              color="#22c55e"
            />
            <CampaignChart
              title="Top Participants"
              description="Revenue by top 5 participants"
              data={participantChartData}
              type="bar"
              dataKey="value"
              xAxisKey="name"
              color="#3b82f6"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <CampaignChart
              title="Order Status Distribution"
              description="Breakdown of order statuses"
              data={orderStatusData}
              type="pie"
              dataKey="value"
              xAxisKey="name"
            />
            <Card>
              <CardHeader>
                <CardTitle>Campaign Insights</CardTitle>
                <CardDescription>Key metrics and performance indicators</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm text-muted-foreground">Total Revenue</span>
                  <span className="font-semibold">${Number(fundraiser.totalRevenue).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm text-muted-foreground">Average Order</span>
                  <span className="font-semibold">${avgOrderValue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm text-muted-foreground">Total Orders</span>
                  <span className="font-semibold">{fundraiser.totalOrders}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm text-muted-foreground">Active Participants</span>
                  <span className="font-semibold">{fundraiser._count.participants}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm text-muted-foreground">Days Remaining</span>
                  <span className="font-semibold">{daysRemaining}</span>
                </div>
                {fundraiser.goal && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Goal Progress</span>
                    <span className="font-semibold">{goalProgress.toFixed(1)}%</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Leaderboard Tab */}
        <TabsContent value="leaderboard" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Participant Leaderboard
              </CardTitle>
              <CardDescription>
                Top performers ranked by total revenue generated
              </CardDescription>
            </CardHeader>
            <CardContent>
              {participants.length === 0 ? (
                <div className="py-8 text-center text-slate-500">
                  <Trophy className="mx-auto mb-2 h-12 w-12 text-slate-300" />
                  <p>No participants yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {participants.map((participant, index) => (
                    <div
                      key={participant.id}
                      className={`flex items-center justify-between rounded-lg border p-4 ${
                        index === 0 ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20' :
                        index === 1 ? 'bg-slate-50 border-slate-200 dark:bg-slate-900/20' :
                        index === 2 ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20' :
                        ''
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800">
                          <span className="font-bold text-lg">
                            {index === 0 && '🥇'}
                            {index === 1 && '🥈'}
                            {index === 2 && '🥉'}
                            {index > 2 && `#${index + 1}`}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold">{participant.name}</p>
                          <p className="text-sm text-muted-foreground">{participant.email}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-green-600">
                          ${Number(participant.totalRevenue).toFixed(2)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {participant.totalOrders} orders • ${Number(participant.totalCommission).toFixed(2)} commission
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
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
