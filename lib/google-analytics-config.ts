import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type {
  GoogleAnalyticsChartDefinition,
  GoogleAnalyticsChartColor,
  GoogleAnalyticsSettings,
} from '@/types/analytics'

const DEFAULT_COLOR: GoogleAnalyticsChartColor = 'indigo'

export const GOOGLE_ANALYTICS_METRIC_OPTIONS = [
  { value: 'sessions', label: 'Sessions', description: 'Total number of visits within the selected period.' },
  { value: 'totalUsers', label: 'Total users', description: 'Unique users who visited your site.' },
  { value: 'newUsers', label: 'New users', description: 'Users who interacted with your site for the first time.' },
  { value: 'engagedSessions', label: 'Engaged sessions', description: 'Sessions longer than 10 seconds or with a conversion.' },
  { value: 'eventCount', label: 'Event count', description: 'Total recorded events.' },
  { value: 'conversions', label: 'Conversions', description: 'Number of conversion events.' },
  { value: 'bounceRate', label: 'Bounce rate', description: 'Percentage of sessions with no interaction.' },
  { value: 'averageSessionDuration', label: 'Avg. session duration', description: 'Average length of a session in seconds.' },
  { value: 'screenPageViews', label: 'Views', description: 'Screen or page views logged by GA4.' },
  { value: 'purchaseRevenue', label: 'Purchase revenue', description: 'Revenue attributed to eCommerce purchases.' },
]

export const GOOGLE_ANALYTICS_DIMENSION_OPTIONS = [
  { value: 'date', label: 'Date', description: 'Calendar day (YYYYMMDD) aggregated for the selected range.' },
  { value: 'sessionDefaultChannelGrouping', label: 'Default channel', description: 'Channel grouping such as Organic Search, Paid Search, etc.' },
  { value: 'sessionSourceMedium', label: 'Source / Medium', description: 'Combined source and medium attribution.' },
  { value: 'deviceCategory', label: 'Device category', description: 'Desktop, mobile, tablet breakdown.' },
  { value: 'country', label: 'Country', description: 'User country derived from IP geolocation.' },
  { value: 'city', label: 'City', description: 'User city derived from IP geolocation.' },
  { value: 'pageTitle', label: 'Page title', description: 'Title of the viewed page.' },
  { value: 'pagePathPlusQueryString', label: 'Page path', description: 'Full path and query string for the page view.' },
  { value: 'landingPage', label: 'Landing page', description: 'Landing page of the session.' },
]

export const GOOGLE_ANALYTICS_CHART_COLORS: Array<{
  value: GoogleAnalyticsChartColor
  label: string
  barClass: string
  lineStroke: string
  lineFill: string
}> = [
  {
    value: 'indigo',
    label: 'Indigo',
    barClass: 'bg-indigo-500',
    lineStroke: 'stroke-indigo-500',
    lineFill: 'fill-indigo-100',
  },
  {
    value: 'emerald',
    label: 'Emerald',
    barClass: 'bg-emerald-500',
    lineStroke: 'stroke-emerald-500',
    lineFill: 'fill-emerald-100',
  },
  {
    value: 'amber',
    label: 'Amber',
    barClass: 'bg-amber-500',
    lineStroke: 'stroke-amber-500',
    lineFill: 'fill-amber-100',
  },
  {
    value: 'rose',
    label: 'Rose',
    barClass: 'bg-rose-500',
    lineStroke: 'stroke-rose-500',
    lineFill: 'fill-rose-100',
  },
]

const DEFAULT_GA_CHARTS: GoogleAnalyticsChartDefinition[] = [
  {
    id: randomUUID(),
    title: 'Sessions by Source / Medium',
    description: 'Top traffic sources inside the date range.',
    metric: 'sessions',
    dimension: 'sessionSourceMedium',
    chartType: 'bar',
    limit: 6,
    color: 'indigo',
  },
  {
    id: randomUUID(),
    title: 'Engaged Sessions Over Time',
    description: 'Time-series view of engaged sessions.',
    metric: 'engagedSessions',
    dimension: 'date',
    chartType: 'line',
    limit: 30,
    color: 'emerald',
  },
  {
    id: randomUUID(),
    title: 'Users by Device Category',
    description: 'Device mix for your audience.',
    metric: 'totalUsers',
    dimension: 'deviceCategory',
    chartType: 'pie',
    limit: 5,
    color: 'amber',
  },
]

function serializeCharts(charts: GoogleAnalyticsChartDefinition[]): Prisma.InputJsonValue {
  return charts.map((chart) => ({
    ...chart,
    limit: chart.limit ?? null,
    color: chart.color ?? DEFAULT_COLOR,
  }))
}

function cloneDefaultCharts() {
  return DEFAULT_GA_CHARTS.map((chart) => ({ ...chart }))
}

function createFallbackAnalyticsSettings(): GoogleAnalyticsSettings {
  return {
    id: 'fallback-analytics-settings',
    measurementId: process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID || null,
    propertyId: null,
    dataStreamId: null,
    chartDefinitions: cloneDefaultCharts(),
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }
}

