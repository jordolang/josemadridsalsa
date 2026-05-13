import { RevenueChart } from '@/components/admin/RevenueChart'
import { PopularProducts } from '@/components/admin/PopularProducts'
import type { ChartPoint, TopProduct } from '@/lib/analytics/data-fetching'

interface AnalyticsChartsGridProps {
  chartData: ChartPoint[]
  topProducts: TopProduct[]
}

export function AnalyticsChartsGrid({ chartData, topProducts }: AnalyticsChartsGridProps) {
  // Transform ChartPoint to RevenueData format
  const revenueData = chartData.map((point) => ({
    month: point.label,
    revenue: point.revenue,
    expenses: 0, // No expenses data available in current analytics
  }))

  // Transform TopProduct to PopularProduct format
  const popularProducts = topProducts.map((product) => ({
    id: product.productId,
    name: product.name,
    sku: product.sku,
    imageUrl: product.imageUrl,
    totalSold: product.quantity,
    revenue: product.revenue,
    heatLevel: product.heatLevel,
  }))

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <RevenueChart data={revenueData} />
      <PopularProducts products={popularProducts} />
    </div>
  )
}
