/**
 * Turning a measured value into text.
 *
 * Money delegates to `formatCents`/`formatRatio` in `lib/analytics/margin.ts` — pure, already used by
 * the margin and tax reports, so a figure reads identically wherever it appears. What is added here
 * is the unit dispatch the studio needs (jars, miles, counts) and one rule those helpers cannot know:
 *
 * **`null` renders as an em dash, never as zero.** A blank cell means the value was not recorded, and
 * a reader must be able to tell that apart from a real zero at a glance.
 */
import { formatCents, formatRatio } from '@/lib/analytics/margin'

import type { MeasureUnit } from './types'

export function formatMeasure(value: number | null, unit: MeasureUnit | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'

  switch (unit) {
    case 'cents':
      return formatCents(Math.round(value))
    case 'ratio':
      return formatRatio(value)
    case 'miles':
      return `${Math.round(value).toLocaleString('en-US')} mi`
    case 'jars':
      return `${Math.round(value).toLocaleString('en-US')} jars`
    case 'count':
    default:
      return Math.round(value).toLocaleString('en-US')
  }
}

/** Compact form for a chart axis, where space is short and precision matters less. */
export function formatAxisValue(value: number, unit: MeasureUnit | undefined): string {
  if (unit === 'cents') {
    const dollars = value / 100
    if (Math.abs(dollars) >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`
    if (Math.abs(dollars) >= 1_000) return `$${Math.round(dollars / 1_000)}k`
    return `$${Math.round(dollars)}`
  }
  if (unit === 'ratio') return `${Math.round(value * 100)}%`
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)}k`
  return String(Math.round(value))
}

/**
 * A plain-number rendering for spreadsheet export.
 *
 * Cents become dollars because a spreadsheet column of `48132047` is unreadable and will be
 * mis-summed by whoever opens it. `null` stays empty rather than becoming `0`, for the same reason it
 * shows as a dash on screen.
 */
export function exportValue(value: number | null, unit: MeasureUnit | undefined): number | string {
  if (value === null || value === undefined || Number.isNaN(value)) return ''
  if (unit === 'cents') return Number((value / 100).toFixed(2))
  if (unit === 'ratio') return Number(value.toFixed(4))
  return Math.round(value)
}
