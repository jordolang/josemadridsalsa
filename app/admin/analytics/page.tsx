import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  DollarSign,
  LineChart,
  MousePointer2,
  PieChart,
  ShoppingBag,
  Timer,
  TrendingDown,
  UserPlus,
  Users,
} from 'lucide-react'
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { StatsCard } from '@/components/admin/StatsCard'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { RevenueChart } from '@/components/admin/RevenueChart'
import { PopularProducts } from '@/components/admin/PopularProducts'
import { formatPrice } from '@/lib/utils'
import {
  addGoogleAnalyticsChartDefinition,
  deleteGoogleAnalyticsChartDefinition,
  getGoogleAnalyticsSettings,
  saveGoogleAnalyticsSettings,
  GOOGLE_ANALYTICS_CHART_COLORS,
  GOOGLE_ANALYTICS_DIMENSION_OPTIONS,
  GOOGLE_ANALYTICS_METRIC_OPTIONS,
} from '@/lib/google-analytics-config'
import { hasActiveServiceKey } from '@/lib/service-keys'
import { getGoogleAnalyticsDashboard } from '@/lib/google-analytics-reports'
import type { GoogleAnalyticsChartResult } from '@/types/analytics'
import { RANGE_OPTIONS, getDateRange, type AnalyticsRangeKey } from '@/lib/analytics/date-range'

type SearchParams = {
  range?: string
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
  sku: string
  imageUrl: string | null
  heatLevel: string | null
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

type ChartColorConfig = (typeof GOOGLE_ANALYTICS_CHART_COLORS)[number]

const CHART_COLOR_MAP = GOOGLE_ANALYTICS_CHART_COLORS.reduce<Record<string, ChartColorConfig>>((acc, color) => {
  acc[color.value] = color
  return acc
}, {})

const PIE_SEGMENT_COLORS = ['#4f46e5', '#22d3ee', '#f97316', '#22c55e', '#f43f5e', '#a855f7']

const GA_SUMMARY_ICON_MAP: Record<string, LucideIcon> = {
  sessions: BarChart3,
  totalUsers: Users,
  newUsers: UserPlus,
  engagedSessions: LineChart,
  bounceRate: TrendingDown,
  averageSessionDuration: Timer,
}

async function saveGaSettingsAction(formData: FormData) {
  'use server'

  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'analytics:export'))) {
    throw new Error('Unauthorized')
  }

  const measurementId = String(formData.get('measurementId') || '').trim()
  const propertyId = String(formData.get('propertyId') || '').trim()
  const dataStreamId = String(formData.get('dataStreamId') || '').trim()

  await saveGoogleAnalyticsSettings({
    measurementId: measurementId || null,
    propertyId: propertyId || null,
    dataStreamId: dataStreamId || null,
    updatedBy: user.id,
  })

  revalidatePath('/admin/analytics')
}

function coerceChartType(value: string | null): 'line' | 'bar' | 'pie' {
  if (value === 'bar' || value === 'pie' || value === 'line') {
    return value
  }
  return 'line'
}

async function addGaChartAction(formData: FormData) {
  'use server'

  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'analytics:export'))) {
    throw new Error('Unauthorized')
  }

  const title = String(formData.get('title') || '').trim()
  const description = String(formData.get('description') || '').trim()
  const metric = String(formData.get('metric') || '').trim()
  const dimension = String(formData.get('dimension') || '').trim()
  const chartType = coerceChartType(String(formData.get('chartType') || '').trim())
  const limitValue = formData.get('limit')
  const colorRaw = String(formData.get('color') || '').trim()
  const color = (GOOGLE_ANALYTICS_CHART_COLORS.find((option) => option.value === colorRaw)?.value) ?? 'indigo'

  if (!metric || !dimension) {
    throw new Error('Metric and dimension are required for a custom chart')
  }

  const limit = limitValue ? Number(limitValue) : null

  await addGoogleAnalyticsChartDefinition({
    title,
    description: description || null,
    metric,
    dimension,
    chartType,
    limit: limit && Number.isFinite(limit) ? limit : null,
    color,
    updatedBy: user.id,
  })

  revalidatePath('/admin/analytics')
}

