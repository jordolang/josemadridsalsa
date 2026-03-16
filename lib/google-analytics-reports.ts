import { BetaAnalyticsDataClient } from '@google-analytics/data'
import type { protos } from '@google-analytics/data'
import type { AnalyticsRangeKey } from '@/lib/analytics/date-range'
import { getDateRange, formatDateForAnalytics } from '@/lib/analytics/date-range'
import { getGoogleAnalyticsSettings } from '@/lib/google-analytics-config'
import { getDecryptedServiceKeyValue, hasActiveServiceKey } from '@/lib/service-keys'
import type {
  GoogleAnalyticsChartDefinition,
  GoogleAnalyticsChartResult,
  GoogleAnalyticsDashboardData,
  GoogleAnalyticsSummaryCard,
} from '@/types/analytics'

type GaServiceAccountSecret = {
  client_email?: string
  private_key?: string
  impersonated_user?: string
}

const SUMMARY_METRICS: Array<{
  metric: string
  label: string
  format: GoogleAnalyticsSummaryCard['format']
  description: string
}> = [
  { metric: 'sessions', label: 'Sessions', format: 'number', description: 'Total number of visits within the selected range.' },
  { metric: 'totalUsers', label: 'Total users', format: 'number', description: 'Unique users who visited your storefront.' },
  { metric: 'newUsers', label: 'New users', format: 'number', description: 'First-time visitors detected by GA4.' },
  { metric: 'engagedSessions', label: 'Engaged sessions', format: 'number', description: 'Sessions over 10 seconds or with key events.' },
  { metric: 'bounceRate', label: 'Bounce rate', format: 'percent', description: 'Percentage of sessions without interactions.' },
  { metric: 'averageSessionDuration', label: 'Avg. session duration', format: 'duration', description: 'Average length of a visitor session.' },
]

async function getAnalyticsClient(): Promise<BetaAnalyticsDataClient | null> {
  const secret = await getDecryptedServiceKeyValue('google_analytics', 'service_account')

  if (!secret) {
    return null
  }

  let parsed: GaServiceAccountSecret
  try {
    parsed = JSON.parse(secret)
  } catch (error) {
    console.error('[google-analytics] Unable to parse service account secret', error)
    return null
  }

  const clientEmail = parsed.client_email
  const privateKey = parsed.private_key?.replace(/\\n/g, '\n')

  if (!clientEmail || !privateKey) {
    console.warn('[google-analytics] Service account secret missing required fields')
    return null
  }

  return new BetaAnalyticsDataClient({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
  })
}

function normalizePropertyId(propertyId: string) {
  if (!propertyId) return null
  return propertyId.startsWith('properties/') ? propertyId : `properties/${propertyId}`
}

function formatMetricValue(format: GoogleAnalyticsSummaryCard['format'], value: number) {
  if (!Number.isFinite(value)) {
    value = 0
  }

  switch (format) {
    case 'percent':
      return `${value.toFixed(1)}%`
    case 'duration': {
      const totalSeconds = Math.max(0, Math.round(value))
      const hours = Math.floor(totalSeconds / 3600)
      const minutes = Math.floor((totalSeconds % 3600) / 60)
      const seconds = totalSeconds % 60
      if (hours > 0) {
        return `${hours}h ${minutes}m`
      }
      return `${minutes}m ${seconds}s`
    }
    case 'currency':
      return value.toLocaleString(undefined, { style: 'currency', currency: 'USD' })
    default:
      return value.toLocaleString(undefined, { maximumFractionDigits: 0 })
  }
}

function formatDateDimension(value: string) {
  if (!value || value.length !== 8) {
    return value || 'Unknown'
  }

  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(4, 6)) - 1
  const day = Number(value.slice(6, 8))
  const date = new Date(Date.UTC(year, month, day))
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

async function runReport({
  propertyId,
  client,
  request,
}: {
  propertyId: string
  client: BetaAnalyticsDataClient
  request: protos.google.analytics.data.v1beta.IRunReportRequest
}) {
  const property = normalizePropertyId(propertyId)
  if (!property) {
    throw new Error('Google Analytics property ID is missing')
  }

  const [response] = await client.runReport({
    property,
    ...request,
  })

  return response
}