function hydrateCharts(value: unknown): GoogleAnalyticsChartDefinition[] {
  if (!Array.isArray(value)) {
    return cloneDefaultCharts()
  }

  const parsed = value
    .map((entry) => {
      if (typeof entry !== 'object' || entry === null) return null
      const raw = entry as Record<string, unknown>
      const metric = typeof raw.metric === 'string' ? raw.metric : null
      const dimension = typeof raw.dimension === 'string' ? raw.dimension : null
      const chartType = typeof raw.chartType === 'string' ? raw.chartType : null
      const title = typeof raw.title === 'string' ? raw.title : 'Custom chart'

      if (!metric || !dimension || !chartType) {
        return null
      }

      const chart: GoogleAnalyticsChartDefinition = {
        id: typeof raw.id === 'string' ? raw.id : randomUUID(),
        title,
        description: (typeof raw.description === 'string' ? raw.description : null) ?? null,
        metric,
        dimension,
        chartType: chartType as GoogleAnalyticsChartDefinition['chartType'],
        limit: typeof raw.limit === 'number' ? raw.limit : null,
        color: (raw.color as GoogleAnalyticsChartColor) ?? DEFAULT_COLOR,
      }
      return chart
    })
    .filter((entry): entry is GoogleAnalyticsChartDefinition => entry !== null)

  if (parsed.length === 0) {
    return cloneDefaultCharts()
  }

  return parsed
}

async function ensureSettingsRecord() {
  const existing = await prisma.analyticsSetting.findFirst({
    orderBy: { createdAt: 'asc' },
  })

  if (existing) {
    return existing
  }

  return prisma.analyticsSetting.create({
    data: {
      measurementId: process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID || null,
      chartDefinitions: serializeCharts(DEFAULT_GA_CHARTS),
    },
  })
}

function toSettingsPayload(record: { id: string; measurementId: string | null; propertyId: string | null; dataStreamId: string | null; chartDefinitions: unknown; createdAt: Date; updatedAt: Date }): GoogleAnalyticsSettings {
  return {
    id: record.id,
    measurementId: record.measurementId,
    propertyId: record.propertyId,
    dataStreamId: record.dataStreamId,
    chartDefinitions: hydrateCharts(record.chartDefinitions),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

export async function getGoogleAnalyticsSettings(): Promise<GoogleAnalyticsSettings> {
  try {
    const record = await ensureSettingsRecord()
    return toSettingsPayload(record)
  } catch (error) {
    console.warn('Could not load analytics settings from Prisma, using defaults instead.', error)
    return createFallbackAnalyticsSettings()
  }
}

export async function saveGoogleAnalyticsSettings({
  measurementId,
  propertyId,
  dataStreamId,
  updatedBy,
}: {
  measurementId?: string | null
  propertyId?: string | null
  dataStreamId?: string | null
  updatedBy?: string | null
}) {
  const record = await ensureSettingsRecord()
  const data: Prisma.AnalyticsSettingUpdateInput = {}

  if (measurementId !== undefined) {
    data.measurementId = measurementId && measurementId.length > 0 ? measurementId : null
  }
  if (propertyId !== undefined) {
    data.propertyId = propertyId && propertyId.length > 0 ? propertyId : null
  }
  if (dataStreamId !== undefined) {
    data.dataStreamId = dataStreamId && dataStreamId.length > 0 ? dataStreamId : null
  }
  if (updatedBy !== undefined && updatedBy !== null) {
    data.updatedBy = { connect: { id: updatedBy } }
  }

  await prisma.analyticsSetting.update({
    where: { id: record.id },
    data,
  })

  return getGoogleAnalyticsSettings()
}

export async function addGoogleAnalyticsChartDefinition({
  title,
  description,
  metric,
  dimension,
  chartType,
  limit,
  color,
  updatedBy,
}: {
  title: string
  description?: string | null
  metric: string
  dimension: string
  chartType: GoogleAnalyticsChartDefinition['chartType']
  limit?: number | null
  color?: GoogleAnalyticsChartColor
  updatedBy?: string | null
}) {
  const record = await ensureSettingsRecord()
  const charts = hydrateCharts(record.chartDefinitions)

  const sanitizedLimit = typeof limit === 'number' && Number.isFinite(limit) ? Math.max(1, Math.min(5000, Math.round(limit))) : null

  const newChart: GoogleAnalyticsChartDefinition = {
    id: randomUUID(),
    title: title.trim() || 'Custom chart',
    description: description?.trim() || null,
    metric,
    dimension,
    chartType,
    limit: sanitizedLimit,
    color: color ?? DEFAULT_COLOR,
  }

  charts.push(newChart)

  await prisma.analyticsSetting.update({
    where: { id: record.id },
    data: {
      chartDefinitions: serializeCharts(charts),
      updatedBy: updatedBy ? { connect: { id: updatedBy } } : undefined,
    },
  })

  return newChart
}

export async function deleteGoogleAnalyticsChartDefinition(chartId: string, updatedBy?: string | null) {
  if (!chartId) return

  const record = await ensureSettingsRecord()
  const charts = hydrateCharts(record.chartDefinitions)
  const nextCharts = charts.filter((chart) => chart.id !== chartId)

  await prisma.analyticsSetting.update({
    where: { id: record.id },
    data: {
      chartDefinitions: serializeCharts(nextCharts),
      updatedBy: updatedBy ? { connect: { id: updatedBy } } : undefined,
    },
  })
}

export function getDefaultGoogleAnalyticsCharts() {
  return cloneDefaultCharts()
}
