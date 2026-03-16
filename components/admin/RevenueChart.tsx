'use client'

import { Card } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts'

interface RevenueData {
  month: string
  revenue: number
  expenses: number
}

interface RevenueChartProps {
  data?: RevenueData[]
  loading?: boolean
}

const defaultData: RevenueData[] = [
  { month: 'Jan', revenue: 12500, expenses: 8200 },
  { month: 'Feb', revenue: 15800, expenses: 9100 },
  { month: 'Mar', revenue: 13200, expenses: 8800 },
  { month: 'Apr', revenue: 18500, expenses: 10200 },
  { month: 'May', revenue: 21300, expenses: 11500 },
  { month: 'Jun', revenue: 24800, expenses: 12800 },
  { month: 'Jul', revenue: 22100, expenses: 11900 },
]

const chartConfig = {
  revenue: {
    label: 'Revenue',
    color: 'hsl(221, 83%, 53%)',
  },
  expenses: {
    label: 'Expenses',
    color: 'hsl(0, 84%, 60%)',
  },
} satisfies ChartConfig

export function RevenueChart({ data = defaultData, loading }: RevenueChartProps) {
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

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Revenue vs Expenses</h2>
          <p className="text-sm text-slate-600 mt-1">
            Monthly revenue and expense trends
          </p>
        </div>

        <ChartContainer config={chartConfig} className="h-64 w-full">
          <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value: number) => `$${(value / 1000).toFixed(0)}k`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => `$${Number(value).toLocaleString()}`}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="var(--color-revenue)"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="expenses"
              stroke="var(--color-expenses)"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ChartContainer>
      </div>
    </Card>
  )
}
