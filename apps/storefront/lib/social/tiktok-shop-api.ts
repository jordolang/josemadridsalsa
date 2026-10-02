import { createHmac } from 'crypto'

/**
 * TikTok Shop Partner API (202309) client for pushing product listings.
 *
 * TikTok Shop is a separate platform from TikTok posting: its API uses a
 * TikTok Shop Partner Center app (app key + secret) and a token issued when
 * the seller authorizes that app, not the TikTok Login Kit token a connected
 * TikTok social account holds. Every call is signed (see {@link signTikTokShopRequest})
 * and shop-scoped calls carry the shop's `shop_cipher`.
 *
 * Configured via server-only env vars (Partner Center → App & Service):
 *   - TIKTOK_SHOP_APP_KEY
 *   - TIKTOK_SHOP_APP_SECRET
 *   - TIKTOK_SHOP_REFRESH_TOKEN   from the seller's authorization of the app;
 *                                 re-authorize when it expires
 */

const API_BASE = 'https://open-api.tiktokglobalshop.com'
const AUTH_BASE = 'https://auth.tiktok-shops.com'

type TikTokShopConfig = {
  appKey: string
  appSecret: string
  refreshToken: string
}

function getTikTokShopConfig(): TikTokShopConfig | null {
  const appKey = process.env.TIKTOK_SHOP_APP_KEY
  const appSecret = process.env.TIKTOK_SHOP_APP_SECRET
  const refreshToken = process.env.TIKTOK_SHOP_REFRESH_TOKEN
  if (!appKey || !appSecret || !refreshToken) return null
  return { appKey, appSecret, refreshToken }
}

export function isTikTokShopSyncConfigured(): boolean {
  return getTikTokShopConfig() !== null
}

/**
 * TikTok Shop request signature: HMAC-SHA256 (keyed with the app secret) over
 * `secret + path + sorted {key}{value} query pairs + body + secret`, lowercase
 * hex. `sign` and `access_token` are never signed; multipart bodies are left out.
 */
export function signTikTokShopRequest(
  path: string,
  query: Record<string, string>,
  body: string,
  appSecret: string,
): string {
  const params = Object.keys(query)
    .filter((key) => key !== 'sign' && key !== 'access_token')
    .sort()
    .map((key) => `${key}${query[key]}`)
    .join('')
  return createHmac('sha256', appSecret)
    .update(`${appSecret}${path}${params}${body}${appSecret}`)
    .digest('hex')
}

type Envelope<T> = { code?: number; message?: string; data?: T }

async function readEnvelope<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => null)) as Envelope<T> | null
  if (!res.ok || !json || json.code !== 0 || json.data === undefined) {
    throw new Error(json?.message || `TikTok Shop API error (HTTP ${res.status})`)
  }
  return json.data
}

async function getAccessToken(config: TikTokShopConfig): Promise<string> {
  const params = new URLSearchParams({
    app_key: config.appKey,
    app_secret: config.appSecret,
    refresh_token: config.refreshToken,
    grant_type: 'refresh_token',
  })
  const res = await fetch(`${AUTH_BASE}/api/v2/token/refresh?${params}`)
  const data = await readEnvelope<{ access_token?: string }>(res).catch((error: Error) => {
    throw new Error(`TikTok Shop token refresh failed: ${error.message}. Re-authorize the shop if the refresh token expired.`)
  })
  if (!data.access_token) throw new Error('TikTok Shop token refresh returned no access token.')
  return data.access_token
}

type Session = { config: TikTokShopConfig; accessToken: string; shopCipher?: string }

