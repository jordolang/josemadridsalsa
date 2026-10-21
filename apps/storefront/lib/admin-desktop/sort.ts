/**
 * Click-to-sort for the desktop shell's tables.
 *
 * A header click sorts by that column; a second click flips it; a third puts
 * the rows back in the order the loader sent them. The first click goes the
 * way people expect a column to read: numbers, money and dates biggest and
 * newest first, names A to Z.
 *
 * Cells are formatted text (`$1,240.00`, `Oct 21`), so a cell may carry a
 * `sort` key from the loader. Dates always do, because `Oct 21` has no year to
 * sort on. Without one, numeric-looking text sorts as a number and the rest as
 * text. Blank cells (`—`, `Never`) sort last either way.
 *
 * The chosen sort is a property of the window, like a column width, so it is
 * remembered in `localStorage` per page. No server imports: the shell bundles
 * this.
 */

import { columnKey } from './columns'
import type { Cell, Column, Row } from './types'

export type SortDirection = 'asc' | 'desc'

export interface SortState {
  /** The column's key, as `columnKey` gives it. */
  key: string
  direction: SortDirection
}

/** page id → the sort chosen on it. */
export type TableSorts = Record<string, SortState>

type SortValue = number | string | null

/** Text that means "nothing here", which sorts after every real value. */
const BLANK = new Set(['', '—', '-', 'never', 'not exported', 'no expiry', 'no tracking yet'])

/** `$1,240.00`, `-$3.50`, `42%`, `1,204`, `4.5`, `12m`, `30d`, `3 / 10`. */
const NUMERIC = /^-?\$?-?\d[\d,]*(\.\d+)?(%|[a-z]{1,2})?(\s|$)/i

export function sortValue(cell: Cell | undefined): SortValue {
  if (!cell) return null
  if (cell.sort !== undefined) return cell.sort
  const text = cell.text.trim()
  if (BLANK.has(text.toLowerCase())) return null
  if (NUMERIC.test(text)) {
    const negative = text.startsWith('-')
    const value = Number.parseFloat(text.replace(/^-?\$?-?/, '').replace(/,/g, ''))
    if (Number.isFinite(value)) return negative ? -value : value
  }
  return text.toLowerCase()
}

const collator = new Intl.Collator('en-US', {
  numeric: true,
  sensitivity: 'base',
})

/** Numbers before text, and blanks after both, whichever way the column runs. */
function compareValues(a: SortValue, b: SortValue, direction: SortDirection): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1
  const flip = direction === 'asc' ? 1 : -1
  if (typeof a === 'number' && typeof b === 'number') return (a - b) * flip
  if (typeof a === 'number') return -1
  if (typeof b === 'number') return 1
  return collator.compare(a, b) * flip
}

/** The rows in the chosen order. Ties keep the loader's order. */
export function sortRows(rows: Row[], columns: Column[], sort: SortState | undefined): Row[] {
  if (!sort) return rows
  const index = columns.findIndex((column, at) => columnKey(column, at) === sort.key)
  if (index < 0) return rows
  return rows
    .map((row, at) => ({ row, at, value: sortValue(row.cells[index]) }))
    .sort((a, b) => compareValues(a.value, b.value, sort.direction) || a.at - b.at)
    .map(({ row }) => row)
}

/** Which way a column reads on its first click: numbers and dates descending, text ascending. */
export function firstDirection(rows: Row[], index: number): SortDirection {
  const value = rows.map((row) => sortValue(row.cells[index])).find((entry) => entry !== null)
  return typeof value === 'number' ? 'desc' : 'asc'
}

/** The sort after a click on `key`: first way, then flipped, then off. */
export function nextSort(current: SortState | undefined, key: string, first: SortDirection): SortState | undefined {
  if (current?.key !== key) return { key, direction: first }
  if (current.direction === first) return { key, direction: first === 'asc' ? 'desc' : 'asc' }
  return undefined
}

// ---------------------------------------------------------------- storage

const STORAGE_KEY = 'jms-desktop-sorts'

/** Defensive for the same reasons as the column widths: a bad entry costs a sort, never the window. */
export function readTableSorts(): TableSorts {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}

    const out: TableSorts = {}
    for (const [page, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue
      const { key, direction } = value as Record<string, unknown>
      if (typeof key === 'string' && (direction === 'asc' || direction === 'desc')) {
        out[page] = { key, direction }
      }
    }
    return out
  } catch {
    return {}
  }
}

export function writeTableSorts(sorts: TableSorts): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sorts))
  } catch {
    // Not being able to remember a sort is not a reason to refuse one.
  }
}

/** Immutably set, or with `undefined` clear, one page's sort. */
export function withTableSort(sorts: TableSorts, page: string, sort: SortState | undefined): TableSorts {
  if (sort) return { ...sorts, [page]: sort }
  if (!sorts[page]) return sorts
  const out = { ...sorts }
  delete out[page]
  return out
}
