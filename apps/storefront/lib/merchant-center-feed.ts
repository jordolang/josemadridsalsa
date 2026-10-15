/**
 * Builds the Google Merchant Center product feed that `scripts/products-feed.ts` writes to
 * `public/merchant-center-feed.xml`, where Merchant Center fetches it on a daily schedule.
 *
 * RSS 2.0 with the `g:` namespace (https://support.google.com/merchants/answer/7052112). A product
 * missing anything Google needs to approve it (slug, price, GTIN, image) is skipped with a reason
 * rather than sent as a partial item.
 */
import type { HeatLevel } from '@prisma/client'
import type { SalsaCategorySlug } from '@/lib/salsa-categories'

export const MERCHANT_FEED_PATH = '/merchant-center-feed.xml'
export const MERCHANT_FEED_BRAND = 'Jose Madrid Salsa'

/**
 * Food, Beverages & Tobacco > Food Items > Dips & Spreads > Salsa. Google files salsa under Dips &
 * Spreads; Condiments & Sauces has no Salsa node (taxonomy version 2021-09-21).
 */
export const MERCHANT_FEED_GOOGLE_PRODUCT_CATEGORY = '1702'

export const DESCRIPTION_SUFFIX =
  'Every jar of Jose Madrid Salsa is handmade in small batches in Zanesville, Ohio. Enjoy it with tortilla chips, spooned over tacos, eggs and grilled meats, or as a quick topping that brings bold flavor to any meal.'

const TITLE_MAX = 150
const DESCRIPTION_PAD_BELOW = 500
const DESCRIPTION_MAX = 1000
const ADDITIONAL_IMAGES_MAX = 10

/** The product fields the feed reads, as loaded from Prisma (Decimals already converted). */
export interface MerchantFeedProduct {
  name: string
  slug: string
  sku: string
  price: number | null
  barcode: string | null
  description: string | null
  metaDescription: string | null
  heatLevel: HeatLevel
  featuredImage: string | null
  images: string[]
  inventory: number
  /** Net weight in ounces. */
  weight: number | null
  category: { name: string; slug: string } | null
}

/** Shopper-facing heat for each salsa category; product_type is the category name without "Salsa". */
const HEAT_BY_CATEGORY: Record<SalsaCategorySlug, string> = {
  'fruit-mild-salsa': 'Mild',
  'fruit-hot-salsa': 'Hot',
  'mild-salsa': 'Mild',
  'medium-salsa': 'Medium',
  'hot-salsa': 'Hot',
}

const HEAT_BY_LEVEL: Record<HeatLevel, string | null> = {
  MILD: 'Mild',
  MEDIUM: 'Medium',
  HOT: 'Hot',
  EXTRA_HOT: 'Extra Hot',
  FRUIT: null,
}

export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Plain text from imported copy: drops HTML tags, decodes the common entities, collapses spaces. */
function plainText(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Cuts to `max` characters, backing up to the last space so no word is split. */
function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  const cut = value.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:-]+$/, '')
}

