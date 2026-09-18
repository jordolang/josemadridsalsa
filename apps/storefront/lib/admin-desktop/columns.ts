/**
 * Hand-set column widths for the desktop shell's tables.
 *
 * A width the operator drags is a property of their window, not of their
 * account: the same person on a laptop and on the shop's big monitor wants
 * different columns wide. So it lives in `localStorage`, keyed by section and
 * column, and the server keeps sending the same sensible default tracks.
 *
 * A column's declared `width` may be a flexible track (`minmax(0,1.5fr)`), so a
 * stored width is always an absolute pixel number: the moment somebody sizes a
 * column by hand they have said they want it that wide, not that share of what
 * is left.
 */

import type { Column } from './types'

const STORAGE_KEY = 'jms-desktop-columns'

/** Below this a column is a sliver with no readable content in it. */
export const MIN_COLUMN_WIDTH = 48
export const MAX_COLUMN_WIDTH = 900

/** section id → column key → width in pixels. */
export type ColumnWidths = Record<string, Record<string, number>>

export function columnKey(column: Column, index: number): string {
  return column.key ?? column.label ?? `col-${index}`
}

/** The grid track for one column: what was dragged, else what the loader asked for. */
export function trackFor(column: Column, index: number, widths: Record<string, number> | undefined): string {
  const stored = widths?.[columnKey(column, index)]
  return stored ? `${stored}px` : column.width
}

export function gridTemplate(columns: Column[], widths: Record<string, number> | undefined): string {
  return columns.map((column, index) => trackFor(column, index, widths)).join(' ')
}

export function clampWidth(value: number, column?: Column): number {
  const floor = Math.max(MIN_COLUMN_WIDTH, column?.minWidth ?? MIN_COLUMN_WIDTH)
  return Math.round(Math.min(MAX_COLUMN_WIDTH, Math.max(floor, value)))
}

// ---------------------------------------------------------------- storage

/**
 * Reads are defensive on purpose: a private window throws on access, and a
 * hand-edited or half-written entry should cost the operator their column
 * widths, never their admin window.
 */
export function readColumnWidths(): ColumnWidths {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}

    const out: ColumnWidths = {}
    for (const [section, columns] of Object.entries(parsed as Record<string, unknown>)) {
      if (!columns || typeof columns !== 'object') continue
      const clean: Record<string, number> = {}
      for (const [key, value] of Object.entries(columns as Record<string, unknown>)) {
        if (typeof value === 'number' && Number.isFinite(value)) clean[key] = clampWidth(value)
      }
      if (Object.keys(clean).length > 0) out[section] = clean
    }
    return out
  } catch {
    return {}
  }
}

export function writeColumnWidths(widths: ColumnWidths): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(widths))
  } catch {
    // Not being able to remember a width is not a reason to refuse to set one.
  }
}

/** Immutably set one column's width. */
export function withColumnWidth(
  widths: ColumnWidths,
  section: string,
  key: string,
  width: number,
): ColumnWidths {
  return { ...widths, [section]: { ...(widths[section] ?? {}), [key]: clampWidth(width) } }
}

/** Immutably drop one column's width, putting it back on the loader's track. */
export function withoutColumnWidth(widths: ColumnWidths, section: string, key: string): ColumnWidths {
  const forSection = widths[section]
  if (!forSection || !(key in forSection)) return widths

  const next = { ...forSection }
  delete next[key]

  const out = { ...widths }
  if (Object.keys(next).length === 0) delete out[section]
  else out[section] = next
  return out
}

/** Immutably drop every width in one section. */
export function withoutSectionWidths(widths: ColumnWidths, section: string): ColumnWidths {
  if (!widths[section]) return widths
  const out = { ...widths }
  delete out[section]
  return out
}

export function hasCustomWidths(widths: ColumnWidths, section: string): boolean {
  return Object.keys(widths[section] ?? {}).length > 0
}
