import { getBigCommerceStore, type BigCommerceStoreKey } from './config'

const API_ORIGIN = 'https://api.bigcommerce.com'

/** BigCommerce returns 429 with a reset hint; retry a bounded number of times. */
const MAX_RATE_LIMIT_RETRIES = 2
const MAX_RATE_LIMIT_WAIT_MS = 5000

export class BigCommerceApiError extends Error {
  status: number
  detail: unknown
  constructor(message: string, status: number, detail: unknown) {
    super(message)
    this.name = 'BigCommerceApiError'
    this.status = status
    this.detail = detail
  }
}

export type BigCommerceRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | undefined>
  /**
   * Next.js data-cache settings for reads. Omit both for an uncached request;
   * writes are never cached.
   */
  revalidate?: number
  tags?: string[]
}

type NextFetchInit = RequestInit & { next?: { revalidate?: number; tags?: string[] } }

export function buildBigCommerceUrl(
  storeHash: string,
  path: string,
  query: BigCommerceRequestOptions['query'] = {},
): string {
  const url = new URL(`${API_ORIGIN}/stores/${storeHash}/${path.replace(/^\/+/, '')}`)
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }
  return url.toString()
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Authenticated request against a BigCommerce store's REST API.
 *
 * `path` includes the API version, e.g. `v3/catalog/products` or `v2/orders/100`.
 * A 204 or empty body resolves to `null`.
 */
export async function bigCommerceFetch<T = unknown>(
  storeKey: BigCommerceStoreKey,
  path: string,
  options: BigCommerceRequestOptions = {},
): Promise<T> {
  const store = getBigCommerceStore(storeKey)
  const method = options.method ?? 'GET'
  const url = buildBigCommerceUrl(store.storeHash, path, options.query)

  const init: NextFetchInit = {
    method,
    headers: {
      'X-Auth-Token': store.accessToken,
      Accept: 'application/json',
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  }
  if (method === 'GET' && (options.revalidate !== undefined || options.tags)) {
    init.next = { revalidate: options.revalidate, tags: options.tags }
  } else {
    init.cache = 'no-store'
  }

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, init)

    if (res.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
      const resetMs = Number(res.headers.get('X-Rate-Limit-Time-Reset-Ms'))
      await sleep(Number.isFinite(resetMs) && resetMs > 0 ? Math.min(resetMs, MAX_RATE_LIMIT_WAIT_MS) : 1000)
      continue
    }

    const text = await res.text()
    const data = text ? safeJsonParse(text) : null

    if (!res.ok) {
      const message = extractErrorMessage(data) ?? `BigCommerce API error (${res.status})`
      // Not the app logger: it is silent in production, and these failures
      // are exactly what needs to show up in the Vercel logs.
      console.error('[bigcommerce] request failed', { store: storeKey, method, path, status: res.status, message })
      throw new BigCommerceApiError(message, res.status, data ?? text)
    }

    return data as T
  }
}

type V3Page<T> = {
  data: T[]
  meta?: { pagination?: { current_page: number; total_pages: number } }
}

/**
 * Reads every page of a paginated v3 collection. BigCommerce silently caps
 * `limit` (to 10 when `include=` sub-resources are requested), so this follows
 * `total_pages` rather than trusting the requested page size.
 */
export async function bigCommerceFetchAll<T>(
  storeKey: BigCommerceStoreKey,
  path: string,
  options: Omit<BigCommerceRequestOptions, 'method' | 'body'> = {},
): Promise<T[]> {
  const items: T[] = []
  for (let page = 1; ; page++) {
    const res = await bigCommerceFetch<V3Page<T>>(storeKey, path, {
      ...options,
      query: { limit: 250, ...options.query, page },
    })
    items.push(...(res?.data ?? []))
    const totalPages = res?.meta?.pagination?.total_pages ?? 1
    if (page >= totalPages) return items
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function extractErrorMessage(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  // v3 errors: { status, title, errors: { field: message } }
  const v3 = data as { title?: unknown; errors?: unknown }
  if (typeof v3.title === 'string') {
    const fieldErrors =
      v3.errors && typeof v3.errors === 'object' && !Array.isArray(v3.errors)
        ? Object.values(v3.errors as Record<string, unknown>).filter((v): v is string => typeof v === 'string')
        : []
    return fieldErrors.length ? `${v3.title}: ${fieldErrors.join('; ')}` : v3.title
  }
  // v2 errors: [{ status, message }]
  if (Array.isArray(data)) {
    const first = data[0] as { message?: unknown } | undefined
    if (typeof first?.message === 'string') return first.message
  }
  return null
}
