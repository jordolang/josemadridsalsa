'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, LineChart, PieChart } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  GOOGLE_ANALYTICS_CHART_COLORS,
  GOOGLE_ANALYTICS_DIMENSION_OPTIONS,
  GOOGLE_ANALYTICS_METRIC_OPTIONS,
} from '@/lib/google-analytics-config'
import type { GoogleAnalyticsChartResult } from '@/types/analytics'
import { ChartVisualization } from './ChartVisualization'
import {
  addGoogleAnalyticsChartAction,
  deleteGoogleAnalyticsChartAction,
} from '../actions'

interface Props {
  charts: GoogleAnalyticsChartResult[]
  canManageGa: boolean
}

export function CustomChartsManager({ charts, canManageGa }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const formData = new FormData(form)

    startTransition(async () => {
      const result = await addGoogleAnalyticsChartAction(formData)

      if ('error' in result) {
        setError(result.error)
        return
      }

      form.reset()
      router.refresh()
    })
  }

  const handleDelete = (chartId: string) => {
    setError(null)
    const formData = new FormData()
    formData.set('chartId', chartId)

    startTransition(async () => {
      const result = await deleteGoogleAnalyticsChartAction(formData)

      if ('error' in result) {
        setError(result.error)
        return
      }

      router.refresh()
    })
  }
  return (
    <Card className="p-6 space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Custom Google Analytics charts</h2>
          <p className="text-sm text-muted-foreground">
            Blend any GA metric + dimension and choose the visualization that best fits your reporting workflow.
          </p>
        </div>
        <Badge className="bg-muted text-foreground">
          {charts.length} configured
        </Badge>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {charts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No custom charts yet. Use the builder below to create your first dashboard widget.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {charts.map((chart) => (
            <div key={chart.definition.id} className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    {chart.definition.chartType === 'line' && <LineChart className="h-4 w-4" />}
                    {chart.definition.chartType === 'bar' && <BarChart3 className="h-4 w-4" />}
                    {chart.definition.chartType === 'pie' && <PieChart className="h-4 w-4" />}
                    <span>{chart.definition.chartType} chart</span>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{chart.definition.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {chart.definition.description || `${chart.definition.metric} • ${chart.definition.dimension}`}
                  </p>
                </div>
                {canManageGa && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(chart.definition.id)}
                    disabled={isPending}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <ChartVisualization chart={chart} />
            </div>
          ))}
        </div>
      )}
      {canManageGa && (
        <div>
          <h3 className="text-base font-semibold text-foreground">Add a custom chart</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Pick any GA metric + dimension combination, select the visualization style, and optionally cap the number
            of rows returned.
          </p>
          <form onSubmit={handleAdd} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="title" className="text-sm font-medium text-foreground">
                Chart title
              </label>
              <Input id="title" name="title" placeholder="Sessions by source" required />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="description" className="text-sm font-medium text-foreground">
                Description (optional)
              </label>
              <Input id="description" name="description" placeholder="Visible to admins only" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="metric">Metric</Label>
              <Select name="metric" required>
                <SelectTrigger id="metric">
                  <SelectValue placeholder="Select a metric" />
                </SelectTrigger>
                <SelectContent>
                  {GOOGLE_ANALYTICS_METRIC_OPTIONS.map((metric) => (
                    <SelectItem key={metric.value} value={metric.value}>
                      {metric.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dimension">Dimension</Label>
              <Select name="dimension" required>
                <SelectTrigger id="dimension">
                  <SelectValue placeholder="Select a dimension" />
                </SelectTrigger>
                <SelectContent>
                  {GOOGLE_ANALYTICS_DIMENSION_OPTIONS.map((dimension) => (
                    <SelectItem key={dimension.value} value={dimension.value}>
                      {dimension.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="chartType">Chart type</Label>
              <Select name="chartType" defaultValue="line">
                <SelectTrigger id="chartType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="line">Line</SelectItem>
                  <SelectItem value="bar">Bar</SelectItem>
                  <SelectItem value="pie">Pie</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="color">Color theme</Label>
              <Select name="color" defaultValue="indigo">
                <SelectTrigger id="color">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOOGLE_ANALYTICS_CHART_COLORS.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      {color.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="limit" className="text-sm font-medium text-foreground">
                Row limit (optional)
              </label>
              <Input
                id="limit"
                name="limit"
                type="number"
                min={1}
                placeholder="10"
                className="md:col-span-1"
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to let GA decide. Ignored for date-based line charts.
              </p>
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled={isPending}>
                Add chart
              </Button>
            </div>
          </form>
        </div>
      )}
    </Card>
  )
}