async function deleteGaChartAction(formData: FormData) {
  'use server'

  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'analytics:export'))) {
    throw new Error('Unauthorized')
  }

  const chartId = String(formData.get('chartId') || '').trim()
  if (!chartId) return

  await deleteGoogleAnalyticsChartDefinition(chartId, user.id)
  revalidatePath('/admin/analytics')
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

async function getAnalyticsData(range: AnalyticsRangeKey): Promise<AnalyticsOverview> {
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
      take: 10,
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

  // Fetch product details for images, SKU, and heat level
  const productIds = topProductsRaw.map((item) => item.productId)
  const productDetails = productIds.length > 0
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, sku: true, heatLevel: true, featuredImage: true },
      })
    : []
  const productDetailsMap = new Map(productDetails.map((p) => [p.id, p]))

  const topProducts: TopProduct[] = topProductsRaw.map((item) => {
    const details = productDetailsMap.get(item.productId)
    return {
      productId: item.productId,
      name: item.productName,
      orders: extractCount(item._count),
      quantity: extractSum(item._sum, 'quantity'),
      revenue: extractSum(item._sum, 'totalPrice'),
      sku: details?.sku ?? '',
      imageUrl: details?.featuredImage ?? null,
      heatLevel: details?.heatLevel ?? null,
    }
  })

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

function getChartColorConfig(key?: string): ChartColorConfig {
  if (key && CHART_COLOR_MAP[key]) {
    return CHART_COLOR_MAP[key]
  }
  return CHART_COLOR_MAP.indigo ?? GOOGLE_ANALYTICS_CHART_COLORS[0]
}

function ChartVisualization({ chart }: { chart: GoogleAnalyticsChartResult }) {
  const color = getChartColorConfig(chart.definition.color)

  if (chart.points.length === 0) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        No Google Analytics data returned for this metric and dimension within the selected range.
      </p>
    )
  }

  if (chart.definition.chartType === 'line') {
    return renderLineChart(chart.points, color)
  }

  if (chart.definition.chartType === 'bar') {
    return renderBarChart(chart.points, color)
  }

  return renderPieChart(chart.points)
}

