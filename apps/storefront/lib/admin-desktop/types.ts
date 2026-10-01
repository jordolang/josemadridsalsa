/**
 * The wire format between the desktop shell's data loaders and its renderer.
 *
 * Cells carry meaning ("this is money, right-aligned, and the status is bad"),
 * never CSS. The client turns tone into colour so the palette lives in one
 * stylesheet instead of being baked into every server response.
 */

import type { DesktopSectionId, DesktopViewKind } from './sections'
import type { FormId, FormValues, WriteOpId } from './forms'

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
  /** Stable key for remembering a hand-set width. Falls back to the label. */
  key?: string
  label: string
  /** Grid track for this column, e.g. `104px` or `minmax(0,1.5fr)`. */
  width: string
  right?: boolean
  /** Narrowest the operator may drag this column, in pixels. */
  minWidth?: number
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

/**
 * What a button does.
 *
 * Everything the shell can do to a record is one of these. `form` opens a sheet
 * described by the form registry; `write` is a mutation that needs no form, so
 * a button and (where it matters) a confirmation is the whole interaction;
 * `section` moves the window and `page` moves it to one page inside a
 * section; `open` is the last resort for the handful of pages the shell does
 * not draw itself — a printable document, a file upload, an outside URL.
 *
 * The point of the union is that the desktop window acts in place. A command
 * never leaves the shell unless it says `open`, and the loaders no longer hand
 * out `/admin` links for work the window can do.
 */
export type DesktopCommand =
  | {
      kind: 'form'
      form: FormId
      /** The record being edited. Absent for a create. */
      recordId?: string
      /** What the sheet opens with, supplied by the loader that read the row. */
      values?: FormValues
      /** Overrides the form spec's own title, e.g. to name the record. */
      title?: string
    }
  | {
      kind: 'write'
      op: WriteOpId
      recordId?: string
      values?: FormValues
      /** Shown in a confirmation dialog. Absent means act immediately. */
      confirm?: string
      /** The toast on success. */
      success?: string
      danger?: boolean
    }
  /** The scan sheet: count or receive stock with a barcode scanner. */
  | { kind: 'scan' }
  /**
   * A 4×6 shipping label. The desktop apps send it straight to the label
   * printer chosen in their settings; a browser tab opens it in a new tab.
   */
  | { kind: 'label'; href: string }
  | { kind: 'section'; section: DesktopSectionId }
  | { kind: 'page'; page: string }
  | { kind: 'open'; href: string }

/**
 * A button at the foot of the inspector.
 *
 * A label that ends in `…` says out loud that it opens a sheet rather than
 * acting in place; a bare label acts on the record as soon as it is pressed,
 * after its confirmation if it has one.
 */
export interface InspectorAction {
  label: string
  command: DesktopCommand
  /** Shown right-aligned, and bound while this row is selected. `⌘E`, `F2`, `⌘⏎`. */
  shortcut?: string
  /** Paint the button as destructive. */
  danger?: boolean
}

export interface Inspector {
  title: string
  tag?: string
  tagTone?: Tone
  groups: InspectorGroup[]
  actions?: InspectorAction[]
}

export interface Row {
  id: string
  cells: Cell[]
  inspector: Inspector
  /** What ⏎ does on this row — usually the sheet that edits it. */
  open?: DesktopCommand
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
  todayOrders: { id: string; customer: string; channel: string; total: string; open: DesktopCommand }[]
  lowStock: { name: string; available: string; gap: string; open?: DesktopCommand }[]
  nextEvents: { date: string; name: string; city: string; open?: DesktopCommand }[]
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
  /** Opens the sheet that edits this group, when the shell can edit it. */
  edit?: DesktopCommand
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
  /** The page on screen. Equals `id` when it is the section's own list. */
  page: string
  /** Every page in this section, for the strip under the heading. */
  pages: { id: string; label: string }[]
  kind: DesktopViewKind
  eyebrow: string
  heading: string
  path: string
  /** Filter chips. The first is always the unfiltered view. */
  filters: string[]
  /** Header buttons. Each runs a command in the window. */
  actions: { label: string; icon: string; command: DesktopCommand; primary?: boolean; danger?: boolean }[]
  body: SectionBody
  /** ISO timestamp of when this payload was built, shown in the sidebar footer. */
  loadedAt: string
  /**
   * The window of rows this table read. Absent for views that are not a list.
   * `more` means the window was full, so there may be rows past it.
   */
  list?: { q: string; limit: number; more: boolean; searchable: boolean }
  /** Sidebar counts as of this load, so they stay current as the window is used. */
  badges?: DesktopBadges
}

/** Sidebar counts that are worth a badge — computed once for the whole shell. */
export interface DesktopBadges {
  orders?: number
  inventory?: number
  fundraisers?: number
  /** Open support conversations plus live chats waiting on a reply. */
  messages?: number
}
