/**
 * The window of rows a desktop table reads, and how the shell narrows it.
 *
 * A section loads its newest `ROW_LIMIT` rows. Past that, two things take over:
 * "Load more" widens the window, and on the sections that can outgrow any
 * window — customers, orders, the archives — the filter box is sent to the
 * server as `q` so a match outside the window is still found.
 *
 * Shared by the shell, the section route and the CSV export, so all three narrow
 * rows the same way. No server imports: the shell bundles this.
 */

import { z } from 'zod'
import type { Row } from './types'

/** How many rows a section reads before "Load more". */
export const ROW_LIMIT = 250

/** The widest window "Load more" will open. Past this, search or export. */
export const MAX_LIST_LIMIT = 2000

/** The most rows one CSV export will read. */
export const EXPORT_LIMIT = 25000

export interface ListQuery {
  /** Search sent to the database. Empty means none. */
  q: string
  limit: number
}

export const DEFAULT_LIST: ListQuery = { q: '', limit: ROW_LIMIT }

/** Read `?q=` and `?limit=` off a request, clamped to `max`. */
export function parseListQuery(params: URLSearchParams, max = MAX_LIST_LIMIT): ListQuery {
  const q = z.string().trim().max(200).catch('').parse(params.get('q') ?? '')
  const limit = z.coerce.number().int().min(1).max(max).catch(ROW_LIMIT).parse(params.get('limit') ?? ROW_LIMIT)
  return { q, limit }
}

/** The query string for a list window, omitting what is already the default. */
export function listSearch(list: Partial<ListQuery>): string {
  const params = new URLSearchParams()
  if (list.q?.trim()) params.set('q', list.q.trim())
  if (list.limit && list.limit !== ROW_LIMIT) params.set('limit', String(list.limit))
  return params.toString()
}

/**
 * The rows the operator is looking at: the chip filter, then the filter box.
 *
 * When the server already searched for exactly this text, the text filter is
 * skipped — the database matched on fields (an email, an address) the row's
 * `search` string need not carry, and filtering again would hide those hits.
 */
export function filterRows(
  rows: Row[],
  { query, filter, serverQuery = '' }: { query: string; filter: number; serverQuery?: string },
): Row[] {
  const needle = query.trim().toLowerCase()
  const searched = needle !== '' && needle === serverQuery.trim().toLowerCase()
  return rows.filter(
    (row) =>
      (filter === 0 || row.buckets.includes(filter)) &&
      (!needle || searched || row.search.toLowerCase().includes(needle)),
  )
}
