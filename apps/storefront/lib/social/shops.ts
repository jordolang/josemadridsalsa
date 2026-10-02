import type { ShopPlatform, SocialMediaPlatform } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  getAccountAccessToken,
  getAccountRefreshToken,
  getExpectedAccountPlatformForShop,
  getSocialBaseUrl,
} from './platforms'
import { putAmazonListing } from './amazon-sp-api'
import { upsertGoogleShoppingProduct } from './google-content-api'
import { putTikTokShopProduct } from './tiktok-shop-api'

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
  const expectedPlatform = getExpectedAccountPlatformForShop(config.shopPlatform)

  // Amazon and Google Shopping authenticate with server credentials, not a
  // connected social account; their sync clients validate configuration.
  if (expectedPlatform === null) {
    return { valid: true }
  }

  if (!config.socialAccountId) {
    return { valid: false, error: 'Choose the connected account that should own this export.' }
  }

  if (config.socialAccountPlatform && config.socialAccountPlatform !== expectedPlatform) {
    return {
      valid: false,
      error: `Selected account must be a ${expectedPlatform === 'FACEBOOK' ? 'Facebook Page' : 'TikTok account'}.`,
    }
  }

  // Marketplace has no public listing API: products reach it through the
  // Commerce catalog, so both Facebook exports need one.
  if (!config.catalogId?.trim()) {
    return {
      valid: false,
      error:
        config.shopPlatform === 'FACEBOOK_SHOP'
          ? 'Facebook Shop exports require a catalog ID.'
          : 'Facebook Marketplace exports require a catalog ID. Marketplace shows products from your Commerce catalog.',
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
    // compareAtPrice is the original price; the product is on sale when it exceeds the current price.
    // Facebook expects `price` = regular price and `sale_price` = discounted price.
    const compareAtPrice = listing.product.compareAtPrice
    const onSale = compareAtPrice !== null && compareAtPrice > price
    const condition = listing.overrides.condition || 'new'
    const availability = listing.overrides.availability || (listing.product.inventory > 0 ? 'in stock' : 'out of stock')
    const imageUrl = listing.product.featuredImage || listing.product.images[0]

    if (!imageUrl) {
      return { success: false, error: 'Product must have at least one image for Facebook catalog.' }
    }

    // Use the Catalog Items Batch API to create or update the product.
    // items_batch uses feed-style field names (title/link/image_link) and
    // decimal prices like "9.99 USD" — not the cents format of the older
    // /batch endpoint.
    const method = existingExternalId ? 'UPDATE' : 'CREATE'
    const requestData: Record<string, unknown> = {
      method,
      data: {
        id: listing.product.sku,
        title,
        description,
        availability,
        condition,
        price: `${(onSale ? compareAtPrice : price).toFixed(2)} USD`,
        sale_price: onSale ? `${price.toFixed(2)} USD` : undefined,
        link: listing.product.url,
        image_link: imageUrl,
        additional_image_link: listing.product.images.slice(1, 10),
        brand: 'Jose Madrid Salsa',
        inventory: listing.product.inventory,
        google_product_category:
          listing.overrides.category || 'Food, Beverages & Tobacco > Food Items > Condiments & Sauces > Salsa',
      },
    }

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${listing.catalogId}/items_batch`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: accessToken,
          item_type: 'PRODUCT_ITEM',
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
    socialAccountPlatform: listing.socialAccount?.platform ?? null,
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
    case 'FACEBOOK_SHOP':
    // Meta has no public Marketplace listing API (the old commerce_listings edge is
    // partner-only); Marketplace draws from the Page's Commerce catalog instead.
    case 'FACEBOOK_MARKETPLACE': {
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
    case 'TIKTOK_SHOP': {
      result = await putTikTokShopProduct(
        {
          name: productData.name,
          description: productData.description,
          sku: productData.sku,
          price: productData.price,
          images: productData.images,
          featuredImage: productData.featuredImage,
          inventory: productData.inventory,
          weightOz: productData.weight,
        },
        {
          title: overrides.title,
          description: overrides.description,
          price: overrides.price,
          category: overrides.category,
        },
        listing.catalogId,
        listing.externalId,
      )
      break
    }
    case 'AMAZON': {
      result = await putAmazonListing(
        {
          name: productData.name,
          description: productData.description,
          sku: productData.sku,
          price: productData.price,
          images: productData.images,
          featuredImage: productData.featuredImage,
          inventory: productData.inventory,
          gtin: listing.product.barcode?.trim() || null,
          weightOz: productData.weight,
        },
        {
          title: overrides.title,
          description: overrides.description,
          price: overrides.price,
          category: overrides.category,
        },
      )
      break
    }
    case 'GOOGLE_SHOPPING': {
      result = await upsertGoogleShoppingProduct(
        {
          name: productData.name,
          description: productData.description,
          sku: productData.sku,
          price: productData.price,
          compareAtPrice: productData.compareAtPrice,
          images: productData.images,
          featuredImage: productData.featuredImage,
          inventory: productData.inventory,
          url: productData.url,
          gtin: listing.product.barcode?.trim() || null,
          weightOz: productData.weight,
        },
        {
          title: overrides.title,
          description: overrides.description,
          price: overrides.price,
          availability: overrides.availability,
          category: overrides.category,
        },
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
