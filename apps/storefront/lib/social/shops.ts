import type { ShopPlatform, SocialMediaPlatform } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  getAccountAccessToken,
  getAccountRefreshToken,
  getExpectedAccountPlatformForShop,
  getSocialBaseUrl,
} from './platforms'

type SyncResult = {
  success: boolean
  externalId?: string
  externalUrl?: string
  error?: string
}

type CreateCatalogResult =
  | { success: true; catalogId: string }
  | { success: false; error: string }

type ShopExportConfiguration = {
  shopPlatform: ShopPlatform
  socialAccountId: string | null
  socialAccountPlatform?: SocialMediaPlatform | null
  catalogId?: string | null
}

export function validateShopExportConfiguration(
  config: ShopExportConfiguration,
): { valid: true } | { valid: false; error: string } {
  if (!config.socialAccountId) {
    return { valid: false, error: 'Choose the connected account that should own this export.' }
  }

  const expectedPlatform = getExpectedAccountPlatformForShop(config.shopPlatform)
  if (config.socialAccountPlatform && config.socialAccountPlatform !== expectedPlatform) {
    return {
      valid: false,
      error: `Selected account must be a ${expectedPlatform === 'FACEBOOK' ? 'Facebook Page' : 'TikTok account'}.`,
    }
  }

  if (
    (config.shopPlatform === 'FACEBOOK_SHOP' || config.shopPlatform === 'TIKTOK_SHOP') &&
    !config.catalogId?.trim()
  ) {
    return {
      valid: false,
      error:
        config.shopPlatform === 'FACEBOOK_SHOP'
          ? 'Facebook Shop exports require a catalog ID.'
          : 'TikTok Shop exports require a TikTok Shop ID.',
    }
  }

  return { valid: true }
}

