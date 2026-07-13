/**
 * Amazon Selling Partner API client for pushing product listings.
 *
 * Uses the Listings Items API (PUT listings item) so each ShopListing sync
 * creates or updates the seller's offer directly — the push-style counterpart
 * to the Facebook Catalog Batch / TikTok Product API syncs in shops.ts.
 *
 * Configured via server-only env vars (from an SP-API self-authorized app in
 * Seller Central → Apps & Services → Develop Apps):
 *   - AMAZON_SP_API_CLIENT_ID        LWA client id
 *   - AMAZON_SP_API_CLIENT_SECRET    LWA client secret
 *   - AMAZON_SP_API_REFRESH_TOKEN    LWA refresh token for the seller
 *   - AMAZON_SP_API_SELLER_ID        the seller (merchant) id
 *   - AMAZON_SP_API_MARKETPLACE_ID   optional, defaults to ATVPDKIKX0DER (US)
 *   - AMAZON_SP_API_ENDPOINT         optional, defaults to the NA endpoint
 *
 * Since Oct 2023 SP-API calls need only the LWA access token — no AWS SigV4.
 */

const DEFAULT_MARKETPLACE_ID = 'ATVPDKIKX0DER' // amazon.com (US)
const DEFAULT_ENDPOINT = 'https://sellingpartnerapi-na.amazon.com'
const LWA_TOKEN_URL = 'https://api.amazon.com/auth/o2/token'

type AmazonConfig = {
  clientId: string
  clientSecret: string
  refreshToken: string
  sellerId: string
  marketplaceId: string
  endpoint: string
}

function getAmazonConfig(): AmazonConfig | null {
  const clientId = process.env.AMAZON_SP_API_CLIENT_ID
  const clientSecret = process.env.AMAZON_SP_API_CLIENT_SECRET
  const refreshToken = process.env.AMAZON_SP_API_REFRESH_TOKEN
  const sellerId = process.env.AMAZON_SP_API_SELLER_ID
  if (!clientId || !clientSecret || !refreshToken || !sellerId) return null
  return {
    clientId,
    clientSecret,
    refreshToken,
    sellerId,
    marketplaceId: process.env.AMAZON_SP_API_MARKETPLACE_ID || DEFAULT_MARKETPLACE_ID,
    endpoint: process.env.AMAZON_SP_API_ENDPOINT || DEFAULT_ENDPOINT,
  }
}

export function isAmazonSyncConfigured(): boolean {
  return getAmazonConfig() !== null
}

/** Exchange the long-lived LWA refresh token for a short-lived access token. */
async function getLwaAccessToken(config: AmazonConfig): Promise<string> {
  const res = await fetch(LWA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: config.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.access_token) {
    throw new Error(data?.error_description || 'Amazon LWA token exchange failed.')
  }
  return data.access_token as string
}

export type AmazonListingProduct = {
  name: string
  description: string | null
  sku: string
  price: number
  images: string[]
  featuredImage: string | null
  inventory: number
  /** UPC from the product barcode, when known. */
  gtin: string | null
  /** Weight in ounces, when known. */
  weightOz: number | null
}

export type AmazonListingOverrides = {
  title?: string | null
  description?: string | null
  price?: number | null
  /** Amazon product type, defaults to CONDIMENT (salsa lives there). */
  category?: string | null
}

export const DEFAULT_AMAZON_PRODUCT_TYPE = 'CONDIMENT'

/**
 * Build the Listings Items API attributes payload. Amazon matches the listing
 * to an existing ASIN via the UPC; without one it can only update a SKU the
 * seller account already carries. Pure function so tests cover the mapping.
 */
