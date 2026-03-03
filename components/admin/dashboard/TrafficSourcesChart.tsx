'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface TrafficSource {
  name: string
  value: number
  color: string
}

interface TrafficSourcesChartProps {
  data?: TrafficSource[]
}

const defaultData: TrafficSource[] = [
  { name: 'Direct', value: 35, color: '#3b82f6' },
  { name: 'Social Media', value: 28, color: '#8b5cf6' },
  { name: 'Search Engine', value: 22, color: '#10b981' },
  { name: 'Referral', value: 15, color: '#f59e0b' },
]

function DonutChart({ data }: { data: TrafficSource[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const size = 160
  const strokeWidth = 28
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  let accumulated = 0

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {data.map((item, i) => {
          const percent = item.value / total
          const dashLength = circumference * percent
          const dashOffset = circumference * (1 - accumulated / total) + circumference * 0.25
          accumulated += item.value

          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dashLength} ${circumference - dashLength}`}
              strokeDashoffset={dashOffset}
              className="transition-all duration-500"
            />
          )
        })}
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-bold text-foreground">{total}%</div>
        <div className="text-xs text-muted-foreground">Total</div>
      </div>
    </div>
  )
}

export function TrafficSourcesChart({ data = defaultData }: TrafficSourcesChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Traffic Sources</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-4">
          <DonutChart data={data} />
          <div className="w-full space-y-3">
            {data.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-muted-foreground">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{item.value}%</span>
                  <div className="h-1.5 w-16 rounded-full bg-muted">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{
                        width: `${(item.value / total) * 100}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
