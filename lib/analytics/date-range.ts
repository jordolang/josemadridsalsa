export type AnalyticsRangeKey = '7d' | '30d' | '90d' | '365d'

export const RANGE_OPTIONS: Array<{ label: string; value: AnalyticsRangeKey }> = [
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
  { label: '12 months', value: '365d' },
]

const RANGE_DAY_MAP: Record<AnalyticsRangeKey, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '365d': 365,
}

export function getRangeDayCount(range: AnalyticsRangeKey): number {
  return RANGE_DAY_MAP[range]
}

export function getDateRange(range: AnalyticsRangeKey) {
  const end = new Date()
  end.setHours(23, 59, 59, 999)

  const days = getRangeDayCount(range)
  const start = new Date(end)
  start.setDate(end.getDate() - (days - 1))
  start.setHours(0, 0, 0, 0)

  return { start, end, days }
}

export function formatDateForAnalytics(date: Date) {
  return date.toISOString().slice(0, 10)
}