export function buildAmazonListingPayload(
  product: AmazonListingProduct,
  overrides: AmazonListingOverrides,
  marketplaceId: string,
): { productType: string; requirements: string; attributes: Record<string, unknown> } {
  const title = overrides.title || product.name
  const description = overrides.description || product.description || product.name
  const price = overrides.price ?? product.price
  const mainImage = product.featuredImage || product.images[0] || null
  const otherImages = product.images
    .filter((url) => url && url !== mainImage)
    .slice(0, 8)

  const marketplace = { marketplace_id: marketplaceId }

  const attributes: Record<string, unknown> = {
    condition_type: [{ value: 'new_new', ...marketplace }],
    item_name: [{ value: title, language_tag: 'en_US', ...marketplace }],
    brand: [{ value: 'Jose Madrid Salsa', language_tag: 'en_US', ...marketplace }],
    product_description: [{ value: description, language_tag: 'en_US', ...marketplace }],
    purchasable_offer: [
      {
        currency: 'USD',
        our_price: [{ schedule: [{ value_with_tax: Number(price.toFixed(2)) }] }],
        ...marketplace,
      },
    ],
    fulfillment_availability: [
      {
        fulfillment_channel_code: 'DEFAULT',
        quantity: Math.max(product.inventory, 0),
      },
    ],
  }

  if (product.gtin) {
    attributes.externally_assigned_product_identifier = [
      { type: 'upc', value: product.gtin, ...marketplace },
    ]
  }
  if (mainImage) {
    attributes.main_product_image_locator = [{ media_location: mainImage, ...marketplace }]
    if (otherImages.length > 0) {
      attributes.other_product_image_locator_1 = [
        { media_location: otherImages[0], ...marketplace },
      ]
    }
  }
  if (product.weightOz !== null) {
    attributes.item_package_weight = [
      { value: product.weightOz, unit: 'ounces', ...marketplace },
    ]
  }

  return {
    productType: overrides.category || DEFAULT_AMAZON_PRODUCT_TYPE,
    requirements: 'LISTING',
    attributes,
  }
}

export type AmazonSyncResult = {
  success: boolean
  /** The ASIN, when Amazon reports one for the SKU. */
  externalId?: string
  externalUrl?: string
  error?: string
}

/**
 * Create or update the seller's listing for a SKU via PUT listings item, then
 * best-effort fetch the resulting ASIN so the admin UI can deep-link to it.
 */
export async function putAmazonListing(
  product: AmazonListingProduct,
  overrides: AmazonListingOverrides,
): Promise<AmazonSyncResult> {
  const config = getAmazonConfig()
  if (!config) {
    return {
      success: false,
      error:
        'Amazon sync is not configured. Set the AMAZON_SP_API_* environment variables (client ID/secret, refresh token, seller ID).',
    }
  }

  try {
    const accessToken = await getLwaAccessToken(config)
    const payload = buildAmazonListingPayload(product, overrides, config.marketplaceId)
    const itemUrl = `${config.endpoint}/listings/2021-08-01/items/${config.sellerId}/${encodeURIComponent(product.sku)}?marketplaceIds=${config.marketplaceId}`

    const res = await fetch(itemUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-amz-access-token': accessToken,
      },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => null)

    if (!res.ok || data?.status === 'INVALID') {
      const issue = data?.issues?.find(
        (i: { severity?: string }) => i.severity === 'ERROR',
      ) ?? data?.errors?.[0]
      return {
        success: false,
        error: issue?.message || `Amazon rejected the listing (HTTP ${res.status}).`,
      }
    }

    // The PUT response has no ASIN; fetch the item summary to link to it.
    let asin: string | undefined
    try {
      const getRes = await fetch(`${itemUrl}&includedData=summaries`, {
        headers: { 'x-amz-access-token': accessToken },
      })
      const item = await getRes.json().catch(() => null)
      asin = item?.summaries?.[0]?.asin
    } catch {
      // Listing was accepted; the ASIN link is a nice-to-have.
    }

    return {
      success: true,
      externalId: asin,
      externalUrl: asin ? `https://www.amazon.com/dp/${asin}` : undefined,
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
