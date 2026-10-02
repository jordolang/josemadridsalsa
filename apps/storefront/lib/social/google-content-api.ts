import { createSign } from 'crypto'

/**
 * Google Merchant API (products v1) client for pushing products into Google
 * Merchant Center — the push-style counterpart to the scheduled-fetch feed at
 * /api/feeds/google-shopping. Inserting a product input with the same offerId
 * upserts it, so repeat syncs keep price and inventory current.
 *
 * Replaces the Content API for Shopping v2.1, which Google sunset on
 * 2026-08-18 (requests have failed intermittently with HTTP 410 since
 * 2026-09-01).
 *
 * Authenticates with a service account (add the service account's email as a
 * user in Merchant Center settings). The Merchant API also needs the Google
 * Cloud project registered once with the Merchant Center account
 * (developerRegistration:registerGcp) and an API data source to write into.
 * Configured via server-only env vars:
 *   - GOOGLE_MERCHANT_CENTER_ID
 *   - GOOGLE_MERCHANT_DATA_SOURCE_ID  (numeric ID of an "API" data source)
 *   - GOOGLE_SHOPPING_SERVICE_ACCOUNT_EMAIL
 *   - GOOGLE_SHOPPING_SERVICE_ACCOUNT_PRIVATE_KEY  (PEM, \n-escaped allowed)
 */

const MERCHANT_API_BASE = 'https://merchantapi.googleapis.com/products/v1'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CONTENT_SCOPE = 'https://www.googleapis.com/auth/content'

type GoogleShoppingConfig = {
  merchantId: string
  dataSourceId: string
  serviceAccountEmail: string
  privateKey: string
}

function getGoogleShoppingConfig(): GoogleShoppingConfig | null {
  const merchantId = process.env.GOOGLE_MERCHANT_CENTER_ID
  const dataSourceId = process.env.GOOGLE_MERCHANT_DATA_SOURCE_ID
  const serviceAccountEmail = process.env.GOOGLE_SHOPPING_SERVICE_ACCOUNT_EMAIL
  const privateKey = process.env.GOOGLE_SHOPPING_SERVICE_ACCOUNT_PRIVATE_KEY
  if (!merchantId || !dataSourceId || !serviceAccountEmail || !privateKey) return null
  // Env UIs often store the PEM with literal \n sequences.
  return { merchantId, dataSourceId, serviceAccountEmail, privateKey: privateKey.replace(/\\n/g, '\n') }
}

