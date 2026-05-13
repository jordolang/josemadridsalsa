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
        iconBg="bg-emerald-100"
        iconColor="text-emerald-700"
      />
      <StatsCard
        title="Orders"
        value={orders.toString()}
        icon={ShoppingBag}
        iconBg="bg-blue-100"
        iconColor="text-blue-700"
      />
      <StatsCard
        title="Sessions"
        value={sessions.toLocaleString()}
        icon={MousePointer2}
        iconBg="bg-purple-100"
        iconColor="text-purple-700"
      />
      <StatsCard
        title="Conversion"
        value={`${conversionRate.toFixed(2)}%`}
        icon={Activity}
        iconBg="bg-amber-100"
        iconColor="text-amber-700"
      />
    </div>
  )
}
