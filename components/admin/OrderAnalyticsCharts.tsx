'use client'

import { Card } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'

interface DayPoint {
  date: string
  label: string
  orders: number
  revenue: number
}

interface OrderAnalyticsChartsProps {
  chart: DayPoint[]
}

const revenueConfig = {
  revenue: {
    label: 'Revenue',
    color: 'hsl(142, 71%, 45%)',
  },
} satisfies ChartConfig

const ordersConfig = {
  orders: {
    label: 'Orders',
    color: 'hsl(221, 83%, 53%)',
  },
} satisfies ChartConfig

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function OrderAnalyticsCharts({ chart }: OrderAnalyticsChartsProps) {
  if (chart.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-sm text-slate-500">No order data for this period.</p>
      </Card>
    )
  }

  // For large date ranges, thin out labels to avoid overlap
  const labelInterval = chart.length > 60 ? Math.floor(chart.length / 12) : chart.length > 14 ? 2 : 0

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Revenue Chart */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Revenue</h2>
        <ChartContainer config={revenueConfig} className="h-64 w-full">
          <LineChart data={chart} accessibilityLayer>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              fontSize={12}
              interval={labelInterval}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              fontSize={12}
              tickFormatter={formatCurrency}
              width={60}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => formatCurrency(Number(value))}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="var(--color-revenue)"
              strokeWidth={2}
              dot={chart.length <= 31}
            />
          </LineChart>
        </ChartContainer>
      </Card>

      {/* Order Count Chart */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Order Count</h2>
        <ChartContainer config={ordersConfig} className="h-64 w-full">
          <BarChart data={chart} accessibilityLayer>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              fontSize={12}
              interval={labelInterval}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              fontSize={12}
              allowDecimals={false}
              width={40}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="orders"
              fill="var(--color-orders)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </Card>
    </div>
  )
}
