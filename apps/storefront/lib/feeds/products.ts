import { prisma } from '@/lib/prisma'

/**
 * Shared product snapshot used by every third-party feed builder
 * (Facebook/Meta, Google Shopping, Amazon, …). Normalizing once here keeps
 * the per-platform serializers pure functions that are easy to test.
 */
export type FeedProduct = {
  /** Merchant identifier — the product SKU. */
  sku: string
  title: string
  description: string
  /** Absolute storefront product URL. */
  link: string
  /** Absolute primary image URL, or null when the product has no image. */
  imageLink: string | null
  /** Absolute additional image URLs (primary image excluded). */
  additionalImageLinks: string[]
  /** Regular price in USD. When on sale this is the compare-at price. */
  regularPrice: number
  /** Discounted price in USD, or null when not on sale. */
  salePrice: number | null
  availability: 'in stock' | 'out of stock'
  inventory: number
  brand: string
  /** GTIN/UPC from the product barcode, when known. */
  gtin: string | null
  /** Shipping weight in ounces, when known. */
  weightOz: number | null
  googleProductCategory: string
}

export const FEED_BRAND = 'Jose Madrid Salsa'
export const FEED_GOOGLE_PRODUCT_CATEGORY =
  'Food, Beverages & Tobacco > Food Items > Condiments & Sauces > Salsa'

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://www.josemadrid.net'

function toAbsoluteUrl(path: string | null | undefined): string {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`
}

/**
 * Load all active products normalized for feed export, in the same order the
 * storefront lists them.
 */
export async function getFeedProducts(): Promise<FeedProduct[]> {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })

  return products.map((product) => {
    const price = Number(product.price)
    const compareAtPrice =
      product.compareAtPrice !== null ? Number(product.compareAtPrice) : null
    // compareAtPrice is the original (higher) price; when it exceeds the
    // current price the product is on sale. Feeds want the regular price in
    // `price` and the discounted price in `sale_price`.
    const onSale = compareAtPrice !== null && compareAtPrice > price

    const imageLink = toAbsoluteUrl(product.featuredImage || product.images[0] || null) || null
    const additionalImageLinks = product.images
      .filter((image) => image && image !== product.featuredImage)
      .map(toAbsoluteUrl)
      .filter((url) => Boolean(url) && url !== imageLink)
      .slice(0, 10)

    return {
      sku: product.sku,
      title: product.name,
      description: product.description || product.name,
      link: `${SITE_URL}/products/${product.slug}`,
      imageLink,
      additionalImageLinks,
      regularPrice: onSale ? compareAtPrice! : price,
      salePrice: onSale ? price : null,
      availability: product.inventory > 0 ? 'in stock' : 'out of stock',
      inventory: product.inventory,
      brand: FEED_BRAND,
      gtin: product.barcode?.trim() || null,
      weightOz: product.weight !== null ? Number(product.weight) : null,
      googleProductCategory: FEED_GOOGLE_PRODUCT_CATEGORY,
    }
  })
}
