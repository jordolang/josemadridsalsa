'use client'

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatAxisValue, formatMeasure } from '@/lib/data-studio/display'
import type { ReportResult, VizType } from '@/lib/data-studio/types'

/**
 * Renders a `ReportResult` with recharts.
 *
 * Two things here are deliberate rather than incidental.
 *
 * **Series keys are synthetic.** `ChartStyle` in `components/ui/chart.tsx` interpolates every config
 * key straight into a `<style dangerouslySetInnerHTML>` as `--color-${key}`. When a chart is split by
 * a dimension, the column ids are *database values* — a driver's name, a counterparty — so passing
 * them through as keys would put untrusted text inside a stylesheet. Each series is therefore given a
 * generated key (`s0`, `s1`, …) and its real name travels in `ChartConfig.label`, which React renders
 * as text. The rows are remapped to match.
 *
 * **`ChartContainer` already provides `ResponsiveContainer`.** Nesting another produces a chart with
 * zero height, so the chart element is passed directly as its child.
 */

const PALETTE = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--primary))',
] as const

interface Props {
  result: ReportResult
  vizType: VizType
  /** Fixed pixel width for the print route, where a percentage-width container measures wrongly. */
  printWidth?: number
}

export function ReportChart({ result, vizType, printWidth }: Props) {
  const categoryColumn = result.columns.find((c) => c.kind === 'time' || c.kind === 'dimension')
  const measureColumns = result.columns.filter((c) => c.kind === 'measure')

  if (!categoryColumn || measureColumns.length === 0 || result.rows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Nothing to plot for this combination yet.
      </p>
    )
  }

  // Untrusted column ids never become style-sheet keys — see the note above.
  const series = measureColumns.map((column, index) => ({
    key: `s${index}`,
    sourceId: column.id,
    label: column.label,
    unit: column.unit,
    color: PALETTE[index % PALETTE.length],
  }))

  const data = result.rows.map((row) => {
    const point: Record<string, string | number | null> = {
      __label: String(row.cells[categoryColumn.id] ?? ''),
    }
    for (const item of series) point[item.key] = row.cells[item.sourceId] ?? null
    return point
  })

  const config: ChartConfig = Object.fromEntries(
    series.map((item) => [item.key, { label: item.label, color: item.color }])
  )

  const primaryUnit = series[0]?.unit
  const axisFormatter = (value: number) => formatAxisValue(value, primaryUnit)
  const containerClass = printWidth ? 'h-[360px]' : 'aspect-auto h-[360px] w-full'
  const containerStyle = printWidth ? { width: printWidth } : undefined

  if (vizType === 'pie') {
    const item = series[0]
    return (
      <ChartContainer config={config} className={containerClass} style={containerStyle}>
        <PieChart>
          <ChartTooltip
            content={<ChartTooltipContent formatter={(value) => formatMeasure(Number(value), item?.unit)} />}
          />
          <Pie data={data} dataKey={item?.key ?? 's0'} nameKey="__label" outerRadius={130} label={false}>
            {data.map((_, index) => (
              <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
            ))}
          </Pie>
          <Legend />
        </PieChart>
      </ChartContainer>
    )
  }

  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey="__label" tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" />
      <YAxis tickLine={false} axisLine={false} width={70} tickFormatter={axisFormatter} />
      <ChartTooltip
        content={
          <ChartTooltipContent
            formatter={(value, name) => {
              const match = series.find((s) => s.key === name)
              return `${match?.label ?? name}: ${formatMeasure(Number(value), match?.unit)}`
            }}
          />
        }
      />
      {series.length > 1 ? <Legend /> : null}
    </>
  )

  if (vizType === 'line') {
    return (
      <ChartContainer config={config} className={containerClass} style={containerStyle}>
        <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          {axes}
          {series.map((item) => (
            <Line
              key={item.key}
              type="monotone"
              dataKey={item.key}
              stroke={`var(--color-${item.key})`}
              strokeWidth={2}
              dot={data.length <= 40}
              // A gap means "not recorded". Joining across it would draw a value nobody reported.
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ChartContainer>
    )
  }

  if (vizType === 'area') {
    return (
      <ChartContainer config={config} className={containerClass} style={containerStyle}>
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          {axes}
          {series.map((item) => (
            <Area
              key={item.key}
              type="monotone"
              dataKey={item.key}
              stroke={`var(--color-${item.key})`}
              fill={`var(--color-${item.key})`}
              fillOpacity={0.2}
              strokeWidth={2}
              connectNulls={false}
            />
          ))}
        </AreaChart>
      </ChartContainer>
    )
  }

  const stacked = vizType === 'stacked-bar'
  return (
    <ChartContainer config={config} className={containerClass} style={containerStyle}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
        {axes}
        {series.map((item) => (
          <Bar
            key={item.key}
            dataKey={item.key}
            fill={`var(--color-${item.key})`}
            stackId={stacked ? 'stack' : undefined}
            radius={stacked ? undefined : [4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ChartContainer>
  )
}
