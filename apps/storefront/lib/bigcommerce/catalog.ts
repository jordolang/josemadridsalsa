import { bigCommerceFetchAll } from './client'
import type { BigCommerceStoreKey } from './config'
import { BIGCOMMERCE_PRODUCT_SLUGS } from './product-map'

/** Cache tag for every catalog read; the product webhook revalidates it. */
export const BIGCOMMERCE_CATALOG_TAG = 'bigcommerce:catalog'

/** Fallback freshness if a webhook is ever missed. */
const CATALOG_REVALIDATE_SECONDS = 300

// ---- Raw API shapes (only the fields read here) ----

type RawOptionValue = {
  id: number
  label: string
  sort_order: number
  is_default: boolean
  adjusters?: { purchasing_disabled?: { status: boolean } } | null
}

type RawModifier = {
  id: number
  display_name: string
  type: string
  required: boolean
  sort_order: number
  config?: { default_value?: string } | unknown[] | null
  option_values?: RawOptionValue[]
}

type RawImage = {
  url_standard: string
  url_zoom: string
  url_thumbnail: string
  description: string
  is_thumbnail: boolean
  sort_order: number
}

export type RawBigCommerceProduct = {
  id: number
  name: string
  type: string
  description: string
  price: number
  sale_price: number
  retail_price: number
  calculated_price: number
  is_visible: boolean
  is_featured: boolean
  availability: 'available' | 'disabled' | 'preorder'
  inventory_tracking: 'none' | 'product' | 'variant'
  inventory_level: number
  order_quantity_minimum: number
  order_quantity_maximum: number
  categories: number[]
  sort_order: number
  weight: number
  page_title: string
  meta_description: string
  search_keywords: string
  custom_url: { url: string }
  base_variant_id: number | null
  images?: RawImage[]
  modifiers?: RawModifier[]
  options?: unknown[]
}

// ---- Normalized shapes used by the storefront ----

export type BigCommerceProductImage = {
  url: string
  zoomUrl: string
  thumbnailUrl: string
  alt: string
}

/** A choice the buyer makes when adding to cart, e.g. "Jar 3" or "Order Notes". */
export type BigCommerceProductModifier = {
  id: number
  label: string
  type: 'dropdown' | 'text' | 'unsupported'
  required: boolean
  /** Placeholder BigCommerce shows in text fields. */
  placeholder: string | null
  values: Array<{ id: number; label: string; isDefault: boolean }>
}

export type BigCommerceProduct = {
  id: number
  name: string
  /** BigCommerce storefront path, e.g. `/choose-12/` — the legacy URL. */
  legacyPath: string
  /** Slug of this site's richer product page, when one is mapped. */
  siteSlug: string | null
  descriptionHtml: string
  /** What the buyer pays today (sale price when one is active). */
  price: number
  /** The struck-through "was" price, only when a sale is active. */
  compareAtPrice: number | null
  isVisible: boolean
  isFeatured: boolean
  /** Visible, not disabled, and in stock when stock is tracked. */
  isPurchasable: boolean
  inventoryTracked: boolean
  inventoryLevel: number | null
  minQuantity: number
  maxQuantity: number | null
  categoryIds: number[]
  sortOrder: number
  images: BigCommerceProductImage[]
  modifiers: BigCommerceProductModifier[]
  seoTitle: string | null
  seoDescription: string | null
}

const TEXT_MODIFIER_TYPES = new Set(['text', 'multi_line_text'])
const DROPDOWN_MODIFIER_TYPES = new Set(['dropdown', 'radio_buttons', 'rectangles', 'swatch'])

function normalizeModifier(raw: RawModifier): BigCommerceProductModifier {
  const type = DROPDOWN_MODIFIER_TYPES.has(raw.type)
    ? 'dropdown'
    : TEXT_MODIFIER_TYPES.has(raw.type)
      ? 'text'
      : 'unsupported'
  const config = raw.config && !Array.isArray(raw.config) ? raw.config : null
  const placeholder = typeof config?.default_value === 'string' && config.default_value ? config.default_value : null

  return {
    id: raw.id,
    label: raw.display_name,
    type,
    required: raw.required,
    placeholder: type === 'text' ? placeholder : null,
    values: [...(raw.option_values ?? [])]
      .filter((value) => !value.adjusters?.purchasing_disabled?.status)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((value) => ({ id: value.id, label: value.label, isDefault: value.is_default })),
  }
}

export function normalizeBigCommerceProduct(
  raw: RawBigCommerceProduct,
  storeKey: BigCommerceStoreKey = 'main',
): BigCommerceProduct {
  const onSale = raw.sale_price > 0 && raw.sale_price < raw.price
  const inventoryTracked = raw.inventory_tracking !== 'none'
  const inStock = !inventoryTracked || raw.inventory_level > 0

  const images = [...(raw.images ?? [])]
    // BigCommerce's thumbnail flag marks the primary image; lead with it.
    .sort((a, b) => Number(b.is_thumbnail) - Number(a.is_thumbnail) || a.sort_order - b.sort_order)
    .map((image) => ({
      url: image.url_standard,
      zoomUrl: image.url_zoom,
      thumbnailUrl: image.url_thumbnail,
      alt: image.description || raw.name,
    }))

  return {
    id: raw.id,
    name: raw.name,
    legacyPath: raw.custom_url.url,
    // Product ids are per store, and the map only covers the main store.
    siteSlug: storeKey === 'main' ? (BIGCOMMERCE_PRODUCT_SLUGS[raw.id] ?? null) : null,
    descriptionHtml: raw.description,
    price: raw.calculated_price,
    compareAtPrice: onSale ? raw.price : null,
    isVisible: raw.is_visible,
    isFeatured: raw.is_featured,
    isPurchasable: raw.is_visible && raw.availability !== 'disabled' && inStock,
    inventoryTracked,
    inventoryLevel: inventoryTracked ? raw.inventory_level : null,
    minQuantity: Math.max(1, raw.order_quantity_minimum),
    maxQuantity: raw.order_quantity_maximum > 0 ? raw.order_quantity_maximum : null,
    categoryIds: raw.categories,
    sortOrder: raw.sort_order,
    images,
    modifiers: [...(raw.modifiers ?? [])].sort((a, b) => a.sort_order - b.sort_order).map(normalizeModifier),
    seoTitle: raw.page_title || null,
    seoDescription: raw.meta_description || null,
  }
}

/**
 * Every product in the store, visible or not, in BigCommerce's sort order.
 * Callers filter on `isVisible`; hidden products are still needed to answer
 * legacy-URL redirects for seasonal flavors.
 */
export async function getBigCommerceProducts(
  storeKey: BigCommerceStoreKey = 'main',
): Promise<BigCommerceProduct[]> {
  const raw = await bigCommerceFetchAll<RawBigCommerceProduct>(storeKey, 'v3/catalog/products', {
    query: { include: 'images,modifiers' },
    revalidate: CATALOG_REVALIDATE_SECONDS,
    tags: [BIGCOMMERCE_CATALOG_TAG],
  })
  return raw
    .map((product) => normalizeBigCommerceProduct(product, storeKey))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
}

/** The product whose site page or legacy BigCommerce path matches `slug`. */
export function findBigCommerceProductBySlug(
  products: BigCommerceProduct[],
  slug: string,
): BigCommerceProduct | null {
  const bare = slug.replace(/^\/+|\/+$/g, '')
  return (
    products.find((product) => product.siteSlug === bare) ??
    products.find((product) => product.legacyPath.replace(/^\/+|\/+$/g, '') === bare) ??
    null
  )
}
