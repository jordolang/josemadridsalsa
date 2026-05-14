import { Activity, DollarSign, MousePointer2, ShoppingBag } from 'lucide-react'
import { StatsCard } from '@/components/admin/StatsCard'
import { formatPrice } from '@/lib/utils'

interface AnalyticsStatsGridProps {
  revenue: number
  orders: number
  sessions: number
  conversionRate: number
}

export function AnalyticsStatsGrid({
  revenue,
  orders,
  sessions,
  conversionRate,
}: AnalyticsStatsGridProps) {
  return (
    <div className="grid gap-6 md:grid-cols-4">
      <StatsCard
        title="Revenue"
        value={formatPrice(revenue)}
        icon={DollarSign}
        color="green"
      />
      <StatsCard
        title="Orders"
        value={orders.toString()}
        icon={ShoppingBag}
        color="blue"
      />
      <StatsCard
        title="Sessions"
        value={sessions.toLocaleString()}
        icon={MousePointer2}
        color="purple"
      />
      <StatsCard
        title="Conversion"
        value={`${conversionRate.toFixed(2)}%`}
        icon={Activity}
        color="orange"
      />
    </div>
  )
}
