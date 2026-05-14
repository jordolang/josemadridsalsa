import { redirect } from 'next/navigation'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { getGoogleAnalyticsSettings } from '@/lib/google-analytics-config'
import { hasActiveServiceKey } from '@/lib/service-keys'
import { getGoogleAnalyticsDashboard } from '@/lib/google-analytics-reports'
import { RANGE_OPTIONS, type AnalyticsRangeKey } from '@/lib/analytics/date-range'
import { getAnalyticsData } from '@/lib/analytics/data-fetching'
import { AnalyticsHeader } from './_components/AnalyticsHeader'
import { AnalyticsNavigation } from './_components/AnalyticsNavigation'
import { GoogleAnalyticsConfig } from './_components/GoogleAnalyticsConfig'
import { GoogleAnalyticsSummary } from './_components/GoogleAnalyticsSummary'
import { CustomChartsManager } from './_components/CustomChartsManager'
import { AnalyticsStatsGrid } from './_components/AnalyticsStatsGrid'
import { AnalyticsChartsGrid } from './_components/AnalyticsChartsGrid'
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
        <AnalyticsHeader activeRange={activeRange} />
        <AnalyticsNavigation activeRange={activeRange} />
      </div>

      <GoogleAnalyticsConfig
        gaSettings={gaSettings}
        canManageGa={canManageGa}
        gaStatusIsReady={gaStatusIsReady}
        serviceAccountConfigured={serviceAccountConfigured}
      />

      <GoogleAnalyticsSummary
        summaryCards={gaDashboard.summaryCards}
        isReady={gaStatusIsReady}
      />

      <CustomChartsManager charts={gaDashboard.charts} canManageGa={canManageGa} />

      <AnalyticsStatsGrid
        revenue={data.summary.revenue}
        orders={data.summary.orders}
        sessions={data.summary.sessions}
        conversionRate={data.summary.conversionRate}
      />

      <AnalyticsChartsGrid chartData={data.chart} topProducts={data.topProducts} />

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
