import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Activity,
  DollarSign,
  MousePointer2,
  ShoppingBag,
  Users,
} from 'lucide-react'
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { StatsCard } from '@/components/admin/StatsCard'
import { Card } from '@/components/ui/card'
import { formatPrice } from '@/lib/utils'

type RangeKey = '7d' | '30d' | '90d' | '365d'

type SearchParams = {
  range?: string
}

const RANGE_OPTIONS: Array<{ label: string; value: RangeKey }> = [
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
  { label: '12 months', value: '365d' },
]

const RANGE_MAP: Record<RangeKey, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '365d': 365,
}

type ChartPoint = {
  date: string
  label: string
  orders: number
  revenue: number
}

type TopProduct = {
  productId: string
  name: string
  orders: number
  quantity: number
  revenue: number
}

type CountRecord = {
  label: string
  count: number
}

type AnalyticsOverview = {
  summary: {
    revenue: number
    orders: number
    averageOrderValue: number
    conversionRate: number
    sessions: number
    addToCart: number
    purchaseEvents: number
  }
  chart: ChartPoint[]
  orderStatus: Array<{ status: string; count: number }>
  topProducts: TopProduct[]
  topPages: CountRecord[]
  trafficSources: CountRecord[]
  topCountries: CountRecord[]
  recentEvents: Array<{
    id: string
    type: string
    page: string | null
    action: string | null
    createdAt: Date
  }>
}

