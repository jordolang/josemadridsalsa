import {
  getPrintifyProduct,
  isPrintifyConfigured,
  listPrintifyProducts,
  type PrintifyProduct,
} from '@/lib/printify/client'

/**
 * The storefront's view of a Printify product: only what the merch pages show and what
 * checkout needs, with variants a customer cannot buy already removed.
 */
export type MerchOptionValue = { id: number; title: string; color?: string }

export type MerchOption = { name: string; type: string; values: MerchOptionValue[] }

export type MerchVariant = {
  id: number
  title: string
  priceCents: number
  /** Option value ids, in the same order as the product's `options`. */
  optionIds: number[]
  isDefault: boolean
}

export type MerchImage = { src: string; variantIds: number[]; isDefault: boolean }

export type MerchProduct = {
  id: string
  /** The Printify shop the product lives in, which is where its orders go. */
  shopId: string
  title: string
  description: string
  images: MerchImage[]
  options: MerchOption[]
  variants: MerchVariant[]
  minPriceCents: number
  maxPriceCents: number
}

/** Printify descriptions are HTML from its editor; the storefront shows plain text. */
export function toPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Whether a Printify product belongs on the merch page. A product hidden in Printify after
 * it was published (it has an `external` listing) stays off the site; a product that was
 * never published to a sales channel is shown, because an API shop's products are not
 * "visible" until something publishes them, and the storefront is what sells them.
 */
export function isListed(product: PrintifyProduct): boolean {
  if (product.visible === false && product.external) return false
  return product.variants.some((variant) => variant.is_enabled && variant.is_available)
}

export function toMerchProduct(product: PrintifyProduct): MerchProduct | null {
  const variants = product.variants
    .filter((variant) => variant.is_enabled && variant.is_available)
    .map<MerchVariant>((variant) => ({
      id: variant.id,
      title: variant.title,
      priceCents: variant.price,
      optionIds: variant.options,
      isDefault: Boolean(variant.is_default),
    }))
  if (variants.length === 0) return null

  // Keep only option values some buyable variant uses, so a sold-out size is not offered.
  const usedValueIds = new Set(variants.flatMap((variant) => variant.optionIds))
  const options = product.options.map<MerchOption>((option) => ({
    name: option.name,
    type: option.type,
    values: option.values
      .filter((value) => usedValueIds.has(value.id))
      .map((value) => ({ id: value.id, title: value.title, color: value.colors?.[0] })),
  }))

  const enabledIds = new Set(variants.map((variant) => variant.id))
  const images = product.images
    .filter((image) => image.variant_ids.some((id) => enabledIds.has(id)))
    .sort((a, b) => Number(b.is_default) - Number(a.is_default))
    .map<MerchImage>((image) => ({
      src: image.src,
      variantIds: image.variant_ids.filter((id) => enabledIds.has(id)),
      isDefault: image.is_default,
    }))

  const prices = variants.map((variant) => variant.priceCents)
  return {
    id: product.id,
    shopId: product.shop_id,
    title: product.title,
    description: toPlainText(product.description ?? ''),
    images,
    options,
    variants,
    minPriceCents: Math.min(...prices),
    maxPriceCents: Math.max(...prices),
  }
}

export type MerchCatalog =
  | { status: 'ok'; products: MerchProduct[] }
  | { status: 'not-configured' }
  | { status: 'error' }

/** The merch shown on the site, newest first. Never throws: the page renders a fallback. */
export async function getMerchCatalog(): Promise<MerchCatalog> {
  if (!isPrintifyConfigured()) return { status: 'not-configured' }
  try {
    const products = await listPrintifyProducts()
    return {
      status: 'ok',
      products: products
        .filter(isListed)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(toMerchProduct)
        .filter((product): product is MerchProduct => product !== null),
    }
  } catch (error) {
    console.error('Failed to load the Printify merch catalog', error)
    return { status: 'error' }
  }
}

/** One listed product, or null when it is unknown, hidden or has nothing to buy. */
export async function getMerchProduct(productId: string, revalidate?: number): Promise<MerchProduct | null> {
  if (!isPrintifyConfigured()) return null
  const product = await getPrintifyProduct(productId, revalidate)
  if (!product || !isListed(product)) return null
  return toMerchProduct(product)
}
