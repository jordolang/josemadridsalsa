import { prisma } from '@/lib/prisma'

/**
 * Public Meta (Facebook/Instagram) Commerce catalog feed.
 *
 * Paste this endpoint's URL into Commerce Manager → Catalog → Data sources →
 * "Use a data feed" → Scheduled feed. Meta fetches it on a schedule and keeps
 * the catalog in sync with active products, prices, and inventory — no API
 * tokens or business verification required to populate the catalog.
 *
 * Output is the standard comma-delimited catalog feed Meta documents at
 * https://www.facebook.com/business/help/120325381656392. The field mapping
 * mirrors the items_batch sync in lib/social/shops.ts so the two paths produce
 * identical products.
 */

export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://www.josemadrid.net'
const BRAND = 'Jose Madrid Salsa'
const GOOGLE_PRODUCT_CATEGORY =
  'Food, Beverages & Tobacco > Food Items > Condiments & Sauces > Salsa'

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
  'google_product_category',
  'quantity_to_sell_on_facebook',
  'inventory',
] as const

function toAbsoluteUrl(path: string | null | undefined): string {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`
}

/** Quote a field per RFC 4180: wrap in double-quotes, escape inner quotes. */
function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

export async function GET() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })

  const rows = products
    .map((product) => {
      const imageLink = toAbsoluteUrl(product.featuredImage || product.images[0] || null)
      // A product with no image is rejected by Meta — skip it rather than
      // emit an invalid row that fails the whole feed item.
      if (!imageLink) return null

      const price = Number(product.price)
      const compareAtPrice =
        product.compareAtPrice !== null ? Number(product.compareAtPrice) : null
      // compareAtPrice is the original (higher) price; when it exceeds the
      // current price the product is on sale. Meta wants `price` = regular
      // price and `sale_price` = the discounted price.
      const onSale = compareAtPrice !== null && compareAtPrice > price
      const regularPrice = onSale ? compareAtPrice! : price

      const additionalImages = product.images
        .filter((image) => image && image !== product.featuredImage)
        .map(toAbsoluteUrl)
        .filter(Boolean)
        .slice(0, 10)
        .join(',')

      const values: Record<(typeof COLUMNS)[number], string> = {
        id: product.sku,
        title: product.name,
        description: product.description || product.name,
        availability: product.inventory > 0 ? 'in stock' : 'out of stock',
        condition: 'new',
        price: `${regularPrice.toFixed(2)} USD`,
        sale_price: onSale ? `${price.toFixed(2)} USD` : '',
        link: `${SITE_URL}/products/${product.slug}`,
        image_link: imageLink,
        additional_image_link: additionalImages,
        brand: BRAND,
        google_product_category: GOOGLE_PRODUCT_CATEGORY,
        quantity_to_sell_on_facebook: String(product.inventory),
        inventory: String(product.inventory),
      }

      return COLUMNS.map((column) => csvCell(values[column])).join(',')
    })
    .filter((row): row is string => row !== null)

  const csv = [COLUMNS.join(','), ...rows].join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'inline; filename="facebook-catalog-feed.csv"',
      // Meta re-fetches on its own schedule; a short cache shields the DB from
      // incidental traffic while keeping inventory reasonably fresh.
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  })
}
