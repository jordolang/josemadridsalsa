/**
 * Minimal client for the Printify REST API (https://developers.printify.com).
 *
 * Merch is printed and shipped by Printify on demand, so the merch catalog is read from the
 * Printify shop rather than stored in our Product table, and paid merch orders are handed to
 * Printify to fulfil. Configure with:
 *
 * - `PRINTIFY_API_TOKEN` (required): a personal access token from Printify, My Profile →
 *   Connections, with products and orders scopes.
 * - `PRINTIFY_SHOP_ID` (optional): which Printify shops to sell from, comma-separated.
 *   Without it every shop on the account is used (for example both an API shop and the
 *   shop connected to Etsy).
 */

const API_BASE = 'https://api.printify.com/v1'
const USER_AGENT = 'JoseMadridSalsa-Storefront'

export class PrintifyError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown
  ) {
    super(message)
    this.name = 'PrintifyError'
  }
}

export function isPrintifyConfigured(): boolean {
  return Boolean(process.env.PRINTIFY_API_TOKEN?.trim())
}

type FetchOptions = {
  method?: 'GET' | 'POST'
  body?: unknown
  /** Seconds to cache a GET in the Next data cache; 0 skips the cache. */
  revalidate?: number
}

async function printifyFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const token = process.env.PRINTIFY_API_TOKEN?.trim()
  if (!token) {
    throw new PrintifyError('Printify is not configured. Set PRINTIFY_API_TOKEN.', 0)
  }

  const method = options.method ?? 'GET'
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': USER_AGENT,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    ...(method === 'GET' && options.revalidate
      ? { next: { revalidate: options.revalidate, tags: ['printify'] } }
      : { cache: 'no-store' as const }),
  })

  const text = await response.text()
  const data = text ? safeJson(text) : null

  if (!response.ok) {
    const detail =
      data && typeof data === 'object' && 'message' in data ? String((data as { message: unknown }).message) : text
    throw new PrintifyError(`Printify ${method} ${path} failed (${response.status}): ${detail}`, response.status, data)
  }

  return data as T
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

// ---------------------------------------------------------------------------
// Types: only the fields the storefront reads.
// ---------------------------------------------------------------------------

export type PrintifyShop = {
  id: number
  title: string
  sales_channel: string
}

export type PrintifyOptionValue = {
  id: number
  title: string
  colors?: string[]
}

export type PrintifyOption = {
  name: string
  type: string
  values: PrintifyOptionValue[]
}

export type PrintifyVariant = {
  id: number
  sku?: string
  /** Retail price in cents. */
  price: number
  /** Printify's production cost in cents. */
  cost?: number
  title: string
  is_enabled: boolean
  is_available: boolean
  is_default?: boolean
  /** Option value ids, in the same order as the product's `options`. */
  options: number[]
}

export type PrintifyImage = {
  src: string
  variant_ids: number[]
  position: string
  is_default: boolean
}

export type PrintifyProduct = {
  id: string
  title: string
  description: string
  tags: string[]
  options: PrintifyOption[]
  variants: PrintifyVariant[]
  images: PrintifyImage[]
  created_at: string
  updated_at: string
  visible: boolean
  is_locked: boolean
  /** Present once the product has been published to a sales channel. */
  external?: { id?: string; handle?: string } | null
  /** The shop the product was read from. */
  shop_id: string
}

type Paginated<T> = {
  current_page: number
  last_page: number
  data: T[]
}

export type PrintifyAddress = {
  first_name: string
  last_name: string
  email?: string
  phone?: string
  country: string
  region: string
  address1: string
  address2?: string
  city: string
  zip: string
}

export type PrintifyOrderRequest = {
  external_id: string
  label?: string
  line_items: { product_id: string; variant_id: number; quantity: number }[]
  /** 1 = standard shipping. */
  shipping_method: number
  send_shipping_notification: boolean
  address_to: PrintifyAddress
}

// ---------------------------------------------------------------------------
// Calls
// ---------------------------------------------------------------------------

export async function listPrintifyShops(): Promise<PrintifyShop[]> {
  return printifyFetch<PrintifyShop[]>('/shops.json', { revalidate: 3600 })
}

/** The shops the storefront sells from: PRINTIFY_SHOP_ID if set, else every shop on the account. */
export async function getPrintifyShopIds(): Promise<string[]> {
  const configured = (process.env.PRINTIFY_SHOP_ID ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
  if (configured.length > 0) return configured

  const shops = await listPrintifyShops()
  if (shops.length === 0) {
    throw new PrintifyError('The Printify account has no shops.', 404)
  }
  return shops.map((shop) => String(shop.id))
}

async function listShopProducts(shopId: string, revalidate: number): Promise<PrintifyProduct[]> {
  const products: PrintifyProduct[] = []
  // Printify caps `limit` at 50. A hard page cap keeps a bad response from looping forever.
  for (let page = 1; page <= 20; page++) {
    const result = await printifyFetch<Paginated<PrintifyProduct>>(
      `/shops/${shopId}/products.json?limit=50&page=${page}`,
      { revalidate }
    )
    products.push(...result.data.map((product) => ({ ...product, shop_id: shopId })))
    if (result.current_page >= result.last_page) break
  }
  return products
}

/** Every product in every shop the storefront sells from, following pagination. */
export async function listPrintifyProducts(revalidate = 300): Promise<PrintifyProduct[]> {
  const shopIds = await getPrintifyShopIds()
  const perShop = await Promise.all(shopIds.map((shopId) => listShopProducts(shopId, revalidate)))
  return perShop.flat()
}

export async function getPrintifyProduct(productId: string, revalidate = 300): Promise<PrintifyProduct | null> {
  if (!/^[a-f0-9]{24}$/i.test(productId)) return null
  for (const shopId of await getPrintifyShopIds()) {
    try {
      const product = await printifyFetch<PrintifyProduct>(`/shops/${shopId}/products/${productId}.json`, {
        revalidate,
      })
      return { ...product, shop_id: shopId }
    } catch (error) {
      if (error instanceof PrintifyError && error.status === 404) continue
      throw error
    }
  }
  return null
}

export async function createPrintifyOrder(shopId: string, order: PrintifyOrderRequest): Promise<{ id: string }> {
  return printifyFetch<{ id: string }>(`/shops/${shopId}/orders.json`, { method: 'POST', body: order })
}
