import { RevenueChart } from '@/components/admin/RevenueChart'
import { PopularProducts } from '@/components/admin/PopularProducts'
import type { ChartDataPoint, TopProduct } from '@/lib/analytics/data-fetching'

interface AnalyticsChartsGridProps {
  chartData: ChartDataPoint[]
  topProducts: TopProduct[]
}

export function AnalyticsChartsGrid({ chartData, topProducts }: AnalyticsChartsGridProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <RevenueChart data={chartData} />
      <PopularProducts products={topProducts} />
    </div>
  )
}
