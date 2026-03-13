'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface GrowthData {
  month: string
  customers: number
  newCustomers: number
}

interface CustomerGrowthChartProps {
  data?: GrowthData[]
}

const defaultData: GrowthData[] = [
  { month: 'Aug', customers: 320, newCustomers: 45 },
  { month: 'Sep', customers: 380, newCustomers: 60 },
  { month: 'Oct', customers: 425, newCustomers: 45 },
  { month: 'Nov', customers: 510, newCustomers: 85 },
  { month: 'Dec', customers: 580, newCustomers: 70 },
  { month: 'Jan', customers: 650, newCustomers: 70 },
  { month: 'Feb', customers: 720, newCustomers: 70 },
]

export function CustomerGrowthChart({ data = defaultData }: CustomerGrowthChartProps) {
  const maxCustomers = Math.max(...data.map((d) => d.customers))
  const totalNew = data.reduce((sum, d) => sum + d.newCustomers, 0)
  const latestTotal = data[data.length - 1]?.customers ?? 0

  // Build SVG line chart points
  const chartWidth = 400
  const chartHeight = 120
  const padding = 4

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (chartWidth - 2 * padding)
    const y = chartHeight - padding - ((d.customers / maxCustomers) * (chartHeight - 2 * padding))
    return { x, y }
  })

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ')

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${chartHeight} L ${points[0].x} ${chartHeight} Z`

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Customer Growth</CardTitle>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground">Total: {latestTotal}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              <span className="text-muted-foreground">New: {totalNew}</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Line chart */}
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-32"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="customerGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#customerGradient)" />
          <path
            d={linePath}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="3.5"
              fill="white"
              stroke="#10b981"
              strokeWidth="2"
            />
          ))}
        </svg>

        {/* Month labels */}
        <div className="flex justify-between mt-2 px-1">
          {data.map((d) => (
            <span key={d.month} className="text-xs text-muted-foreground">
              {d.month}
            </span>
          ))}
        </div>

        {/* New customer bars */}
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground mb-3">
            New Customers per Month
          </p>
          <div className="flex items-end gap-1.5 h-12">
            {data.map((d) => {
              const maxNew = Math.max(...data.map((dd) => dd.newCustomers))
              const height = (d.newCustomers / maxNew) * 100
              return (
                <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-blue-500 hover:bg-blue-600 transition-colors"
                    style={{ height: `${height}%` }}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