function getDateRange(range: RangeKey) {
  const end = new Date()
  end.setHours(23, 59, 59, 999)

  const days = RANGE_MAP[range]
  const start = new Date(end)
  start.setDate(end.getDate() - (days - 1))
  start.setHours(0, 0, 0, 0)

  return { start, end, days }
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

async function getAnalyticsData(range: RangeKey): Promise<AnalyticsOverview> {
  const { start, end, days } = getDateRange(range)
  const createdAtRange = { gte: start, lte: end }

  const excludedStatuses: OrderStatus[] = [OrderStatus.CANCELLED, OrderStatus.REFUNDED]
  const includedPayments: PaymentStatus[] = [PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED]

  const orderFilter: Prisma.OrderWhereInput = {
    createdAt: createdAtRange,
    status: { notIn: excludedStatuses },
    paymentStatus: { in: includedPayments },
  }

  const [
    orderList,
    sessionRecords,
    addToCartCount,
    purchaseEvents,
    orderStatus,
    topProductsRaw,
    topPagesRaw,
    trafficSourcesRaw,
    topCountriesRaw,
    recentEvents,
  ] = await Promise.all([
    prisma.order.findMany({
      where: orderFilter,
      select: {
        id: true,
        total: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.analytics.findMany({
      where: {
        createdAt: createdAtRange,
        sessionId: { not: null },
      },
      distinct: ['sessionId'],
      select: { sessionId: true },
    }),
    prisma.analytics.count({
      where: {
        createdAt: createdAtRange,
        type: 'ADD_TO_CART',
      },
    }),
    prisma.analytics.count({
      where: {
        createdAt: createdAtRange,
        type: 'PURCHASE',
      },
    }),
    prisma.order.groupBy({
      by: ['status'],
      where: orderFilter,
      _count: { _all: true },
    }),
    prisma.orderItem.groupBy({
      by: ['productId', 'productName'],
      where: {
        order: orderFilter,
      },
      _sum: {
        totalPrice: true,
        quantity: true,
      },
      _count: { _all: true },
      orderBy: {
        _sum: { totalPrice: 'desc' },
      },
      take: 5,
    }),
    prisma.analytics.groupBy({
      by: ['page'],
      where: {
        createdAt: createdAtRange,
        type: 'PAGE_VIEW',
        page: { not: null },
      },
      _count: { _all: true },
    }),
    prisma.analytics.groupBy({
      by: ['label'],
      where: {
        createdAt: createdAtRange,
        type: 'PAGE_VIEW',
        label: { not: null },
      },
      _count: { _all: true },
    }),
    prisma.analytics.groupBy({
      by: ['country'],
      where: {
        createdAt: createdAtRange,
        country: { not: null },
      },
      _count: { _all: true },
    }),
    prisma.analytics.findMany({
      where: {
        createdAt: createdAtRange,
      },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: {
        id: true,
        type: true,
        page: true,
        action: true,
        createdAt: true,
      },
    }),
  ])

  const extractCount = (value: unknown): number =>
    typeof value === 'object' && value !== null && '_all' in (value as Record<string, unknown>)
      ? Number((value as Record<string, unknown>)._all) || 0
      : 0

  const extractSum = (value: unknown, field: 'quantity' | 'totalPrice'): number =>
    typeof value === 'object' && value !== null && field in (value as Record<string, unknown>)
      ? Number((value as Record<string, unknown>)[field] || 0)
      : 0

  const totalRevenue = orderList.reduce((sum, order) => sum + Number(order.total || 0), 0)
  const totalOrders = orderList.length
  const averageOrderValue = totalOrders === 0 ? 0 : totalRevenue / totalOrders

  const sessions = sessionRecords.length
  const conversionRate = sessions === 0 ? 0 : (purchaseEvents / sessions) * 100

  const dayBuckets = new Map<string, ChartPoint>()
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

  orderList.forEach((order) => {
    const key = toDateKey(order.createdAt)
    const bucket = dayBuckets.get(key)
    if (bucket) {
      bucket.orders += 1
      bucket.revenue += Number(order.total || 0)
    }
  })

  const chart = Array.from(dayBuckets.values()).sort((a, b) => (a.date < b.date ? -1 : 1))

  const topProducts: TopProduct[] = topProductsRaw.map((item) => ({
    productId: item.productId,
    name: item.productName,
    orders: extractCount(item._count),
    quantity: extractSum(item._sum, 'quantity'),
    revenue: extractSum(item._sum, 'totalPrice'),
  }))

  const topPages: CountRecord[] = topPagesRaw
    .sort((a, b) => extractCount(b._count) - extractCount(a._count))
    .slice(0, 5)
    .map((item) => ({
      label: item.page || 'Unknown',
      count: extractCount(item._count),
    }))

  const trafficSources: CountRecord[] = trafficSourcesRaw
    .sort((a, b) => extractCount(b._count) - extractCount(a._count))
    .slice(0, 5)
    .map((item) => ({
      label: item.label || 'Direct',
      count: extractCount(item._count),
    }))

  const topCountries: CountRecord[] = topCountriesRaw
    .sort((a, b) => extractCount(b._count) - extractCount(a._count))
    .slice(0, 5)
    .map((item) => ({
      label: item.country || 'Unknown',
      count: extractCount(item._count),
    }))

  return {
    summary: {
      revenue: totalRevenue,
      orders: totalOrders,
      averageOrderValue,
      conversionRate,
      sessions,
      addToCart: addToCartCount,
      purchaseEvents,
    },
    chart,
    orderStatus: orderStatus.map((item) => ({
      status: item.status,
      count: extractCount(item._count),
    })),
    topProducts,
    topPages,
    trafficSources,
    topCountries,
    recentEvents: recentEvents.map((event) => ({
      id: event.id,
      type: event.type,
      page: event.page,
      action: event.action,
      createdAt: event.createdAt,
    })),
  }
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`
}

function getBarWidth(value: number, max: number) {
  if (max === 0) return '0%'
  const percent = (value / max) * 100
  const clamped = Math.max(Math.min(percent, 100), value > 0 ? 6 : 0)
  return `${clamped}%`
}

export default async function AnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'analytics:read'))) {
    redirect('/admin')
  }

  const requestedRange = searchParams.range
  const activeRange = RANGE_OPTIONS.some((option) => option.value === requestedRange)
    ? (requestedRange as RangeKey)
    : ('30d' as RangeKey)

  const data = await getAnalyticsData(activeRange)

  const maxOrders = data.chart.reduce((max, point) => Math.max(max, point.orders), 0)
  const maxRevenue = data.chart.reduce((max, point) => Math.max(max, point.revenue), 0)
  const maxTraffic = data.trafficSources.reduce((max, item) => Math.max(max, item.count), 0)
  const maxCountry = data.topCountries.reduce((max, item) => Math.max(max, item.count), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Analytics</h1>
            <p className="text-slate-600">Store performance overview and key trends</p>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-white p-1 shadow-sm">
            {RANGE_OPTIONS.map((option) => {
              const isActive = option.value === activeRange
              return (
                <Link
                  key={option.value}
                  href={`/admin/analytics?range=${option.value}`}
                  className={`rounded-md px-3 py-1 text-sm font-medium ${
                    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {option.label}
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          title="Revenue"
          value={formatPrice(data.summary.revenue)}
          icon={DollarSign}
        />
        <StatsCard
          title="Orders"
          value={data.summary.orders.toLocaleString()}
          icon={ShoppingBag}
        />
        <StatsCard
          title="Avg. Order Value"
          value={formatPrice(data.summary.averageOrderValue)}
          icon={Activity}
        />
        <StatsCard
          title="Conversion Rate"
          value={formatPercent(data.summary.conversionRate)}
          icon={MousePointer2}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Revenue & Orders</h2>
              <p className="text-sm text-slate-600">Daily trends for the selected range</p>
            </div>
          </div>
          {data.chart.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              No order activity recorded for this range.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px]">
                <thead className="border-b bg-slate-50 text-sm text-slate-600">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Date</th>
                    <th className="px-4 py-2 text-left font-medium">Orders</th>
                    <th className="px-4 py-2 text-left font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {data.chart.map((point) => (
                    <tr key={point.date} className="border-b last:border-0">
                      <td className="px-4 py-3 text-slate-700">{point.label}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-32 rounded-full bg-slate-100">
                            <div
                              className="h-2 rounded-full bg-blue-500 transition-all"
                              style={{ width: getBarWidth(point.orders, maxOrders) }}
                            />
                          </div>
                          <span className="font-medium text-slate-700">{point.orders}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-32 rounded-full bg-slate-100">
                            <div
                              className="h-2 rounded-full bg-emerald-500 transition-all"
                              style={{ width: getBarWidth(point.revenue, maxRevenue) }}
                            />
                          </div>
                          <span className="font-medium text-slate-700">
                            {formatPrice(point.revenue)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold">Order Funnel</h2>
          <p className="mb-4 text-sm text-slate-600">
            Key engagement metrics for the selected period
          </p>
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase text-slate-500">Sessions</p>
              <div className="flex items-baseline justify-between">
                <p className="text-2xl font-semibold">{data.summary.sessions.toLocaleString()}</p>
                <Users className="h-5 w-5 text-slate-400" />
              </div>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Add to Cart Events</p>
              <div className="text-2xl font-semibold">
                {data.summary.addToCart.toLocaleString()}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Purchase Events</p>
              <div className="text-2xl font-semibold">
                {data.summary.purchaseEvents.toLocaleString()}
              </div>
            </div>
            <div className="border-t pt-4">
              <p className="text-xs uppercase text-slate-500">Cart to Purchase Rate</p>
              <div className="text-lg font-semibold">
                {data.summary.addToCart === 0
                  ? '—'
                  : formatPercent((data.summary.purchaseEvents / data.summary.addToCart) * 100)}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Top Products</h2>
              <p className="text-sm text-slate-600">Based on revenue for this range</p>
            </div>
            {data.topProducts.length > 0 && (
              <span className="text-sm text-slate-500">
                {formatPrice(
                  data.topProducts.reduce((sum, product) => sum + product.revenue, 0)
                )}{' '}
                total
              </span>
            )}
          </div>
          {data.topProducts.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              No product sales recorded in this range.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[480px]">
                <thead className="border-b bg-slate-50 text-sm text-slate-600">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Product</th>
                    <th className="px-4 py-2 text-right font-medium">Orders</th>
                    <th className="px-4 py-2 text-right font-medium">Units</th>
                    <th className="px-4 py-2 text-right font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {data.topProducts.map((product) => (
                    <tr key={product.productId} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium text-slate-700">{product.name}</td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {product.orders.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {product.quantity.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {formatPrice(product.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold">Order Status</h2>
          <p className="text-sm text-slate-600">Current distribution</p>
          <div className="mt-4 space-y-3">
            {data.orderStatus.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No orders in this range.</p>
            ) : (
              data.orderStatus.map((status) => (
                <div key={status.status} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-2 w-2 rounded-full bg-slate-400" />
                    <span className="text-sm font-medium text-slate-700">
                      {status.status.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="text-sm text-slate-600">
                    {status.count.toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Traffic Sources</h2>
              <p className="text-sm text-slate-600">Top referrers for sessions</p>
            </div>
          </div>
          {data.trafficSources.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              No traffic data recorded in this range.
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.trafficSources.map((source) => (
                <li key={source.label} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">{source.label}</span>
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-32 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-indigo-500 transition-all"
                        style={{ width: getBarWidth(source.count, maxTraffic) }}
                      />
                    </div>
                    <span className="text-sm text-slate-600">
                      {source.count.toLocaleString()}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold">Top Countries</h2>
          <p className="text-sm text-slate-600">Geo distribution of visitors</p>
          {data.topCountries.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              No geo data captured for this range.
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.topCountries.map((country) => (
                <li key={country.label} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">{country.label}</span>
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-32 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-emerald-500 transition-all"
                        style={{ width: getBarWidth(country.count, maxCountry) }}
                      />
                    </div>
                    <span className="text-sm text-slate-600">
                      {country.count.toLocaleString()}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-xl font-semibold">Recent Activity</h2>
        <p className="mb-4 text-sm text-slate-600">
          The latest analytics events recorded across the storefront
        </p>
        {data.recentEvents.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            No analytics events were captured during this range.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <thead className="border-b bg-slate-50 text-sm text-slate-600">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Type</th>
                  <th className="px-4 py-2 text-left font-medium">Page</th>
                  <th className="px-4 py-2 text-left font-medium">Action</th>
                  <th className="px-4 py-2 text-left font-medium">Timestamp</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {data.recentEvents.map((event) => (
                  <tr key={event.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-700">{event.type}</td>
                    <td className="px-4 py-3 text-slate-600">{event.page || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{event.action || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {event.createdAt.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