async function fetchSummaryCards(propertyId: string, range: AnalyticsRangeKey, client: BetaAnalyticsDataClient): Promise<GoogleAnalyticsSummaryCard[]> {
  const { start, end } = getDateRange(range)
  const request: protos.google.analytics.data.v1beta.IRunReportRequest = {
    dateRanges: [
      {
        startDate: formatDateForAnalytics(start),
        endDate: formatDateForAnalytics(end),
      },
    ],
    metrics: SUMMARY_METRICS.map((item) => ({ name: item.metric })),
  }

  const report = await runReport({ propertyId, client, request })
  const row = report.rows?.[0]

  return SUMMARY_METRICS.map((metricConfig, index) => {
    const rawValue = row?.metricValues?.[index]?.value ?? '0'
    const numericValue = Number(rawValue) || 0

    return {
      id: metricConfig.metric,
      label: metricConfig.label,
      metric: metricConfig.metric,
      format: metricConfig.format,
      description: metricConfig.description,
      value: numericValue,
      formattedValue: formatMetricValue(metricConfig.format, numericValue),
    }
  })
}

function buildOrderBys(definition: GoogleAnalyticsChartDefinition): protos.google.analytics.data.v1beta.IOrderBy[] | undefined {
  if (definition.dimension === 'date') {
    return [
      {
        dimension: {
          dimensionName: 'date',
        },
        desc: false,
      },
    ]
  }

  return [
    {
      metric: {
        metricName: definition.metric,
      },
      desc: true,
    },
  ]
}

function toChartPoints(definition: GoogleAnalyticsChartDefinition, rows: protos.google.analytics.data.v1beta.IRow[] | null | undefined) {
  if (!rows) {
    return { points: [], total: 0 }
  }

  const points = rows.map((row) => {
    const labelRaw = row.dimensionValues?.[0]?.value ?? 'Unknown'
    const value = Number(row.metricValues?.[0]?.value ?? 0) || 0
    const label = definition.dimension === 'date' ? formatDateDimension(labelRaw) : labelRaw || 'Unknown'
    return { label, value }
  })

  const total = points.reduce((sum, point) => sum + point.value, 0)

  return { points, total }
}

async function fetchCustomCharts(
  definitions: GoogleAnalyticsChartDefinition[],
  propertyId: string,
  range: AnalyticsRangeKey,
  client: BetaAnalyticsDataClient
): Promise<GoogleAnalyticsChartResult[]> {
  if (definitions.length === 0) {
    return []
  }

  const { start, end, days } = getDateRange(range)
  const dateRange = {
    startDate: formatDateForAnalytics(start),
    endDate: formatDateForAnalytics(end),
  }

  const tasks = definitions.map(async (definition) => {
    try {
      const limit =
        definition.dimension === 'date'
          ? days
          : definition.limit && definition.limit > 0
            ? definition.limit
            : 10

      const request: protos.google.analytics.data.v1beta.IRunReportRequest = {
        dateRanges: [dateRange],
        metrics: [{ name: definition.metric }],
        dimensions: [{ name: definition.dimension }],
        orderBys: buildOrderBys(definition),
        keepEmptyRows: false,
        limit: String(limit),
      }

      const report = await runReport({ propertyId, client, request })
      const { points, total } = toChartPoints(definition, report.rows)

      return {
        definition,
        points,
        total,
      }
    } catch (error) {
      console.error('[google-analytics] Failed to load custom chart', definition.title, error)
      return null
    }
  })

  const results = await Promise.all(tasks)
  return results.filter((item): item is GoogleAnalyticsChartResult => Boolean(item))
}

export async function getGoogleAnalyticsDashboard(range: AnalyticsRangeKey): Promise<GoogleAnalyticsDashboardData> {
  const settings = await getGoogleAnalyticsSettings()
  const hasCredentials = await hasActiveServiceKey('google_analytics', 'service_account')

  if (!settings.propertyId) {
    return {
      isConfigured: false,
      status: 'missing-config',
      message: 'Add your GA4 property ID to enable Google Analytics data.',
      summaryCards: [],
      charts: [],
      range,
    }
  }

  if (!hasCredentials) {
    return {
      isConfigured: false,
      status: 'missing-credentials',
      message: 'Add a google_analytics/service_account secret under Integrations to connect GA4.',
      summaryCards: [],
      charts: [],
      range,
    }
  }

  const client = await getAnalyticsClient()
  if (!client) {
    return {
      isConfigured: false,
      status: 'missing-credentials',
      message: 'Google Analytics credentials are misconfigured. Verify the service account JSON.',
      summaryCards: [],
      charts: [],
      range,
    }
  }

  try {
    const [summaryCards, charts] = await Promise.all([
      fetchSummaryCards(settings.propertyId, range, client),
      fetchCustomCharts(settings.chartDefinitions, settings.propertyId, range, client),
    ])

    return {
      isConfigured: true,
      status: 'ready',
      summaryCards,
      charts,
      range,
    }
  } catch (error) {
    console.error('[google-analytics] Failed to build dashboard', error)
    return {
      isConfigured: false,
      status: 'error',
      message: 'Failed to load Google Analytics data. Check logs for details.',
      summaryCards: [],
      charts: [],
      range,
    }
  }
}
