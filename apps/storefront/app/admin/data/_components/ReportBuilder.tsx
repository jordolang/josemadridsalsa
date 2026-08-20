'use client'

import { useMemo, useState, useTransition } from 'react'
import { Loader2, Play, Plus, X } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DATASETS, getDataset, grainsFor } from '@/lib/data-studio/registry'
import type {
  DatasetDef,
  FilterOp,
  QuerySpec,
  ReportResult,
  TimeGrain,
  VizType,
} from '@/lib/data-studio/types'

import { ReportViewer } from './ReportViewer'

/**
 * The builder.
 *
 * Every control is generated from the dataset registry, so a new dataset or measure appears here
 * without a UI change. The registry is client-safe by construction — its dataset definitions are data
 * and never reach Prisma — which is what allows this component to import it directly instead of
 * shipping a duplicate description of every dataset down the wire.
 *
 * Validation is deliberately duplicated in spirit but not in code: this component *disables* the
 * combinations the schema would reject (a month grain on a year-axis dataset, several measures on a
 * dimension-split series), while `schemas.ts` remains the only thing that actually decides. The UI
 * guides; the server rules.
 */

const VIZ_OPTIONS: { value: VizType; label: string }[] = [
  { value: 'bar', label: 'Bar chart' },
  { value: 'stacked-bar', label: 'Stacked bar' },
  { value: 'line', label: 'Line chart' },
  { value: 'area', label: 'Area chart' },
  { value: 'pie', label: 'Pie chart' },
  { value: 'table', label: 'Table only' },
  { value: 'kpi', label: 'Headline figures' },
]

const GRAIN_LABELS: Record<TimeGrain, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
  quarter: 'Quarter',
  year: 'Year',
}

const OP_LABELS: Record<FilterOp, string> = {
  eq: 'is',
  neq: 'is not',
  in: 'is any of',
  gte: 'is at least',
  lte: 'is at most',
  contains: 'contains',
  isNull: 'is blank',
  notNull: 'is not blank',
}

const NONE = '__none'

interface DraftFilter {
  field: string
  op: FilterOp
  value: string
}

interface Props {
  datasets: DatasetDef[]
  initialDatasetId?: string
}