export function isGoogleShoppingSyncConfigured(): boolean {
  return getGoogleShoppingConfig() !== null
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

/** Mint an access token via the service-account JWT bearer grant. */
async function getServiceAccountToken(config: GoogleShoppingConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(
    JSON.stringify({
      iss: config.serviceAccountEmail,
      scope: CONTENT_SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  )
  const signature = createSign('RSA-SHA256')
    .update(`${header}.${claims}`)
    .sign(config.privateKey, 'base64url')
  const assertion = `${header}.${claims}.${signature}`

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.access_token) {
    throw new Error(data?.error_description || 'Google service-account token exchange failed.')
  }
  return data.access_token as string
}

export type GoogleShoppingProduct = {
  name: string
  description: string | null
  sku: string
  price: number
  compareAtPrice: number | null
  images: string[]
  featuredImage: string | null
  inventory: number
  url: string
  gtin: string | null
  weightOz: number | null
}

export type GoogleShoppingOverrides = {
  title?: string | null
  description?: string | null
  price?: number | null
  availability?: string | null
  category?: string | null
}

const DEFAULT_GOOGLE_CATEGORY =
  'Food, Beverages & Tobacco > Food Items > Condiments & Sauces > Salsa'

/** Merchant API Price: an amount in micros (1 USD = 1,000,000). */
function toPrice(amount: number) {
  return { amountMicros: String(Math.round(amount * 1_000_000)), currencyCode: 'USD' }
}

const AVAILABILITY: Record<string, string> = {
  'in stock': 'IN_STOCK',
  'out of stock': 'OUT_OF_STOCK',
  preorder: 'PREORDER',
  backorder: 'BACKORDER',
  'limited availability': 'LIMITED_AVAILABILITY',
}

/** Accepts feed-style values ("in stock") and Merchant API enums ("IN_STOCK"). */
function toAvailability(value: string): string {
  return AVAILABILITY[value.toLowerCase().replace(/_/g, ' ')] ?? value.toUpperCase()
}

/**
 * Build the Merchant API ProductInput. Pure function so tests cover the
 * mapping; mirrors the field logic of the Google Shopping feed builders.
 */
export function buildGoogleShoppingProduct(
  product: GoogleShoppingProduct,
  overrides: GoogleShoppingOverrides,
): { offerId: string; contentLanguage: string; feedLabel: string; productAttributes: Record<string, unknown> } {
  const title = overrides.title || product.name
  const description = overrides.description || product.description || product.name
  const price = overrides.price ?? product.price
  // compareAtPrice is the original price; the product is on sale when it
  // exceeds the current price. Google wants `price` = regular price and
  // `salePrice` = the discounted price.
  const onSale = product.compareAtPrice !== null && product.compareAtPrice > price
  const imageLink = product.featuredImage || product.images[0] || null
  const additionalImageLinks = product.images
    .filter((url) => url && url !== imageLink)
    .slice(0, 10)

  const attributes: Record<string, unknown> = {
    title,
    description,
    link: product.url,
    imageLink,
    additionalImageLinks,
    availability: toAvailability(
      overrides.availability || (product.inventory > 0 ? 'in stock' : 'out of stock'),
    ),
    condition: 'NEW',
    brand: 'Jose Madrid Salsa',
    googleProductCategory: overrides.category || DEFAULT_GOOGLE_CATEGORY,
    price: toPrice(onSale ? product.compareAtPrice! : price),
  }

  if (onSale) {
    attributes.salePrice = toPrice(price)
  }
  if (product.gtin) {
    attributes.gtins = [product.gtin]
  } else {
    attributes.identifierExists = false
  }
  if (product.weightOz !== null) {
    attributes.shippingWeight = { value: product.weightOz, unit: 'oz' }
  }

  return {
    offerId: product.sku,
    contentLanguage: 'en',
    feedLabel: 'US',
    productAttributes: attributes,
  }
}

export type GoogleShoppingSyncResult = {
  success: boolean
  /** The Merchant API product input name, e.g. accounts/123/productInputs/en~US~SKU. */
  externalId?: string
  externalUrl?: string
  error?: string
}

/** Insert (upsert) the product into Merchant Center. */
export async function upsertGoogleShoppingProduct(
  product: GoogleShoppingProduct,
  overrides: GoogleShoppingOverrides,
): Promise<GoogleShoppingSyncResult> {
  const config = getGoogleShoppingConfig()
  if (!config) {
    return {
      success: false,
      error:
        'Google Shopping sync is not configured. Set GOOGLE_MERCHANT_CENTER_ID, GOOGLE_MERCHANT_DATA_SOURCE_ID and the GOOGLE_SHOPPING_SERVICE_ACCOUNT_* environment variables.',
    }
  }

  if (!product.featuredImage && product.images.length === 0) {
    return { success: false, error: 'Product must have at least one image for Google Shopping.' }
  }

  try {
    const accessToken = await getServiceAccountToken(config)
    const account = `accounts/${config.merchantId}`
    const dataSource = encodeURIComponent(`${account}/dataSources/${config.dataSourceId}`)
    const res = await fetch(`${MERCHANT_API_BASE}/${account}/productInputs:insert?dataSource=${dataSource}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(buildGoogleShoppingProduct(product, overrides)),
    })
    const data = await res.json().catch(() => null)

    if (!res.ok) {
      return {
        success: false,
        error: data?.error?.message || `Google rejected the product (HTTP ${res.status}).`,
      }
    }

    const restId = (data?.name as string) || `accounts/${config.merchantId}/productInputs/en~US~${product.sku}`
    return {
      success: true,
      externalId: restId,
      externalUrl: `https://merchants.google.com/mc/items?a=${config.merchantId}`,
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
