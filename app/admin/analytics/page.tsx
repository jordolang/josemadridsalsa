import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Activity, DollarSign, MousePointer2, ShoppingBag } from 'lucide-react'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { StatsCard } from '@/components/admin/StatsCard'
import { RevenueChart } from '@/components/admin/RevenueChart'
import { PopularProducts } from '@/components/admin/PopularProducts'
import { formatPrice } from '@/lib/utils'
import { getGoogleAnalyticsSettings } from '@/lib/google-analytics-config'
import { hasActiveServiceKey } from '@/lib/service-keys'
import { getGoogleAnalyticsDashboard } from '@/lib/google-analytics-reports'
import { RANGE_OPTIONS, type AnalyticsRangeKey } from '@/lib/analytics/date-range'
import { getAnalyticsData } from '@/lib/analytics/data-fetching'
import { GoogleAnalyticsConfig } from './_components/GoogleAnalyticsConfig'
import { GoogleAnalyticsSummary } from './_components/GoogleAnalyticsSummary'
import { CustomChartsManager } from './_components/CustomChartsManager'
import { RevenueOrdersTable } from './_components/RevenueOrdersTable'
import { OrderFunnelCard } from './_components/OrderFunnelCard'
import { TopProductsTable } from './_components/TopProductsTable'
import { TrafficSourcesCard } from './_components/TrafficSourcesCard'
import { RecentActivityTable } from './_components/RecentActivityTable'

type SearchParams = {
  range?: string
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
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

  const [data, gaSettings, gaDashboard, serviceAccountConfigured, canManageGa] =
    await Promise.all([
      dataPromise,
      gaSettingsPromise,
      gaDashboardPromise,
      serviceAccountPromise,
      canManageGaPromise,
    ])

  const gaStatusIsReady = gaDashboard.status === 'ready'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Analytics</h1>
            <p className="text-muted-foreground">Store performance overview and key trends</p>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-card p-1 shadow-sm">
            {RANGE_OPTIONS.map((option) => {
              const isActive = option.value === activeRange
              return (
                <Link
                  key={option.value}
                  href={`/admin/analytics?range=${option.value}`}
                  className={`rounded-md px-3 py-1 text-sm font-medium ${
                    isActive
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {option.label}
                </Link>
              )
            })}
          </div>
        </div>
        <nav className="flex flex-wrap gap-1 rounded-lg bg-muted/50 p-1">
          <Link
            href={`/admin/analytics?range=${activeRange}`}
            className="rounded-md bg-background px-3 py-1.5 text-sm font-medium shadow-sm"
          >
            Overview
          </Link>
          <Link
            href="/admin/analytics/fundraisers"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-background/60"
          >
            Fundraisers
          </Link>
          <Link
            href="/admin/analytics/social"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-background/60"
          >
            Social
          </Link>
          <Link
            href="/admin/analytics/orders"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-background/60"
          >
            Orders
          </Link>
        </nav>
      </div>

      <GoogleAnalyticsConfig
        gaSettings={gaSettings}
        canManageGa={canManageGa}
        gaStatusIsReady={gaStatusIsReady}
        serviceAccountConfigured={serviceAccountConfigured}
      />

      <GoogleAnalyticsSummary
        summaryCards={gaDashboard.summary}
        isReady={gaStatusIsReady}
      />

      <CustomChartsManager charts={gaDashboard.charts} canManageGa={canManageGa} />

      <div className="grid gap-6 md:grid-cols-4">
        <StatsCard
          title="Revenue"
          value={formatPrice(data.summary.revenue)}
          icon={DollarSign}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-700"
        />
        <StatsCard
          title="Orders"
          value={data.summary.orders.toString()}
          icon={ShoppingBag}
          iconBg="bg-blue-100"
          iconColor="text-blue-700"
        />
        <StatsCard
          title="Sessions"
          value={data.summary.sessions.toLocaleString()}
          icon={MousePointer2}
          iconBg="bg-purple-100"
          iconColor="text-purple-700"
        />
        <StatsCard
          title="Conversion"
          value={`${data.summary.conversionRate.toFixed(2)}%`}
          icon={Activity}
          iconBg="bg-amber-100"
          iconColor="text-amber-700"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RevenueChart data={data.chart} />
        <PopularProducts products={data.topProducts} />
      </div>

      <RevenueOrdersTable data={data.chart} />

      <div className="grid gap-6 lg:grid-cols-2">
        <OrderFunnelCard
          sessions={data.summary.sessions}
          addToCart={data.summary.addToCart}
          purchaseEvents={data.summary.purchaseEvents}
        />
        <TopProductsTable products={data.topProducts} />
      </div>

      <TrafficSourcesCard
        trafficSources={data.trafficSources}
        topCountries={data.topCountries}
      />

      <RecentActivityTable events={data.recentEvents} />
    </div>
  )
}