async function call<T>(
  session: Session,
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  body?: { json: unknown } | { form: FormData },
): Promise<T> {
  const query: Record<string, string> = {
    app_key: session.config.appKey,
    timestamp: String(Math.floor(Date.now() / 1000)),
  }
  if (session.shopCipher) query.shop_cipher = session.shopCipher

  const json = body && 'json' in body ? JSON.stringify(body.json) : ''
  query.sign = signTikTokShopRequest(path, query, json, session.config.appSecret)

  const headers: Record<string, string> = { 'x-tts-access-token': session.accessToken }
  if (json) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${API_BASE}${path}?${new URLSearchParams(query)}`, {
    method,
    headers,
    body: body ? ('json' in body ? json : body.form) : undefined,
  })
  return readEnvelope<T>(res)
}

export type TikTokShopProduct = {
  name: string
  description: string | null
  sku: string
  price: number
  images: string[]
  featuredImage: string | null
  inventory: number
  /** Ounces, as stored on Product.weight. */
  weightOz: number | null
}

export type TikTokShopOverrides = {
  title?: string | null
  description?: string | null
  price?: number | null
  category?: string | null
}

const DEFAULT_CATEGORY_ID = '601501' // Food > Condiments

/** Build the 202309 product body. Pure so tests cover the mapping. */
export function buildTikTokShopProduct(
  product: TikTokShopProduct,
  overrides: TikTokShopOverrides,
  imageUris: string[],
  warehouseId: string,
): Record<string, unknown> {
  const price = overrides.price ?? product.price
  return {
    title: overrides.title || product.name,
    description: overrides.description || product.description || product.name,
    category_id: overrides.category || DEFAULT_CATEGORY_ID,
    main_images: imageUris.map((uri) => ({ uri })),
    skus: [
      {
        seller_sku: product.sku,
        price: { amount: price.toFixed(2), currency: 'USD' },
        inventory: [{ warehouse_id: warehouseId, quantity: Math.max(0, product.inventory) }],
      },
    ],
    package_weight: {
      value: ((product.weightOz ?? 16) / 16).toFixed(2),
      unit: 'POUND',
    },
    is_cod_allowed: false,
  }
}

export type TikTokShopSyncResult = {
  success: boolean
  externalId?: string
  externalUrl?: string
  error?: string
}

/**
 * Create or update the product in the seller's TikTok Shop. `shopId` picks the
 * shop when the app is authorized for more than one; otherwise the first is used.
 */
export async function putTikTokShopProduct(
  product: TikTokShopProduct,
  overrides: TikTokShopOverrides,
  shopId: string | null,
  existingProductId: string | null,
): Promise<TikTokShopSyncResult> {
  const config = getTikTokShopConfig()
  if (!config) {
    return {
      success: false,
      error: 'TikTok Shop sync is not configured. Set the TIKTOK_SHOP_APP_KEY, TIKTOK_SHOP_APP_SECRET and TIKTOK_SHOP_REFRESH_TOKEN environment variables.',
    }
  }

  const imageUrls = [product.featuredImage, ...product.images]
    .filter((url, i, all): url is string => Boolean(url) && all.indexOf(url) === i)
    .slice(0, 9)
  if (imageUrls.length === 0) {
    return { success: false, error: 'Product must have at least one image for TikTok Shop.' }
  }

  try {
    const session: Session = { config, accessToken: await getAccessToken(config) }

    const { shops = [] } = await call<{ shops?: Array<{ id: string; cipher: string }> }>(
      session, 'GET', '/authorization/202309/shops',
    )
    const shop = shopId?.trim() ? shops.find((s) => s.id === shopId.trim()) : shops[0]
    if (!shop) {
      return {
        success: false,
        error: shopId ? `TikTok Shop ${shopId} is not authorized for this app.` : 'No TikTok Shop has authorized this app.',
      }
    }

    // Image upload refuses shop_cipher, so it runs before the cipher is set.
    const imageUris: string[] = []
    for (const url of imageUrls) {
      const imageRes = await fetch(url)
      if (!imageRes.ok) throw new Error(`Could not download product image (HTTP ${imageRes.status}): ${url}`)
      const form = new FormData()
      form.append('data', await imageRes.blob())
      form.append('use_case', 'MAIN_IMAGE')
      const { uri } = await call<{ uri: string }>(session, 'POST', '/product/202309/images/upload', { form })
      imageUris.push(uri)
    }

    session.shopCipher = shop.cipher
    const { warehouses = [] } = await call<{
      warehouses?: Array<{ id: string; is_default?: boolean; type?: string }>
    }>(session, 'GET', '/logistics/202309/warehouses')
    const sales = warehouses.filter((w) => w.type === 'SALES_WAREHOUSE')
    const warehouse = sales.find((w) => w.is_default) ?? sales[0] ?? warehouses[0]
    if (!warehouse) return { success: false, error: 'The TikTok Shop has no warehouse to stock from.' }

    const payload = buildTikTokShopProduct(product, overrides, imageUris, warehouse.id)
    const data = existingProductId
      ? await call<{ product_id?: string }>(session, 'PUT', `/product/202309/products/${existingProductId}`, { json: payload })
      : await call<{ product_id?: string }>(session, 'POST', '/product/202309/products', { json: payload })
    const productId = existingProductId || data.product_id
    if (!productId) return { success: false, error: 'TikTok Shop did not return a product ID.' }

    return { success: true, externalId: productId, externalUrl: `https://shop.tiktok.com/view/product/${productId}` }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
