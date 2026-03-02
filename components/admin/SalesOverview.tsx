'use client'

import { Card } from '@/components/ui/card'
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

// Default demo data for visualization
const defaultData: SalesData[] = [
  { month: 'Jan', sales: 12500, orders: 145 },
  { month: 'Feb', sales: 15800, orders: 178 },
  { month: 'Mar', sales: 13200, orders: 156 },
  { month: 'Apr', sales: 18500, orders: 203 },
  { month: 'May', sales: 21300, orders: 234 },
  { month: 'Jun', sales: 24800, orders: 267 },
  { month: 'Jul', sales: 22100, orders: 245 },
]

export function SalesOverview({ data = defaultData, loading }: SalesOverviewProps) {
  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 bg-slate-200 rounded" />
          <div className="h-64 bg-slate-200 rounded" />
        </div>
      </Card>
    )
  }

  // Calculate max value for scaling
  const maxSales = Math.max(...data.map(d => d.sales))
  const totalSales = data.reduce((sum, d) => sum + d.sales, 0)
  const totalOrders = data.reduce((sum, d) => sum + d.orders, 0)
  const avgOrderValue = totalSales / totalOrders

  // Calculate growth from first to last month
  const growthRate = data.length > 1
    ? ((data[data.length - 1].sales - data[0].sales) / data[0].sales) * 100
    : 0

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Sales Overview</h2>
            <p className="text-sm text-slate-600 mt-1">
              Revenue trends over the last {data.length} months
            </p>
          </div>
          <div className="flex items-center gap-2">
            {growthRate >= 0 ? (
              <TrendingUp className="h-5 w-5 text-green-600" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-600" />
            )}
            <span className={`text-sm font-medium ${growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {growthRate >= 0 ? '+' : ''}{growthRate.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-900">Total Revenue</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              ${totalSales.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg bg-green-50 p-4">
            <p className="text-sm font-medium text-green-900">Total Orders</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {totalOrders.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg bg-purple-50 p-4">
            <p className="text-sm font-medium text-purple-900">Avg Order Value</p>
            <p className="text-2xl font-bold text-purple-600 mt-1">
              ${avgOrderValue.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="space-y-3">
          <div className="flex items-end justify-between gap-2 h-64">
            {data.map((item, index) => {
              const height = (item.sales / maxSales) * 100
              return (
                <div key={item.month} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex items-end justify-center h-full">
                    <div
                      className="w-full max-w-[60px] bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg hover:from-blue-700 hover:to-blue-500 transition-all cursor-pointer group relative"
                      style={{ height: `${height}%` }}
                    >
                      {/* Tooltip on hover */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <div className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                          <div className="font-medium">${item.sales.toLocaleString()}</div>
                          <div className="text-slate-300">{item.orders} orders</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-slate-600">{item.month}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 pt-4 border-t">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-blue-600" />
            <span className="text-sm text-slate-600">Monthly Revenue</span>
          </div>
        </div>
      </div>
    </Card>
  )
}