/** "Jose Madrid Mango Habanero Salsa" → "Mango Habanero". */
export function flavorName(name: string): string {
  return plainText(name)
    .replace(/^jose madrid\s+/i, '')
    .replace(/\bsalsa\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Mild / Medium / Hot from the salsa category, else from the heat level; null when unknown. */
export function heatLabel(product: Pick<MerchantFeedProduct, 'category' | 'heatLevel'>): string | null {
  const slug = product.category?.slug as SalsaCategorySlug | undefined
  return (slug && HEAT_BY_CATEGORY[slug]) || HEAT_BY_LEVEL[product.heatLevel]
}

/** "Fruit Mild Salsa" → "Fruit Mild"; null when the product has no category. */
export function productType(product: Pick<MerchantFeedProduct, 'category'>): string | null {
  if (!product.category) return null
  return product.category.name.replace(/\s+salsa$/i, '').trim() || product.category.name
}

/**
 * `Jose Madrid {Flavor} Salsa - {Heat} Heat - Small Batch Gourmet Salsa - {oz} oz Jar`, capped at
 * 150 characters. The heat and size segments are left out when unknown.
 */
export function buildFeedTitle(
  product: Pick<MerchantFeedProduct, 'name' | 'category' | 'heatLevel' | 'weight'>
): string {
  const heat = heatLabel(product)
  const segments = [
    `Jose Madrid ${flavorName(product.name)} Salsa`,
    heat ? `${heat} Heat` : null,
    'Small Batch Gourmet Salsa',
    product.weight ? `${Number(product.weight.toFixed(2))} oz Jar` : null,
  ]
  return truncate(segments.filter(Boolean).join(' - '), TITLE_MAX)
}

/**
 * The product description (or its meta description), with the small-batch suffix appended when it
 * is under 500 characters, capped at 1000.
 */
export function buildFeedDescription(
  product: Pick<MerchantFeedProduct, 'description' | 'metaDescription'>
): string {
  const base = plainText(product.description || product.metaDescription || '')
  const text = !base
    ? DESCRIPTION_SUFFIX
    : base.length < DESCRIPTION_PAD_BELOW
      ? `${base} ${DESCRIPTION_SUFFIX}`
      : base
  return truncate(text, DESCRIPTION_MAX)
}

function toAbsoluteUrl(siteUrl: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  return `${siteUrl}${path.startsWith('/') ? '' : '/'}${path}`
}

/** Featured image first, then the gallery, de-duplicated and absolute. */
function imageLinks(product: MerchantFeedProduct, siteUrl: string): string[] {
  const paths = [product.featuredImage, ...product.images].map((p) => p?.trim()).filter(Boolean) as string[]
  return [...new Set(paths.map((path) => toAbsoluteUrl(siteUrl, path)))]
}

/** Why a product can't go in the feed; empty when it can. */
export function feedSkipReasons(product: MerchantFeedProduct): string[] {
  const reasons: string[] = []
  if (!product.slug?.trim()) reasons.push('no slug')
  if (product.price === null || !(product.price > 0)) reasons.push('no price')
  const gtin = product.barcode?.trim()
  if (!gtin) reasons.push('no barcode (GTIN)')
  else if (!/^(\d{8}|\d{12,14})$/.test(gtin)) reasons.push(`barcode "${gtin}" is not a GTIN`)
  if (!product.featuredImage?.trim() && !product.images.some((image) => image?.trim())) {
    reasons.push('no image')
  }
  return reasons
}

/** One `<item>` for a product that passed `feedSkipReasons`. */
export function buildFeedItem(product: MerchantFeedProduct, siteUrl: string): string {
  const tag = (name: string, value: string) => `<g:${name}>${xmlEscape(value)}</g:${name}>`
  const [imageLink, ...additional] = imageLinks(product, siteUrl)
  const heat = heatLabel(product)
  const type = productType(product)

  const lines = [
    tag('id', product.sku || product.slug),
    tag('title', buildFeedTitle(product)),
    tag('description', buildFeedDescription(product)),
    tag('link', `${siteUrl}/products/${product.slug}`),
    tag('image_link', imageLink),
    ...additional.slice(0, ADDITIONAL_IMAGES_MAX).map((url) => tag('additional_image_link', url)),
    tag('availability', product.inventory > 0 ? 'in stock' : 'out of stock'),
    tag('price', `${(product.price as number).toFixed(2)} USD`),
    tag('brand', MERCHANT_FEED_BRAND),
    tag('condition', 'new'),
    tag('gtin', (product.barcode as string).trim()),
    tag('google_product_category', MERCHANT_FEED_GOOGLE_PRODUCT_CATEGORY),
    ...(type ? [tag('product_type', type)] : []),
    ...(heat ? [tag('custom_label_0', heat)] : []),
  ]
  return `    <item>\n      ${lines.join('\n      ')}\n    </item>`
}

/** The whole RSS document around already-built items. */
export function buildFeedXml(items: string[], siteUrl: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">',
    '  <channel>',
    `    <title>${xmlEscape(MERCHANT_FEED_BRAND)}</title>`,
    `    <link>${xmlEscape(siteUrl)}</link>`,
    `    <description>${xmlEscape('Jose Madrid Salsa products for Google Merchant Center')}</description>`,
    ...items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n')
}
