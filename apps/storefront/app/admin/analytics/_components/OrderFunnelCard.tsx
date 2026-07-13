import { Users } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { formatPercent } from '@/lib/analytics/chart-utils'

interface OrderFunnelCardProps {
  sessions: number
  addToCart: number
  purchaseEvents: number
}

export function OrderFunnelCard({
  sessions,
  addToCart,
  purchaseEvents,
}: OrderFunnelCardProps) {
  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold">Order Funnel</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Key engagement metrics for the selected period
      </p>
      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase text-muted-foreground">Sessions</p>
          <div className="flex items-baseline justify-between">
            <p className="text-2xl font-semibold">{sessions.toLocaleString()}</p>
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Add to Cart Events</p>
          <div className="text-2xl font-semibold">
            {addToCart.toLocaleString()}
          </div>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Purchase Events</p>
          <div className="text-2xl font-semibold">
            {purchaseEvents.toLocaleString()}
          </div>
        </div>
        <div className="border-t pt-4">
          <p className="text-xs uppercase text-muted-foreground">Cart to Purchase Rate</p>
          <div className="text-lg font-semibold">
            {addToCart === 0
              ? '—'
              : formatPercent((purchaseEvents / addToCart) * 100)}
          </div>
        </div>
      </div>
    </Card>
  )
}
