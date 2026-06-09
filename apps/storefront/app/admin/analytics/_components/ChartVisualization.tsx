'use client'

import type { GoogleAnalyticsChartResult } from '@/types/analytics'
import { getChartColorConfig, type ChartColorConfig } from '@/lib/analytics/chart-utils'

const PIE_SEGMENT_COLORS = ['#4f46e5', '#22d3ee', '#f97316', '#22c55e', '#f43f5e', '#a855f7']

interface ChartVisualizationProps {
  chart: GoogleAnalyticsChartResult
}

export function ChartVisualization({ chart }: ChartVisualizationProps) {
  const color = getChartColorConfig(chart.definition.color)

  if (chart.points.length === 0) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        No Google Analytics data returned for this metric and dimension within the selected range.
      </p>
    )
  }

  if (chart.definition.chartType === 'line') {
    return renderLineChart(chart.points, color)
  }

  if (chart.definition.chartType === 'bar') {
    return renderBarChart(chart.points, color)
  }

  return renderPieChart(chart.points)
}

function renderLineChart(
  points: GoogleAnalyticsChartResult['points'],
  color: ChartColorConfig
) {
  const maxValue = Math.max(...points.map((point) => point.value), 0)
  const safeMax = maxValue === 0 ? 1 : maxValue
  const denominator = Math.max(points.length - 1, 1)

  const path = points
    .map((point, index) => {
      const x = (index / denominator) * 100
      const y = 100 - (point.value / safeMax) * 100
      return `${index === 0 ? 'M' : 'L'}${x},${y}`
    })
    .join(' ')
  const areaPath = `${path} L100,100 L0,100 Z`

  return (
    <div className="mt-4">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-40 w-full">
        <path d={areaPath} className={`${color.lineFill} opacity-70`} />
        <path d={path} className={`${color.lineStroke} fill-none`} strokeWidth={2.2} strokeLinecap="round" />
      </svg>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        {points.map((point) => (
          <div key={point.label}>
            <p className="font-semibold text-foreground">{point.label}</p>
            <p>{point.value.toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function renderBarChart(
  points: GoogleAnalyticsChartResult['points'],
  color: ChartColorConfig
) {
  const maxValue = Math.max(...points.map((point) => point.value), 0)
  const safeMax = maxValue === 0 ? 1 : maxValue

  return (
    <div className="mt-4">
      <div className="flex h-40 items-end gap-4">
        {points.map((point) => (
          <div key={point.label} className="flex flex-1 flex-col items-center gap-2 text-xs">
            <div className="flex h-full w-full items-end rounded-t-lg bg-muted">
              <div
                className={`mx-auto w-3/4 rounded-t-lg ${color.barClass}`}
                style={{ height: `${(point.value / safeMax) * 100}%` }}
              />
            </div>
            <span className="text-muted-foreground">{point.label}</span>
            <span className="font-semibold text-foreground">{point.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function renderPieChart(points: GoogleAnalyticsChartResult['points']) {
  const total = points.reduce((sum, point) => sum + point.value, 0)
  const safeTotal = total === 0 ? 1 : total
  let current = 0

  const segments = points.map((point, index) => {
    const percentage = (point.value / safeTotal) * 100
    const start = current
    const end = current + percentage
    current = end
    return `${PIE_SEGMENT_COLORS[index % PIE_SEGMENT_COLORS.length]} ${start}% ${end}%`
  })

  const gradient =
    segments.length > 0 ? segments.join(', ') : `${PIE_SEGMENT_COLORS[0]} 0% 100%`

  return (
    <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center">
      <div
        className="mx-auto h-40 w-40 rounded-full"
        style={{
          backgroundImage: `conic-gradient(${gradient})`,
        }}
      />
      <ul className="flex-1 space-y-2 text-sm">
        {points.map((point, index) => (
          <li key={point.label} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: PIE_SEGMENT_COLORS[index % PIE_SEGMENT_COLORS.length] }}
              />
              <span className="text-foreground">{point.label}</span>
            </div>
            <span className="font-semibold text-foreground">
              {((point.value / safeTotal) * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
