import { redirect } from 'next/navigation'
import { Download, DollarSign, ShoppingBag, TrendingUp } from 'lucide-react'
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { StatsCard } from '@/components/admin/StatsCard'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/utils'
import { RANGE_OPTIONS, getDateRange, type AnalyticsRangeKey } from '@/lib/analytics/date-range'
import { OrderAnalyticsCharts } from '@/components/admin/OrderAnalyticsCharts'
import Link from 'next/link'

type SearchParams = {
  range?: string
}

type DayPoint = {
  date: string
  label: string
  orders: number
  revenue: number
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isValidRange(value: string | undefined): value is AnalyticsRangeKey {
  return value === '7d' || value === '30d' || value === '90d' || value === '365d'
}

async function getOrderAnalytics(range: AnalyticsRangeKey) {
  const { start, end, days } = getDateRange(range)

  const excludedStatuses: OrderStatus[] = [OrderStatus.CANCELLED, OrderStatus.REFUNDED]
  const includedPayments: PaymentStatus[] = [PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED]

  const orderFilter: Prisma.OrderWhereInput = {
    createdAt: { gte: start, lte: end },
    status: { notIn: excludedStatuses },
    paymentStatus: { in: includedPayments },
  }

  const [orders, statusBreakdown] = await Promise.all([
    prisma.order.findMany({
      where: orderFilter,
      select: {
        id: true,
        total: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.order.groupBy({
      by: ['status'],
      where: { createdAt: { gte: start, lte: end } },
      _count: { _all: true },
    }),
  ])

  const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0)
  const totalOrders = orders.length
  const averageOrderValue = totalOrders === 0 ? 0 : totalRevenue / totalOrders

  // Build daily chart data
  const dayBuckets = new Map<string, DayPoint>()
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(end)
    date.setDate(end.getDate() - offset)
    date.setHours(0, 0, 0, 0)
    const key = toDateKey(date)
    dayBuckets.set(key, {
      date: key,
      label: formatDateLabel(date),
      orders: 0,
      revenue: 0,
    })
  }

  for (const order of orders) {
    const key = toDateKey(order.createdAt)
    const bucket = dayBuckets.get(key)
    if (bucket) {
      bucket.orders += 1
      bucket.revenue += Number(order.total || 0)
    }
  }

  const chart = Array.from(dayBuckets.values()).sort((a, b) =>
    a.date < b.date ? -1 : 1
  )

  const statusCounts = statusBreakdown.map((item) => ({
    status: item.status,
    count: typeof item._count === 'object' && '_all' in item._count
      ? Number(item._count._all)
      : 0,
  }))

  return {
    totalRevenue,
    totalOrders,
    averageOrderValue,
    chart,
    statusCounts,
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  }
}

export default async function OrderAnalyticsPage(props: {
  searchParams: Promise<SearchParams>
}) {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'analytics:read'))) {
    redirect('/admin')
  }

  const searchParams = await props.searchParams
  const range: AnalyticsRangeKey = isValidRange(searchParams.range) ? searchParams.range : '30d'
  const data = await getOrderAnalytics(range)

  const exportUrl = `/api/admin/orders/export?startDate=${data.startDate}&endDate=${data.endDate}`

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Order Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">
            Revenue, order volume, and trends
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Date range selector */}
          <div className="flex rounded-lg border border-slate-200 bg-white">
            {RANGE_OPTIONS.map((option) => (
              <Link
                key={option.value}
                href={`/admin/analytics/orders?range=${option.value}`}
                className={`px-3 py-1.5 text-sm font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${
                  range === option.value
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {option.label}
              </Link>
            ))}
          </div>
          {/* Export CSV */}
          <a href={exportUrl} download>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </a>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatsCard
          title="Total Revenue"
          value={formatPrice(data.totalRevenue)}
          icon={DollarSign}
          color="green"
        />
        <StatsCard
          title="Total Orders"
          value={data.totalOrders.toLocaleString()}
          icon={ShoppingBag}
          color="blue"
        />
        <StatsCard
          title="Avg Order Value"
          value={formatPrice(data.averageOrderValue)}
          icon={TrendingUp}
          color="purple"
        />
      </div>

      {/* Charts */}
      <OrderAnalyticsCharts chart={data.chart} />

      {/* Order status breakdown */}
      {data.statusCounts.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Order Status Breakdown
          </h2>
          <div className="space-y-3">
            {data.statusCounts.map((item) => {
              const total = data.statusCounts.reduce((s, i) => s + i.count, 0)
              const pct = total === 0 ? 0 : (item.count / total) * 100
              return (
                <div key={item.status} className="flex items-center gap-3">
                  <span className="w-32 text-sm font-medium text-slate-700 capitalize">
                    {item.status.toLowerCase().replace('_', ' ')}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-slate-600 transition-all"
                      style={{ width: `${Math.max(pct, item.count > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                  <span className="w-12 text-right text-sm text-slate-600">
                    {item.count}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
