import type { AnalyticsRangeKey } from '@/lib/analytics/date-range'

export type GoogleAnalyticsChartType = 'line' | 'bar' | 'pie'

export type GoogleAnalyticsChartColor = 'indigo' | 'emerald' | 'amber' | 'rose'

export type GoogleAnalyticsChartDefinition = {
  id: string
  title: string
  description?: string | null
  metric: string
  dimension: string
  chartType: GoogleAnalyticsChartType
  limit?: number | null
  color?: GoogleAnalyticsChartColor
}

export type GoogleAnalyticsSettings = {
  id: string
  measurementId: string | null
  propertyId: string | null
  dataStreamId: string | null
  chartDefinitions: GoogleAnalyticsChartDefinition[]
  createdAt: Date
  updatedAt: Date
}

export type GoogleAnalyticsSummaryCard = {
  id: string
  label: string
  metric: string
  value: number
  formattedValue: string
  format: 'number' | 'percent' | 'duration' | 'currency'
  description?: string
}

export type GoogleAnalyticsChartPoint = {
  label: string
  value: number
}

export type GoogleAnalyticsChartResult = {
  definition: GoogleAnalyticsChartDefinition
  points: GoogleAnalyticsChartPoint[]
  total: number
}

export type GoogleAnalyticsDashboardData = {
  isConfigured: boolean
  status: 'ready' | 'missing-config' | 'missing-credentials' | 'error'
  message?: string
  summaryCards: GoogleAnalyticsSummaryCard[]
  charts: GoogleAnalyticsChartResult[]
  range: AnalyticsRangeKey
}