function renderLineChart(
  points: GoogleAnalyticsChartResult['points'],
  color: ChartColorConfig
) {
  const maxValue = Math.max(...points.map((point) => point.value), 0)
  const safeMax = maxValue === 0 ? 1 : maxValue
  const denominator = Math.max(points.length - 1, 1)

  const path = points
    .map((point, index) => {
      const x = (index / denominator) * 100
      const y = 100 - (point.value / safeMax) * 100
      return `${index === 0 ? 'M' : 'L'}${x},${y}`
    })
    .join(' ')
  const areaPath = `${path} L100,100 L0,100 Z`

  return (
    <div className="mt-4">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-40 w-full">
        <path d={areaPath} className={`${color.lineFill} opacity-70`} />
        <path d={path} className={`${color.lineStroke} fill-none`} strokeWidth={2.2} strokeLinecap="round" />
      </svg>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        {points.map((point) => (
          <div key={point.label}>
            <p className="font-semibold text-foreground">{point.label}</p>
            <p>{point.value.toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function renderBarChart(
  points: GoogleAnalyticsChartResult['points'],
  color: ChartColorConfig
) {
  const maxValue = Math.max(...points.map((point) => point.value), 0)
  const safeMax = maxValue === 0 ? 1 : maxValue

  return (
    <div className="mt-4">
      <div className="flex h-40 items-end gap-4">
        {points.map((point) => (
          <div key={point.label} className="flex flex-1 flex-col items-center gap-2 text-xs">
            <div className="flex h-full w-full items-end rounded-t-lg bg-muted">
              <div
                className={`mx-auto w-3/4 rounded-t-lg ${color.barClass}`}
                style={{ height: `${(point.value / safeMax) * 100}%` }}
              />
            </div>
            <span className="text-muted-foreground">{point.label}</span>
            <span className="font-semibold text-foreground">{point.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function renderPieChart(points: GoogleAnalyticsChartResult['points']) {
  const total = points.reduce((sum, point) => sum + point.value, 0)
  const safeTotal = total === 0 ? 1 : total
  let current = 0

  const segments = points.map((point, index) => {
    const percentage = (point.value / safeTotal) * 100
    const start = current
    const end = current + percentage
    current = end
    return `${PIE_SEGMENT_COLORS[index % PIE_SEGMENT_COLORS.length]} ${start}% ${end}%`
  })

  const gradient =
    segments.length > 0 ? segments.join(', ') : `${PIE_SEGMENT_COLORS[0]} 0% 100%`

  return (
    <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center">
      <div
        className="mx-auto h-40 w-40 rounded-full"
        style={{
          backgroundImage: `conic-gradient(${gradient})`,
        }}
      />
      <ul className="flex-1 space-y-2 text-sm">
        {points.map((point, index) => (
          <li key={point.label} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: PIE_SEGMENT_COLORS[index % PIE_SEGMENT_COLORS.length] }}
              />
              <span className="text-foreground">{point.label}</span>
            </div>
            <span className="font-semibold text-foreground">
              {((point.value / safeTotal) * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'analytics:read'))) {
    redirect('/admin')
  }

  const requestedRange = params.range
  const activeRange = RANGE_OPTIONS.some((option) => option.value === requestedRange)
    ? (requestedRange as AnalyticsRangeKey)
    : ('30d' as AnalyticsRangeKey)

  const dataPromise = getAnalyticsData(activeRange)
  const gaSettingsPromise = getGoogleAnalyticsSettings()
  const gaDashboardPromise = getGoogleAnalyticsDashboard(activeRange)
  const serviceAccountPromise = hasActiveServiceKey('google_analytics', 'service_account')
  const canManageGaPromise = hasPermission(user, 'analytics:export')

  const [data, gaSettings, gaDashboard, serviceAccountConfigured, canManageGa] = await Promise.all([
    dataPromise,
    gaSettingsPromise,
    gaDashboardPromise,
    serviceAccountPromise,
    canManageGaPromise,
  ])

  const maxOrders = data.chart.reduce((max, point) => Math.max(max, point.orders), 0)
  const maxRevenue = data.chart.reduce((max, point) => Math.max(max, point.revenue), 0)
  const maxTraffic = data.trafficSources.reduce((max, item) => Math.max(max, item.count), 0)
  const maxCountry = data.topCountries.reduce((max, item) => Math.max(max, item.count), 0)

  const gaChartsById = new Map<string, GoogleAnalyticsChartResult>(
    gaDashboard.charts.map((chart) => [chart.definition.id, chart])
  )
  const gaStatusIsReady = gaDashboard.status === 'ready'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Analytics</h1>
            <p className="text-muted-foreground">Store performance overview and key trends</p>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-white p-1 shadow-sm">
            {RANGE_OPTIONS.map((option) => {
              const isActive = option.value === activeRange
              return (
                <Link
                  key={option.value}
                  href={`/admin/analytics?range=${option.value}`}
                  className={`rounded-md px-3 py-1 text-sm font-medium ${
                    isActive ? 'bg-slate-900 text-white' : 'text-muted-foreground hover:bg-slate-200'
                  }`}
                >
                  {option.label}
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      <Card className="p-6 space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Google Analytics configuration</h2>
            <p className="text-sm text-muted-foreground">
              Manage your GA4 property connection, Google Tag, and default chart definitions.
            </p>
          </div>
          <Badge className={gaStatusIsReady ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>
            {gaStatusIsReady ? 'Connected' : 'Action required'}
          </Badge>
        </div>
        <form action={canManageGa ? saveGaSettingsAction : undefined} className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor="measurementId" className="text-sm font-medium text-foreground">
              Google Tag (Measurement ID)
            </label>
            <Input
              id="measurementId"
              name="measurementId"
              placeholder="G-XXXXXXXXXX"
              defaultValue={gaSettings.measurementId ?? ''}
              disabled={!canManageGa}
            />
            <p className="text-xs text-muted-foreground">Used by the storefront to load the gtag snippet.</p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="propertyId" className="text-sm font-medium text-foreground">
              GA4 Property ID
            </label>
            <Input
              id="propertyId"
              name="propertyId"
              placeholder="123456789"
              defaultValue={gaSettings.propertyId ?? ''}
              disabled={!canManageGa}
            />
            <p className="text-xs text-muted-foreground">Only numbers or the `properties/123` syntax are accepted.</p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="dataStreamId" className="text-sm font-medium text-foreground">
              Data stream ID (optional)
            </label>
            <Input
              id="dataStreamId"
              name="dataStreamId"
              placeholder="345678901"
              defaultValue={gaSettings.dataStreamId ?? ''}
              disabled={!canManageGa}
            />
            <p className="text-xs text-muted-foreground">Helpful when you manage multiple storefront streams.</p>
          </div>
          <div className="md:col-span-3 flex justify-end">
            <Button type="submit" disabled={!canManageGa}>
              Save Google Analytics settings
            </Button>
          </div>
        </form>
        <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
          <p>
            <span className="font-semibold text-foreground">Service account:</span>{' '}
            {serviceAccountConfigured ? (
              <span className="text-emerald-700">Connected</span>
            ) : (
              <span>
                Missing — add <code className="rounded bg-muted px-1">google_analytics / service_account</code> in{' '}
                <Link href="/admin/settings/integrations" className="text-foreground underline">
                  Integrations
                </Link>
              </span>
            )}
          </p>
          <p>
            <span className="font-semibold text-foreground">Custom charts saved:</span>{' '}
            {gaSettings.chartDefinitions.length}
          </p>
        </div>
      </Card>

      {gaDashboard.status !== 'ready' && gaDashboard.message && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle>Google Analytics setup</AlertTitle>
          <AlertDescription>{gaDashboard.message}</AlertDescription>
        </Alert>
      )}

      <section className="space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Google Analytics overview</h2>
            <p className="text-sm text-muted-foreground">Live GA4 metrics for the selected range</p>
          </div>
          <Badge className={gaStatusIsReady ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-foreground'}>
            {gaStatusIsReady ? 'Live data' : 'Awaiting configuration'}
          </Badge>
        </div>
        {gaDashboard.summaryCards.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">
            No Google Analytics metrics are available for this range yet.
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {gaDashboard.summaryCards.map((card) => {
              const Icon = GA_SUMMARY_ICON_MAP[card.metric] ?? BarChart3
              return (
                <StatsCard key={card.metric} title={card.label} value={card.formattedValue} icon={Icon} />
              )
            })}
          </div>
        )}
      </section>

      <Card className="p-6 space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Custom Google Analytics charts</h2>
            <p className="text-sm text-muted-foreground">
              Blend any GA metric + dimension and choose the visualization that best fits your reporting workflow.
            </p>
          </div>
          <Badge className="bg-muted text-foreground">
            {gaSettings.chartDefinitions.length} configured
          </Badge>
        </div>
        {gaSettings.chartDefinitions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No custom charts yet. Use the builder below to create your first dashboard widget.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {gaSettings.chartDefinitions.map((definition) => {
              const chart =
                gaChartsById.get(definition.id) ??
                ({ definition, points: [], total: 0 } as GoogleAnalyticsChartResult)
              return (
                <div key={definition.id} className="rounded-lg border bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                        {definition.chartType === 'line' && <LineChart className="h-4 w-4" />}
                        {definition.chartType === 'bar' && <BarChart3 className="h-4 w-4" />}
                        {definition.chartType === 'pie' && <PieChart className="h-4 w-4" />}
                        <span>{definition.chartType} chart</span>
                      </div>
                      <h3 className="text-lg font-semibold text-foreground">{definition.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {definition.description || `${definition.metric} • ${definition.dimension}`}
                      </p>
                    </div>
                    {canManageGa && (
                      <form action={deleteGaChartAction}>
                        <input type="hidden" name="chartId" value={definition.id} />
                        <Button variant="ghost" size="sm">
                          Remove
                        </Button>
                      </form>
                    )}
                  </div>
                  <ChartVisualization chart={chart} />
                </div>
              )
            })}
          </div>
        )}
        {canManageGa && (
          <div>
            <h3 className="text-base font-semibold text-foreground">Add a custom chart</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Pick any GA metric + dimension combination, select the visualization style, and optionally cap the number
              of rows returned.
            </p>
            <form action={addGaChartAction} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="title" className="text-sm font-medium text-foreground">
                  Chart title
                </label>
                <Input id="title" name="title" placeholder="Sessions by source" required />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="description" className="text-sm font-medium text-foreground">
                  Description (optional)
                </label>
                <Input id="description" name="description" placeholder="Visible to admins only" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="metric" className="text-sm font-medium text-foreground">
                  Metric
                </label>
                <select
                  id="metric"
                  name="metric"
                  className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select a metric
                  </option>
                  {GOOGLE_ANALYTICS_METRIC_OPTIONS.map((metric) => (
                    <option key={metric.value} value={metric.value}>
                      {metric.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="dimension" className="text-sm font-medium text-foreground">
                  Dimension
                </label>
                <select
                  id="dimension"
                  name="dimension"
                  className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select a dimension
                  </option>
                  {GOOGLE_ANALYTICS_DIMENSION_OPTIONS.map((dimension) => (
                    <option key={dimension.value} value={dimension.value}>
                      {dimension.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="chartType" className="text-sm font-medium text-foreground">
                  Chart type
                </label>
                <select
                  id="chartType"
                  name="chartType"
                  className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                  defaultValue="line"
                >
                  <option value="line">Line</option>
                  <option value="bar">Bar</option>
                  <option value="pie">Pie</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="color" className="text-sm font-medium text-foreground">
                  Color theme
                </label>
                <select
                  id="color"
                  name="color"
                  className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                  defaultValue="indigo"
                >
                  {GOOGLE_ANALYTICS_CHART_COLORS.map((color) => (
                    <option key={color.value} value={color.value}>
                      {color.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="limit" className="text-sm font-medium text-foreground">
                  Row limit (optional)
                </label>
                <Input
                  id="limit"
                  name="limit"
                  type="number"
                  min={1}
                  placeholder="10"
                  className="md:col-span-1"
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank to let GA decide. Ignored for date-based line charts.
                </p>
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button type="submit">Add chart</Button>
              </div>
            </form>
          </div>
        )}
      </Card>

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

      {/* Revenue Chart */}
      <RevenueChart
        data={data.chart.map((point) => ({
          month: point.label,
          revenue: point.revenue,
          expenses: 0,
        }))}
      />

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Revenue & Orders</h2>
              <p className="text-sm text-muted-foreground">Daily trends for the selected range</p>
            </div>
          </div>
          {data.chart.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No order activity recorded for this range.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px]">
                <thead className="border-b bg-muted text-sm text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Date</th>
                    <th className="px-4 py-2 text-left font-medium">Orders</th>
                    <th className="px-4 py-2 text-left font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {data.chart.map((point) => (
                    <tr key={point.date} className="border-b last:border-0">
                      <td className="px-4 py-3 text-foreground">{point.label}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-32 rounded-full bg-muted">
                            <div
                              className="h-2 rounded-full bg-blue-500 transition-all"
                              style={{ width: getBarWidth(point.orders, maxOrders) }}
                            />
                          </div>
                          <span className="font-medium text-foreground">{point.orders}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-32 rounded-full bg-muted">
                            <div
                              className="h-2 rounded-full bg-emerald-500 transition-all"
                              style={{ width: getBarWidth(point.revenue, maxRevenue) }}
                            />
                          </div>
                          <span className="font-medium text-foreground">
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
          <p className="mb-4 text-sm text-muted-foreground">
            Key engagement metrics for the selected period
          </p>
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Sessions</p>
              <div className="flex items-baseline justify-between">
                <p className="text-2xl font-semibold">{data.summary.sessions.toLocaleString()}</p>
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Add to Cart Events</p>
              <div className="text-2xl font-semibold">
                {data.summary.addToCart.toLocaleString()}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Purchase Events</p>
              <div className="text-2xl font-semibold">
                {data.summary.purchaseEvents.toLocaleString()}
              </div>
            </div>
            <div className="border-t pt-4">
              <p className="text-xs uppercase text-muted-foreground">Cart to Purchase Rate</p>
              <div className="text-lg font-semibold">
                {data.summary.addToCart === 0
                  ? '—'
                  : formatPercent((data.summary.purchaseEvents / data.summary.addToCart) * 100)}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Popular Products Component */}
      <PopularProducts
        products={data.topProducts.map((product) => ({
          id: product.productId,
          name: product.name,
          sku: product.sku,
          imageUrl: product.imageUrl,
          totalSold: product.quantity,
          revenue: product.revenue,
          heatLevel: product.heatLevel,
        }))}
      />

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Top Products Detail</h2>
              <p className="text-sm text-muted-foreground">Based on revenue for this range</p>
            </div>
            {data.topProducts.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {formatPrice(
                  data.topProducts.reduce((sum, product) => sum + product.revenue, 0)
                )}{' '}
                total
              </span>
            )}
          </div>
          {data.topProducts.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No product sales recorded in this range.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[480px]">
                <thead className="border-b bg-muted text-sm text-muted-foreground">
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
                      <td className="px-4 py-3 font-medium text-foreground">{product.name}</td>
                      <td className="px-4 py-3 text-right text-foreground">
                        {product.orders.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-foreground">
                        {product.quantity.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">
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
          <p className="text-sm text-muted-foreground">Current distribution</p>
          <div className="mt-4 space-y-3">
            {data.orderStatus.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No orders in this range.</p>
            ) : (
              data.orderStatus.map((status) => (
                <div key={status.status} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-2 w-2 rounded-full bg-slate-400" />
                    <span className="text-sm font-medium text-foreground">
                      {status.status.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
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
              <p className="text-sm text-muted-foreground">Top referrers for sessions</p>
            </div>
          </div>
          {data.trafficSources.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No traffic data recorded in this range.
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.trafficSources.map((source) => (
                <li key={source.label} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{source.label}</span>
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-32 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-indigo-500 transition-all"
                        style={{ width: getBarWidth(source.count, maxTraffic) }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground">
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
          <p className="text-sm text-muted-foreground">Geo distribution of visitors</p>
          {data.topCountries.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No geo data captured for this range.
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.topCountries.map((country) => (
                <li key={country.label} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{country.label}</span>
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-32 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-emerald-500 transition-all"
                        style={{ width: getBarWidth(country.count, maxCountry) }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground">
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
        <p className="mb-4 text-sm text-muted-foreground">
          The latest analytics events recorded across the storefront
        </p>
        {data.recentEvents.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No analytics events were captured during this range.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <thead className="border-b bg-muted text-sm text-muted-foreground">
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
                    <td className="px-4 py-3 font-medium text-foreground">{event.type}</td>
                    <td className="px-4 py-3 text-muted-foreground">{event.page || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{event.action || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">
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
