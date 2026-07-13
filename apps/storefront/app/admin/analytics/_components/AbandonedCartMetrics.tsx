import { DollarSign, Mail, Percent, ShoppingCart } from 'lucide-react'
import { StatsCard } from '@/components/admin/StatsCard'
import { formatPrice } from '@/lib/utils'
import type { AbandonedCartMetrics as AbandonedCartMetricsType } from '@/lib/analytics/abandoned-cart-metrics'

interface AbandonedCartMetricsProps {
  metrics: AbandonedCartMetricsType
}

export function AbandonedCartMetrics({ metrics }: AbandonedCartMetricsProps) {
  const { summary } = metrics

  return (
    <div className="grid gap-6 md:grid-cols-4">
      <StatsCard
        title="Recovery Rate"
        value={`${summary.recoveryRate.toFixed(1)}%`}
        icon={Percent}
        color="green"
        subtitle={`${summary.totalRecovered} of ${summary.totalAbandoned} recovered`}
      />
      <StatsCard
        title="Attributed Revenue"
        value={formatPrice(summary.attributedRevenue)}
        icon={DollarSign}
        color="blue"
        subtitle="From recovered carts"
      />
      <StatsCard
        title="Abandoned Carts"
        value={summary.totalAbandoned.toString()}
        icon={ShoppingCart}
        color="orange"
      />
      <StatsCard
        title="Emails Sent"
        value={summary.emailsSent.toString()}
        icon={Mail}
        color="purple"
        subtitle="Recovery sequence emails"
      />
    </div>
  )
}
