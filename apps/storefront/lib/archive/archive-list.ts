/**
 * Query helpers for the admin archive browser.
 *
 * The four archive models are read-only indexes of the `Documents/` business
 * archive, so the admin views need only paging, sorting and filtering — shared
 * here so each page stays a thin server component.
 */

export const PAGE_SIZES = [25, 50, 100, 250] as const
export const DEFAULT_PAGE_SIZE = 50

/** Clamp a `?page=` value to a positive integer. */
export function resolvePage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : 1
}

/** Clamp a `?pageSize=` value to one of the offered sizes. */
export function resolvePageSize(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? '', 10)
  return (PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE
}

/** `asc` unless `desc` was explicitly asked for. */
export function resolveSortDirection(raw: string | undefined): 'asc' | 'desc' {
  return raw === 'desc' ? 'desc' : 'asc'
}

/**
 * Restrict a `?sortBy=` value to an allow-list. Anything unrecognized falls
 * back, so a hand-edited URL can never reach Prisma with an arbitrary column.
 */
export function resolveSortColumn<T extends string>(
  raw: string | undefined,
  allowed: readonly T[],
  fallback: T
): T {
  return (allowed as readonly string[]).includes(raw ?? '') ? (raw as T) : fallback
}

/** Total pages for a row count, never less than 1. */
export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize))
}

/** Build a querystring preserving current filters while changing some keys. */
export function buildQuery(
  current: Record<string, string | undefined>,
  changes: Record<string, string | number | undefined>
): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries({ ...current, ...changes })) {
    if (v === undefined || v === null || v === '') continue
    params.set(k, String(v))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/** Human-readable byte size for the document list. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`
}

/**
 * Case-insensitive contains filter across several columns, or undefined when
 * there is nothing to search for.
 */
export function buildSearchFilter(
  search: string | undefined,
  fields: readonly string[]
): { OR: Array<Record<string, unknown>> } | undefined {
  const term = search?.trim()
  if (!term) return undefined
  return {
    OR: fields.map((field) => ({
      [field]: { contains: term, mode: 'insensitive' },
    })),
  }
}
