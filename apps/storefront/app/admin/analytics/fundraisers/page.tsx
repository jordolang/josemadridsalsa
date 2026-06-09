import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import {
  Activity,
  DollarSign,
  Flag,
  ShoppingBag,
  Swords,
  Target,
  Trophy,
  Users,
} from 'lucide-react'
import prisma from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { StatsCard } from '@/components/admin/StatsCard'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { createMetadata } from '@/lib/metadata'
import { formatPrice } from '@/lib/utils'
import { RANGE_OPTIONS, getDateRange, type AnalyticsRangeKey } from '@/lib/analytics/date-range'
import { AnalyticsRangeSelect } from '@/components/admin/AnalyticsRangeSelect'

export const metadata: Metadata = createMetadata({
  title: 'Fundraiser Analytics - Jose Madrid Salsa Admin',
  description: 'Per-campaign revenue, top participants, and Battle Arena performance.',
  pathname: '/admin/analytics/fundraisers',
})

type SearchParams = { range?: string }

function rangeKeyFromParam(raw: string | undefined): AnalyticsRangeKey {
  const match = RANGE_OPTIONS.find((r) => r.value === raw)
  return (match?.value ?? '30d') as AnalyticsRangeKey
}

export default async function FundraiserAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'orders:read'))) {
    redirect('/admin')
  }

  const rangeKey = rangeKeyFromParam(params.range)
  const { start, end } = getDateRange(rangeKey)

  const [
    totalCampaigns,
    activeCampaigns,
    orderAgg,
    topCampaigns,
    topParticipants,
    arenaTeams,
    recentSales,
  ] = await Promise.all([
    prisma.fundraiser.count(),
    prisma.fundraiser.count({ where: { status: 'ACTIVE', isActive: true } }),
    prisma.order.aggregate({
      where: { fundraiserId: { not: null }, createdAt: { gte: start, lte: end } },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.fundraiser.findMany({
      orderBy: { totalRevenue: 'desc' },
      take: 10,
      select: {
        id: true,
        slug: true,
        name: true,
        organizationName: true,
        status: true,
        totalRevenue: true,
        totalCommission: true,
        totalOrders: true,
        goal: true,
        commissionRate: true,
        logoUrl: true,
        _count: { select: { participants: true } },
      },
    }),
    prisma.fundraiserParticipant.findMany({
      where: { status: 'ACTIVE', totalRevenue: { gt: 0 } },
      orderBy: { totalRevenue: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        email: true,
        totalRevenue: true,
        totalOrders: true,
        totalCommission: true,
        fundraiser: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.fundraiserTeam.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { salesCount: 'desc' },
      take: 10,
      select: {
        id: true,
        slug: true,
        name: true,
        school: true,
        teamColor: true,
        activePeriod: true,
        salesCount: true,
        hpCurrent: true,
        goalAmount: true,
        pricePerUnit: true,
      },
    }),
    prisma.fundraiserSaleEvent.aggregate({
      where: { createdAt: { gte: start, lte: end } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ])

  const fundraiserRevenue = Number(orderAgg._sum.total ?? 0)
  const fundraiserOrders = orderAgg._count._all
  const arenaSales = recentSales._count._all
  const arenaRevenue = Number(recentSales._sum.amount ?? 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fundraiser Analytics</h1>
          <p className="text-muted-foreground">
            Revenue, top teams, and Battle Arena performance across all campaigns.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AnalyticsRangeSelect value={rangeKey} />
          <Button variant="outline" asChild>
            <Link href="/admin/analytics">← Overview</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/fundraisers">Manage Campaigns</Link>
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard
          title="Fundraiser revenue"
          value={formatPrice(fundraiserRevenue)}
          subtitle={`${fundraiserOrders.toLocaleString()} orders`}
          icon={DollarSign}
          color="blue"
        />
        <StatsCard
          title="Active campaigns"
          value={activeCampaigns.toLocaleString()}
          subtitle={`${totalCampaigns} total`}
          icon={Flag}
          color="green"
        />
        <StatsCard
          title="Arena sales"
          value={arenaSales.toLocaleString()}
          subtitle={formatPrice(arenaRevenue)}
          icon={Swords}
          color="purple"
        />
        <StatsCard
          title="Arena teams active"
          value={arenaTeams.length.toLocaleString()}
          icon={Users}
          color="orange"
        />
      </div>

      {/* Top campaigns */}
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Top campaigns by lifetime revenue</h2>
        </div>
        {topCampaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No campaigns yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Goal</TableHead>
                  <TableHead className="w-[180px]">Goal Progress</TableHead>
                  <TableHead className="text-right">Participants</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topCampaigns.map((c) => {
                  const revenue = Number(c.totalRevenue)
                  const goal = c.goal ? Number(c.goal) : 0
                  const pct = goal > 0 ? Math.min(100, (revenue / goal) * 100) : 0
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="max-w-[260px]">
                        <Link
                          href={`/admin/fundraisers/${c.id}/manage`}
                          className="block font-medium hover:underline"
                        >
                          {c.name}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.organizationName}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.status === 'ACTIVE' ? 'default' : 'outline'}>
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatPrice(revenue)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPrice(Number(c.totalCommission))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.totalOrders.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {goal > 0 ? formatPrice(goal) : '—'}
                      </TableCell>
                      <TableCell>
                        {goal > 0 ? (
                          <div className="space-y-1">
                            <Progress value={pct} />
                            <p className="text-[10px] text-muted-foreground">{pct.toFixed(0)}%</p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">No goal</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c._count.participants}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Top participants */}
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Top participants across campaigns</h2>
        </div>
        {topParticipants.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active participants yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participant</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topParticipants.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/fundraisers/${p.fundraiser.id}/manage`}
                        className="text-sm hover:underline"
                      >
                        {p.fundraiser.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatPrice(Number(p.totalRevenue))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.totalOrders.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPrice(Number(p.totalCommission))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Arena teams */}
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Swords className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Battle Arena — active teams</h2>
        </div>
        {arenaTeams.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active arena teams. Promote a fundraiser from its Manage page to start.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Raised</TableHead>
                  <TableHead className="w-[180px]">HP / Goal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {arenaTeams.map((t) => {
                  const raised = t.salesCount * t.pricePerUnit
                  const pct = t.goalAmount > 0 ? Math.min(100, (t.hpCurrent / t.goalAmount) * 100) : 0
                  return (
                    <TableRow key={t.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-3 w-3 rounded-full"
                            style={{ backgroundColor: t.teamColor }}
                            aria-hidden
                          />
                          <Link href={`/fundraise/${t.slug}`} className="font-medium hover:underline">
                            {t.name}
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{t.school}</TableCell>
                      <TableCell className="font-mono text-xs">{t.activePeriod}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {t.salesCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        ${raised.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Progress value={pct} />
                          <p className="text-[10px] text-muted-foreground">
                            {t.hpCurrent}/{t.goalAmount} ({pct.toFixed(0)}%)
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  )
}