export async function createFacebookCatalog(params: {
  socialAccountId: string
  businessId: string
  name: string
}): Promise<CreateCatalogResult> {
  const account = await prisma.socialAccount.findUnique({
    where: { id: params.socialAccountId },
    select: { id: true, platform: true, isActive: true },
  })

  if (!account || !account.isActive || account.platform !== 'FACEBOOK') {
    return { success: false, error: 'Select an active Facebook Page first.' }
  }

  const managerToken = await getAccountRefreshToken(account.id)
  if (!managerToken) {
    return {
      success: false,
      error:
        'A Facebook user token is not available for this Page. Reconnect Facebook to enable catalog creation.',
    }
  }

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${params.businessId}/owned_product_catalogs`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        name: params.name,
        vertical: 'commerce',
        access_token: managerToken,
      }),
    },
  )

  const payload = await response.json()
  if (payload.error) {
    return { success: false, error: payload.error.message || 'Facebook catalog creation failed.' }
  }

  if (!payload.id) {
    return { success: false, error: 'Facebook did not return a catalog ID.' }
  }

  return { success: true, catalogId: payload.id as string }
}

/**
 * Get the Facebook Page access token from the connected FACEBOOK social account
 */
async function getFacebookPageToken(accountId: string): Promise<{ token: string; pageId: string } | null> {
  const account = await prisma.socialAccount.findFirst({
    where: { id: accountId, platform: 'FACEBOOK', isActive: true },
  })
  if (!account) return null
  const token = await getAccountAccessToken(account.id)
  if (!token) return null
  return { token, pageId: account.accountId }
}

/**
 * Get the TikTok access token from the connected TIKTOK social account
 */
async function getTikTokToken(accountId: string): Promise<string | null> {
  const account = await prisma.socialAccount.findFirst({
    where: { id: accountId, platform: 'TIKTOK', isActive: true },
  })
  if (!account) return null
  return getAccountAccessToken(account.id)
}

/**
 * Sync a product to Facebook Commerce (Shop / Marketplace) via Catalog Batch API
 */
async function syncToFacebookCatalog(
  listing: {
    catalogId: string
    product: {
      name: string
      description: string | null
      sku: string
      price: number
      compareAtPrice: number | null
      images: string[]
      featuredImage: string | null
      inventory: number
      url: string
    }
    overrides: {
      title?: string | null
      description?: string | null
      price?: number | null
      condition?: string | null
      availability?: string | null
      category?: string | null
    }
  },
  accessToken: string,
  existingExternalId?: string | null,
): Promise<SyncResult> {
  try {
    const title = listing.overrides.title || listing.product.name
    const description = listing.overrides.description || listing.product.description || listing.product.name
    const price = listing.overrides.price ?? listing.product.price
    const condition = listing.overrides.condition || 'new'
    const availability = listing.overrides.availability || (listing.product.inventory > 0 ? 'in stock' : 'out of stock')
    const imageUrl = listing.product.featuredImage || listing.product.images[0]

    if (!imageUrl) {
      return { success: false, error: 'Product must have at least one image for Facebook catalog.' }
    }

    // Use the Catalog Batch API to create or update the product
    const method = existingExternalId ? 'UPDATE' : 'CREATE'
    const requestData: Record<string, unknown> = {
      method,
      retailer_id: listing.product.sku,
      data: {
        name: title,
        description,
        availability,
        condition,
        price: `${(price * 100).toFixed(0)} USD`,
        sale_price: listing.product.compareAtPrice
          ? `${(price * 100).toFixed(0)} USD`
          : undefined,
        url: listing.product.url,
        image_url: imageUrl,
        additional_image_urls: listing.product.images.slice(1, 10),
        brand: 'Jose Madrid Salsa',
        inventory: listing.product.inventory,
        category: listing.overrides.category || 'Food & Beverages > Condiments & Sauces > Salsas',
      },
    }

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${listing.catalogId}/items_batch`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: accessToken,
          requests: [requestData],
        }),
      },
    )
    const data = await res.json()

    if (data.error) {
      return { success: false, error: data.error.message }
    }

    // Check for per-item errors
    const handles = data.handles || []
    if (data.validation_status) {
      const errors = data.validation_status.filter((v: { errors?: unknown[] }) => v.errors?.length)
      if (errors.length > 0) {
        return {
          success: false,
          error: JSON.stringify(errors[0].errors),
        }
      }
    }

    return {
      success: true,
      externalId: existingExternalId || listing.product.sku,
      externalUrl: `https://www.facebook.com/commerce/products/${listing.product.sku}`,
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Create a Facebook Marketplace listing via the Marketplace API
 */
async function syncToFacebookMarketplace(
  listing: {
    product: {
      name: string
      description: string | null
      sku: string
      price: number
      images: string[]
      featuredImage: string | null
      inventory: number
    }
    overrides: {
      title?: string | null
      description?: string | null
      price?: number | null
      condition?: string | null
      availability?: string | null
      category?: string | null
    }
  },
  accessToken: string,
  pageId: string,
  existingExternalId?: string | null,
): Promise<SyncResult> {
  try {
    const title = listing.overrides.title || listing.product.name
    const description = listing.overrides.description || listing.product.description || listing.product.name
    const price = listing.overrides.price ?? listing.product.price
    const condition = listing.overrides.condition || 'new'
    const imageUrl = listing.product.featuredImage || listing.product.images[0]

    if (!imageUrl) {
      return { success: false, error: 'Product must have at least one image for Marketplace.' }
    }

    // Create a marketplace listing via Page commerce
    const listingData = {
      name: title,
      description,
      price: price.toFixed(2),
      currency: 'USD',
      condition,
      availability: listing.product.inventory > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
      images: listing.product.images.slice(0, 10).map((url) => ({ url })),
      category: listing.overrides.category || 'FOOD_BEVERAGES',
      access_token: accessToken,
    }

    if (existingExternalId) {
      // Update existing listing
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${existingExternalId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(listingData),
        },
      )
      const data = await res.json()
      if (data.error) {
        return { success: false, error: data.error.message }
      }
      return {
        success: true,
        externalId: existingExternalId,
        externalUrl: `https://www.facebook.com/marketplace/item/${existingExternalId}`,
      }
    }

    // Create new listing
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}/commerce_listings`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(listingData),
      },
    )
    const data = await res.json()

    if (data.error) {
      return { success: false, error: data.error.message }
    }

    return {
      success: true,
      externalId: data.id,
      externalUrl: `https://www.facebook.com/marketplace/item/${data.id}`,
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Sync a product to TikTok Shop via the Product API
 */
async function syncToTikTokShop(
  listing: {
    shopId: string
    product: {
      name: string
      description: string | null
      sku: string
      price: number
      compareAtPrice: number | null
      images: string[]
      featuredImage: string | null
      inventory: number
      weight: number | null
    }
    overrides: {
      title?: string | null
      description?: string | null
      price?: number | null
      category?: string | null
    }
  },
  accessToken: string,
  existingExternalId?: string | null,
): Promise<SyncResult> {
  try {
    const title = listing.overrides.title || listing.product.name
    const description = listing.overrides.description || listing.product.description || listing.product.name
    const price = listing.overrides.price ?? listing.product.price
    const mainImage = listing.product.featuredImage || listing.product.images[0]

    if (!mainImage) {
      return { success: false, error: 'Product must have at least one image for TikTok Shop.' }
    }

    const productPayload = {
      product_name: title,
      description,
      category_id: listing.overrides.category || '601501', // Food > Condiments
      brand: { name: 'Jose Madrid Salsa' },
      main_images: listing.product.images.slice(0, 9).map((url) => ({
        uri: url,
      })),
      skus: [
        {
          seller_sku: listing.product.sku,
          original_price: {
            amount: (price * 100).toFixed(0),
            currency: 'USD',
          },
          inventory: [
            {
              quantity: listing.product.inventory,
              warehouse_id: listing.shopId,
            },
          ],
        },
      ],
      package_weight: {
        value: listing.product.weight?.toString() || '1',
        unit: 'POUND',
      },
      is_cod_allowed: false,
    }

    const baseUrl = `https://open-api.tiktokglobalshop.com`

    if (existingExternalId) {
      // Update existing product
      const res = await fetch(`${baseUrl}/product/202309/products/${existingExternalId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'x-tts-access-token': accessToken,
        },
        body: JSON.stringify(productPayload),
      })
      const data = await res.json()

      if (data.code !== 0 && data.code !== undefined) {
        return { success: false, error: data.message || 'TikTok Shop API error' }
      }

      return {
        success: true,
        externalId: existingExternalId,
        externalUrl: `https://shop.tiktok.com/product/${existingExternalId}`,
      }
    }

    // Create new product
    const res = await fetch(`${baseUrl}/product/202309/products`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-tts-access-token': accessToken,
      },
      body: JSON.stringify(productPayload),
    })
    const data = await res.json()

    if (data.code !== 0 && data.code !== undefined) {
      return { success: false, error: data.message || 'TikTok Shop API error' }
    }

    const productId = data.data?.product_id

    return {
      success: true,
      externalId: productId,
      externalUrl: productId ? `https://shop.tiktok.com/product/${productId}` : undefined,
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Sync a single shop listing to its platform
 */
export async function syncShopListing(listingId: string): Promise<SyncResult> {
  const listing = await prisma.shopListing.findUnique({
    where: { id: listingId },
    include: {
      socialAccount: {
        select: {
          id: true,
          platform: true,
        },
      },
      product: {
        include: { category: true },
      },
    },
  })

  if (!listing) return { success: false, error: 'Listing not found' }

  // Mark as syncing
  await prisma.shopListing.update({
    where: { id: listingId },
    data: { status: 'SYNCING', syncError: null },
  })

  const configValidation = validateShopExportConfiguration({
    shopPlatform: listing.shopPlatform,
    socialAccountId: listing.socialAccountId,
    socialAccountPlatform: listing.socialAccount?.platform as 'FACEBOOK' | 'TIKTOK' | null,
    catalogId: listing.catalogId,
  })

  if (!configValidation.valid) {
    await prisma.shopListing.update({
      where: { id: listingId },
      data: { status: 'ERROR', syncError: configValidation.error },
    })
    return { success: false, error: configValidation.error }
  }

  const baseUrl = getSocialBaseUrl()
  const productUrl = `${baseUrl}/products/${listing.product.slug}`

  const productData = {
    name: listing.product.name,
    description: listing.product.description,
    sku: listing.product.sku,
    price: Number(listing.product.price),
    compareAtPrice: listing.product.compareAtPrice ? Number(listing.product.compareAtPrice) : null,
    images: listing.product.images,
    featuredImage: listing.product.featuredImage,
    inventory: listing.product.inventory,
    url: productUrl,
    weight: listing.product.weight ? Number(listing.product.weight) : null,
  }

  const overrides = {
    title: listing.titleOverride,
    description: listing.descriptionOverride,
    price: listing.priceOverride ? Number(listing.priceOverride) : null,
    condition: listing.condition,
    availability: listing.availability,
    category: listing.marketplaceCategory,
  }

  let result: SyncResult

  switch (listing.shopPlatform) {
    case 'FACEBOOK_SHOP': {
      const fb = await getFacebookPageToken(listing.socialAccountId!)
      if (!fb) {
        result = {
          success: false,
          error: 'The selected Facebook Page is unavailable. Reconnect it before exporting.',
        }
        break
      }
      result = await syncToFacebookCatalog(
        { catalogId: listing.catalogId!, product: productData, overrides },
        fb.token,
        listing.externalId,
      )
      break
    }
    case 'FACEBOOK_MARKETPLACE': {
      const fb = await getFacebookPageToken(listing.socialAccountId!)
      if (!fb) {
        result = {
          success: false,
          error: 'The selected Facebook Page is unavailable. Reconnect it before exporting.',
        }
        break
      }
      result = await syncToFacebookMarketplace(
        { product: productData, overrides },
        fb.token,
        fb.pageId,
        listing.externalId,
      )
      break
    }
    case 'TIKTOK_SHOP': {
      const token = await getTikTokToken(listing.socialAccountId!)
      if (!token) {
        result = {
          success: false,
          error: 'The selected TikTok account is unavailable. Reconnect it before exporting.',
        }
        break
      }
      result = await syncToTikTokShop(
        { shopId: listing.catalogId!, product: productData, overrides },
        token,
        listing.externalId,
      )
      break
    }
    default:
      result = { success: false, error: `Unsupported shop platform: ${listing.shopPlatform}` }
  }

  // Update listing status
  await prisma.shopListing.update({
    where: { id: listingId },
    data: {
      status: result.success ? 'ACTIVE' : 'ERROR',
      syncError: result.error ?? null,
      externalId: result.externalId ?? listing.externalId,
      externalUrl: result.externalUrl ?? listing.externalUrl,
      lastSyncedAt: result.success ? new Date() : listing.lastSyncedAt,
      publishedAt: result.success && !listing.publishedAt ? new Date() : listing.publishedAt,
    },
  })

  return result
}

/**
 * Bulk sync all active products to a shop platform
 */
export async function bulkSyncToShop(shopPlatform: ShopPlatform): Promise<{
  total: number
  succeeded: number
  failed: number
  errors: Array<{ productName: string; error: string }>
}> {
  const listings = await prisma.shopListing.findMany({
    where: {
      shopPlatform,
      status: { in: ['PENDING', 'ERROR', 'ACTIVE'] },
      product: { isActive: true },
    },
    include: { product: true },
  })

  const errors: Array<{ productName: string; error: string }> = []
  let succeeded = 0

  for (const listing of listings) {
    const result = await syncShopListing(listing.id)
    if (result.success) {
      succeeded++
    } else {
      errors.push({ productName: listing.product.name, error: result.error || 'Unknown error' })
    }
  }

  return {
    total: listings.length,
    succeeded,
    failed: errors.length,
    errors,
  }
}
