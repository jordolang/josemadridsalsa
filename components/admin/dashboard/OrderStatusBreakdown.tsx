'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface OrderStatus {
  status: string
  count: number
  color: string
  bgColor: string
}

interface OrderStatusBreakdownProps {
  data?: OrderStatus[]
  totalOrders?: number
}

export function OrderStatusBreakdown({
  data,
  totalOrders,
}: OrderStatusBreakdownProps) {
  if (!data || data.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Order Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <p className="text-sm">No orders yet</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const total = totalOrders ?? data.reduce((sum, d) => sum + d.count, 0)

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Order Status</CardTitle>
          <span className="text-sm font-semibold text-foreground">{total} total</span>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stacked bar */}
        <div className="flex h-3 w-full overflow-hidden rounded-full mb-5">
          {data.map((item) => (
            <div
              key={item.status}
              className={`${item.color} transition-all`}
              style={{ width: `${(item.count / total) * 100}%` }}
            />
          ))}
        </div>

        <div className="space-y-3">
          {data.map((item) => (
            <div key={item.status} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                <span className="text-sm text-muted-foreground">{item.status}</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${item.bgColor}`}
                >
                  {item.count}
                </span>
                <span className="text-xs text-muted-foreground w-10 text-right">
                  {((item.count / total) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
