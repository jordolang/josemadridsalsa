/**
 * The wire format between the desktop shell's data loaders and its renderer.
 *
 * Cells carry meaning ("this is money, right-aligned, and the status is bad"),
 * never CSS. The client turns tone into colour so the palette lives in one
 * stylesheet instead of being baked into every server response.
 */

import type { DesktopSectionId, DesktopViewKind } from './sections'

/** Semantic colour roles, mapped to CSS variables by the renderer. */
export type Tone = 'good' | 'warn' | 'bad' | 'muted' | 'neutral' | 'accent'

export interface Cell {
  text: string
  /** Right-align — used for every numeric column. */
  right?: boolean
  /** Tabular figures for ids, money and counts. */
  mono?: boolean
  strong?: boolean
  dim?: boolean
  tone?: Tone
  /** Draw a status dot in this cell, coloured by `tone`. */
  dot?: boolean
}

export interface Column {
  label: string
  /** Grid track for this column, e.g. `104px` or `minmax(0,1.5fr)`. */
  width: string
  right?: boolean
}

export interface InspectorField {
  label: string
  value: string
  mono?: boolean
  strong?: boolean
  /** Let long values wrap instead of being clipped to one line. */
  wrap?: boolean
}

export interface InspectorLine {
  name: string
  qty: string
  amount: string
}

export interface InspectorGroup {
  label: string
  fields?: InspectorField[]
  lines?: InspectorLine[]
}

export interface Inspector {
  title: string
  tag?: string
  tagTone?: Tone
  groups: InspectorGroup[]
}

export interface Row {
  id: string
  cells: Cell[]
  inspector: Inspector
  /** The `/admin` page this row opens with ⏎. */
  href?: string
  /** Free text the client matches the filter box and quick-find against. */
  search: string
  /** Index into the section's `filters`, for client-side chip filtering. */
  buckets: number[]
}

export interface TablePayload {
  view: 'table'
  columns: Column[]
  rows: Row[]
  totals: Cell[]
}

export interface StatTile {
  label: string
  value: string
  note: string
  tone?: Tone
}

export interface DashboardPayload {
  view: 'dashboard'
  stats: StatTile[]
  todayOrders: { id: string; customer: string; channel: string; total: string; href: string }[]
  lowStock: { name: string; available: string; gap: string }[]
  nextEvents: { date: string; name: string; city: string }[]
  inspector: Inspector
}

export interface CalendarDay {
  day: string
  inMonth: boolean
  today: boolean
  events: string[]
}

export interface EventsPayload {
  view: 'events'
  monthLabel: string
  monthSummary: string
  days: CalendarDay[]
  rows: Row[]
  columns: Column[]
}

export interface AnalyticsPayload {
  view: 'analytics'
  kpis: StatTile[]
  /** Twelve trailing months, each with this year's and last year's revenue. */
  bars: { label: string; current: number; previous: number; highlight: boolean }[]
  barMax: number
  channels: { name: string; amount: string; pct: string; fraction: number }[]
  topProducts: { name: string; jars: string; revenue: string }[]
  cohorts: { quarter: string; customers: string; returned: string; ltv: string }[]
  inspector: Inspector
}

export interface SettingsGroup {
  label: string
  rows: { label: string; value: string; tone?: Tone; mono?: boolean }[]
}

export interface SettingsPayload {
  view: 'settings'
  groups: SettingsGroup[]
  inspector: Inspector
}

export interface LinkPayload {
  view: 'link'
  /** Why this section hands off, in the shell's own words. */
  note: string
  views: { label: string; path: string }[]
}

export type SectionBody =
  | TablePayload
  | DashboardPayload
  | EventsPayload
  | AnalyticsPayload
  | SettingsPayload
  | LinkPayload

export interface SectionPayload {
  id: DesktopSectionId
  kind: DesktopViewKind
  eyebrow: string
  heading: string
  path: string
  /** Filter chips. The first is always the unfiltered view. */
  filters: string[]
  /** Header buttons. `href` opens the matching web admin page. */
  actions: { label: string; icon: string; href: string; primary?: boolean }[]
  body: SectionBody
  /** ISO timestamp of when this payload was built, shown in the sidebar footer. */
  loadedAt: string
}

/** Sidebar counts that are worth a badge — computed once for the whole shell. */
export interface DesktopBadges {
  orders?: number
  inventory?: number
  fundraisers?: number
}
