import { GOOGLE_ANALYTICS_CHART_COLORS } from '@/lib/google-analytics-config'

/**
 * Type representing a chart color configuration with styling classes
 * for bar charts, line strokes, and fill areas.
 */
export type ChartColorConfig = (typeof GOOGLE_ANALYTICS_CHART_COLORS)[number]

/**
 * Map of color values to their full configuration objects.
 * Enables quick lookup of chart color settings by key.
 */
export const CHART_COLOR_MAP = GOOGLE_ANALYTICS_CHART_COLORS.reduce<
  Record<string, ChartColorConfig>
>((acc, color) => {
  acc[color.value] = color
  return acc
}, {})

/**
 * Converts a Date object to an ISO date key string (YYYY-MM-DD).
 *
 * Used for bucketing analytics data by day and creating consistent
 * date keys across the application.
 *
 * @param date - The date to convert
 * @returns ISO date string in format YYYY-MM-DD
 */
export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Formats a Date object as a short, readable label for chart axes.
 *
 * Returns format like "Jan 15" using US locale conventions.
 *
 * @param date - The date to format
 * @returns Formatted date string (e.g., "Jan 15")
 */
export function formatDateLabel(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Formats a numeric value as a percentage string with one decimal place.
 *
 * @param value - The numeric value to format (e.g., 45.67)
 * @returns Percentage string with one decimal (e.g., "45.7%")
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

/**
 * Calculates the CSS width percentage for a bar chart element.
 *
 * Ensures bars are visible (minimum 6% for non-zero values) and never
 * exceed 100%. Returns "0%" for truly zero values.
 *
 * @param value - The numeric value to represent
 * @param max - The maximum value in the dataset
 * @returns CSS width string (e.g., "75%")
 */
export function getBarWidth(value: number, max: number): string {
  if (max === 0) return '0%'
  const percent = (value / max) * 100
  const clamped = Math.max(Math.min(percent, 100), value > 0 ? 6 : 0)
  return `${clamped}%`
}

/**
 * Retrieves the chart color configuration for a given key.
 *
 * Falls back to indigo color if the key is not found or undefined.
 * Used to consistently style Google Analytics charts.
 *
 * @param key - Optional color key (e.g., "indigo", "emerald", "amber", "rose")
 * @returns Complete color configuration with barClass, lineStroke, and lineFill
 */
export function getChartColorConfig(key?: string): ChartColorConfig {
  if (key && CHART_COLOR_MAP[key]) {
    return CHART_COLOR_MAP[key]
  }
  return CHART_COLOR_MAP.indigo ?? GOOGLE_ANALYTICS_CHART_COLORS[0]
}