export function ReportBuilder({ datasets, initialDatasetId }: Props) {
  const first = initialDatasetId ?? datasets[0]?.id ?? DATASETS[0].id
  const [datasetId, setDatasetId] = useState(first)
  const dataset = getDataset(datasetId) ?? datasets[0]

  const [measureIds, setMeasureIds] = useState<string[]>([dataset?.measures[0]?.id ?? ''])
  const [dimensionId, setDimensionId] = useState<string>(NONE)
  const [timeGrain, setTimeGrain] = useState<string>(
    dataset?.timeAxis.kind === 'year' ? 'year' : 'month'
  )
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [vizType, setVizType] = useState<VizType>('bar')
  const [limit, setLimit] = useState('')
  const [filters, setFilters] = useState<DraftFilter[]>([])

  const [result, setResult] = useState<ReportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const grains = dataset ? grainsFor(dataset) : []
  const isYearAxis = dataset?.timeAxis.kind === 'year'
  // Splitting a series by a dimension charts one measure — a grid of measure x member columns is
  // unreadable, and the schema rejects it.
  const measureLimit = dimensionId !== NONE && timeGrain !== NONE ? 1 : 6

  function switchDataset(nextId: string) {
    const next = getDataset(nextId)
    setDatasetId(nextId)
    // Nothing carries over: another dataset's measure and dimension ids are meaningless here, and a
    // stale one would only fail validation on the next run.
    setMeasureIds([next?.measures[0]?.id ?? ''])
    setDimensionId(NONE)
    setTimeGrain(next?.timeAxis.kind === 'year' ? 'year' : 'month')
    setFilters([])
    setFrom('')
    setTo('')
    setResult(null)
    setError(null)
  }

  function toggleMeasure(id: string) {
    setMeasureIds((current) => {
      if (current.includes(id)) {
        const next = current.filter((m) => m !== id)
        return next.length === 0 ? current : next
      }
      if (current.length >= measureLimit) return measureLimit === 1 ? [id] : current
      return [...current, id]
    })
  }

  const spec = useMemo<Record<string, unknown>>(() => {
    const built: Record<string, unknown> = {
      specVersion: 1,
      datasetId,
      measureIds,
      filters: filters
        .filter((f) => f.field)
        .map((f) => ({
          field: f.field,
          op: f.op,
          value: f.op === 'isNull' || f.op === 'notNull' ? undefined : f.op === 'in' ? f.value.split(',').map((v) => v.trim()).filter(Boolean) : f.value,
        })),
      vizType,
    }
    if (dimensionId !== NONE) built.dimensionId = dimensionId
    if (timeGrain !== NONE) built.timeGrain = timeGrain
    if (!isYearAxis && from && to) built.dateRange = { from, to }
    if (limit) built.limit = Number(limit)
    return built
  }, [datasetId, measureIds, filters, vizType, dimensionId, timeGrain, isYearAxis, from, to, limit])

  function run() {
    setError(null)
    startTransition(async () => {
      try {
        const response = await fetch('/api/admin/data/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(spec),
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          setError(payload?.error ?? 'The report could not be run.')
          setResult(null)
          return
        }
        setResult(payload.result as ReportResult)
      } catch {
        setError('The report could not be reached. Check your connection and try again.')
      }
    })
  }

  if (!dataset) {
    return (
      <Alert>
        <AlertDescription>
          You do not have permission to read any dataset yet. Ask an administrator for access to a
          domain — financials, fundraising, customers or operations.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Build a report</CardTitle>
          <CardDescription>{dataset.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="dataset">Data source</Label>
              <Select value={datasetId} onValueChange={switchDataset}>
                <SelectTrigger id="dataset">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {datasets.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="grain">Group by time</Label>
              <Select value={timeGrain} onValueChange={setTimeGrain}>
                <SelectTrigger id="grain">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No time grouping</SelectItem>
                  {grains.map((grain) => (
                    <SelectItem key={grain} value={grain}>
                      {GRAIN_LABELS[grain]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isYearAxis && (
                <p className="text-xs text-muted-foreground">
                  {dataset.label} records only a year, so year is the only grouping available.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dimension">Break down by</Label>
              <Select value={dimensionId} onValueChange={setDimensionId}>
                <SelectTrigger id="dimension">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nothing</SelectItem>
                  {dataset.dimensions.map((dimension) => (
                    <SelectItem key={dimension.id} value={dimension.id}>
                      {dimension.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="viz">Show as</Label>
              <Select value={vizType} onValueChange={(value) => setVizType(value as VizType)}>
                <SelectTrigger id="viz">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIZ_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              Measures{' '}
              {measureLimit === 1 && (
                <span className="font-normal text-muted-foreground">
                  — one at a time when broken down over time
                </span>
              )}
            </Label>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {dataset.measures.map((measure) => (
                <label
                  key={measure.id}
                  className="flex cursor-pointer items-start gap-2 rounded-md border p-2.5 text-sm hover:bg-muted/50"
                >
                  <Checkbox
                    checked={measureIds.includes(measure.id)}
                    onCheckedChange={() => toggleMeasure(measure.id)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium">{measure.label}</span>
                    {measure.description && (
                      <span className="block text-xs text-muted-foreground">{measure.description}</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {!isYearAxis && (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="from">From</Label>
                <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="to">To</Label>
                <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="limit">Row limit</Label>
                <Input
                  id="limit"
                  type="number"
                  min={1}
                  max={500}
                  placeholder="All"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Filters</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setFilters((current) => [
                    ...current,
                    { field: dataset.filters[0]?.field ?? '', op: dataset.filters[0]?.ops[0] ?? 'eq', value: '' },
                  ])
                }
                disabled={dataset.filters.length === 0}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add filter
              </Button>
            </div>

            {filters.length === 0 ? (
              <p className="text-sm text-muted-foreground">No filters — every row is included.</p>
            ) : (
              <div className="space-y-2">
                {filters.map((filter, index) => {
                  const definition = dataset.filters.find((f) => f.field === filter.field)
                  const needsValue = filter.op !== 'isNull' && filter.op !== 'notNull'
                  return (
                    <div key={index} className="flex flex-wrap items-center gap-2">
                      <Select
                        value={filter.field}
                        onValueChange={(value) => {
                          const next = dataset.filters.find((f) => f.field === value)
                          setFilters((current) =>
                            current.map((f, i) =>
                              i === index ? { field: value, op: next?.ops[0] ?? 'eq', value: '' } : f
                            )
                          )
                        }}
                      >
                        <SelectTrigger className="w-[190px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {dataset.filters.map((option) => (
                            <SelectItem key={option.id} value={option.field}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={filter.op}
                        onValueChange={(value) =>
                          setFilters((current) =>
                            current.map((f, i) => (i === index ? { ...f, op: value as FilterOp } : f))
                          )
                        }
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(definition?.ops ?? ['eq']).map((op) => (
                            <SelectItem key={op} value={op}>
                              {OP_LABELS[op]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {needsValue &&
                        (definition?.values && filter.op !== 'in' ? (
                          <Select
                            value={filter.value}
                            onValueChange={(value) =>
                              setFilters((current) =>
                                current.map((f, i) => (i === index ? { ...f, value } : f))
                              )
                            }
                          >
                            <SelectTrigger className="w-[220px]">
                              <SelectValue placeholder="Choose a value" />
                            </SelectTrigger>
                            <SelectContent>
                              {definition.values.map((value) => (
                                <SelectItem key={value} value={value}>
                                  {definition.labels?.[value] ?? value}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            className="w-[220px]"
                            placeholder={filter.op === 'in' ? 'Comma separated' : 'Value'}
                            value={filter.value}
                            onChange={(e) =>
                              setFilters((current) =>
                                current.map((f, i) => (i === index ? { ...f, value: e.target.value } : f))
                              )
                            }
                          />
                        ))}

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setFilters((current) => current.filter((_, i) => i !== index))}
                        aria-label="Remove filter"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={run} disabled={isPending || measureIds.length === 0}>
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Run report
            </Button>
            <Badge variant="outline">{dataset.label}</Badge>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <Card>
          <CardContent className="pt-6">
            <ReportViewer result={result} vizType={vizType} emptyStateNote={dataset.emptyStateNote} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
