import { SITE_URL, type FeedProduct } from './products'

/**
 * Meta (Facebook/Instagram) Commerce catalog feed — the standard
 * comma-delimited format documented at
 * https://www.facebook.com/business/help/120325381656392. The field mapping
 * mirrors the items_batch sync in lib/social/shops.ts so the two paths produce
 * identical products.
 */

const COLUMNS = [
  'id',
  'title',
  'description',
  'availability',
  'condition',
  'price',
  'sale_price',
  'link',
  'image_link',
  'additional_image_link',
  'brand',
  'gtin',
  'google_product_category',
  'quantity_to_sell_on_facebook',
  'inventory',
] as const

/**
 * Meta only accepts JPEG/PNG images, and our product images are transparent
 * WebP. Route every image through the JPEG re-encoder (app/api/feeds/image).
 */
export function toFeedJpegUrl(imageUrl: string): string {
  return `${SITE_URL}/api/feeds/image?src=${encodeURIComponent(imageUrl)}`
}

/** Quote a field per RFC 4180: wrap in double-quotes, escape inner quotes. */
function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

export function buildFacebookCatalogCsv(products: FeedProduct[]): string {
  const rows = products
    .map((product) => {
      // A product with no image is rejected by Meta — skip it rather than
      // emit an invalid row that fails the whole feed item.
      if (!product.imageLink) return null

      const values: Record<(typeof COLUMNS)[number], string> = {
        id: product.sku,
        title: product.title,
        description: product.description,
        availability: product.availability,
        condition: 'new',
        price: `${product.regularPrice.toFixed(2)} USD`,
        sale_price: product.salePrice !== null ? `${product.salePrice.toFixed(2)} USD` : '',
        link: product.link,
        image_link: toFeedJpegUrl(product.imageLink),
        additional_image_link: product.additionalImageLinks.map(toFeedJpegUrl).join(','),
        brand: product.brand,
        gtin: product.gtin ?? '',
        google_product_category: product.googleProductCategory,
        quantity_to_sell_on_facebook: String(product.inventory),
        inventory: String(product.inventory),
      }

      return COLUMNS.map((column) => csvCell(values[column])).join(',')
    })
    .filter((row): row is string => row !== null)

  return [COLUMNS.join(','), ...rows].join('\n')
}
