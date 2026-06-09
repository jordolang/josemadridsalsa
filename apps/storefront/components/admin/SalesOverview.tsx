'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface SalesData {
  month: string
  sales: number
  orders: number
}

interface SalesOverviewProps {
  data?: SalesData[]
  loading?: boolean
}

export function SalesOverview({ data, loading }: SalesOverviewProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sales Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-48 bg-muted rounded" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sales Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <p className="text-sm font-medium">No sales data yet</p>
            <p className="text-xs mt-1">Sales will appear here once orders are placed</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const maxSales = Math.max(...data.map((d) => d.sales))
  const totalSales = data.reduce((sum, d) => sum + d.sales, 0)
  const totalOrders = data.reduce((sum, d) => sum + d.orders, 0)
  const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0

  const growthRate =
    data.length > 1 && data[0].sales > 0
      ? ((data[data.length - 1].sales - data[0].sales) / data[0].sales) * 100
      : 0

  const isPositive = growthRate >= 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Sales Overview</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Revenue trends over the last {data.length} months
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isPositive ? (
              <TrendingUp className="h-5 w-5 text-primary dark:text-emerald-400" />
            ) : (
              <TrendingDown className="h-5 w-5 text-destructive" />
            )}
            <span
              className={`text-sm font-medium ${
                isPositive ? 'text-primary dark:text-emerald-400' : 'text-destructive'
              }`}
            >
              {isPositive ? '+' : ''}
              {growthRate.toFixed(1)}%
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border bg-muted/40 p-4">
            <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              ${totalSales.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/40 p-4">
            <p className="text-sm font-medium text-muted-foreground">Total Orders</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {totalOrders.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/40 p-4">
            <p className="text-sm font-medium text-muted-foreground">Avg Order Value</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              ${avgOrderValue.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="space-y-3">
          <div className="flex items-end justify-between gap-2 h-64">
            {data.map((item) => {
              const height = maxSales > 0 ? (item.sales / maxSales) * 100 : 0
              return (
                <div
                  key={item.month}
                  className="flex-1 flex flex-col items-center gap-2"
                >
                  <div className="w-full flex items-end justify-center h-full">
                    <div
                      className="w-full max-w-[60px] rounded-t-lg transition-all cursor-pointer group relative"
                      style={{
                        height: `${height}%`,
                        backgroundColor: 'hsl(var(--chart-1))',
                      }}
                    >
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        <div className="bg-popover text-popover-foreground text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-md border">
                          <div className="font-medium">
                            ${item.sales.toLocaleString()}
                          </div>
                          <div className="text-muted-foreground">
                            {item.orders} orders
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    {item.month}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 pt-4 border-t">
          <div className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: 'hsl(var(--chart-1))' }}
            />
            <span className="text-sm text-muted-foreground">Monthly Revenue</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
