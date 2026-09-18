'use client'

import { DollarSign, Mail, Percent, ShoppingCart } from 'lucide-react'
import { StatsCard } from '@/components/admin/StatsCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts'
import { formatPrice } from '@/lib/utils'
import type { AbandonedCartMetrics as AbandonedCartMetricsType } from '@/lib/analytics/abandoned-cart-metrics'

interface AbandonedCartMetricsProps {
  metrics: AbandonedCartMetricsType
}

const chartConfig = {
  abandoned: {
    label: 'Abandoned Carts',
    color: 'hsl(var(--chart-1))',
  },
  recovered: {
    label: 'Recovered Carts',
    color: 'hsl(var(--chart-2))',
  },
} satisfies ChartConfig

/** A share of sends, or a dash where dividing by no sends would read as 0%. */
function rate(part: number, whole: number): string {
  return whole === 0 ? '—' : `${((part / whole) * 100).toFixed(0)}%`
}

export function AbandonedCartMetrics({ metrics }: AbandonedCartMetricsProps) {
  const { summary, chart, emailsByStage } = metrics
  const totalStageSends = emailsByStage.reduce((sum, stage) => sum + stage.sent, 0)
  // Bars are drawn relative to the busiest stage, so the divisor is never 0 once anything sent.
  const mostSentInAStage = Math.max(1, ...emailsByStage.map((stage) => stage.sent))

  return (
    <div className="space-y-6">
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

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Abandoned vs Recovered Carts</CardTitle>
            <p className="text-sm text-muted-foreground">
              Daily cart abandonment and recovery trends
            </p>
          </CardHeader>
          <CardContent>
            {chart.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                No cart data available for the selected time range
              </div>
            ) : (
              <ChartContainer config={chartConfig} className="h-64 w-full">
                <LineChart data={chart} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => [
                          value,
                          name === 'abandoned' ? 'Abandoned' : 'Recovered',
                        ]}
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="abandoned"
                    stroke="var(--color-abandoned)"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="recovered"
                    stroke="var(--color-recovered)"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Emails by Stage</CardTitle>
            <p className="text-sm text-muted-foreground">
              Sends, opens and clicks per step of the recovery sequence
            </p>
          </CardHeader>
          <CardContent>
            {totalStageSends === 0 ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                No recovery emails sent in this range
              </div>
            ) : (
              <div className="space-y-4">
                {emailsByStage.map((stage) => (
                  <div key={stage.stage} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{stage.label}</span>
                      <span className="text-sm text-muted-foreground">
                        {stage.sent} sent
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${(stage.sent / mostSentInAStage) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {stage.opened} opened ({rate(stage.opened, stage.sent)}) ·{' '}
                      {stage.clicked} clicked ({rate(stage.clicked, stage.sent)})
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
