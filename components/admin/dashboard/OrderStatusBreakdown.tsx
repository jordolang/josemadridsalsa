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

const defaultData: OrderStatus[] = [
  { status: 'Pending', count: 12, color: 'bg-amber-500', bgColor: 'bg-amber-50 text-amber-700' },
  { status: 'Processing', count: 8, color: 'bg-blue-500', bgColor: 'bg-blue-50 text-blue-700' },
  { status: 'Shipped', count: 24, color: 'bg-purple-500', bgColor: 'bg-purple-50 text-purple-700' },
  { status: 'Delivered', count: 156, color: 'bg-emerald-500', bgColor: 'bg-emerald-50 text-emerald-700' },
  { status: 'Cancelled', count: 3, color: 'bg-red-500', bgColor: 'bg-red-50 text-red-700' },
]

export function OrderStatusBreakdown({
  data = defaultData,
  totalOrders,
}: OrderStatusBreakdownProps) {
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
