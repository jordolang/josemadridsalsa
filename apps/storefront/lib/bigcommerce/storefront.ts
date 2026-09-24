import { getBigCommerceProducts, normalizeProductName, type BigCommerceProduct } from './catalog'
import { isBigCommerceConfigured } from './config'

/**
 * The switch for the headless cutover. Until `NEXT_PUBLIC_COMMERCE_BACKEND` is
 * `bigcommerce` the site prices and checks out exactly as before, so this code
 * can ship to production ahead of the cutover. It is public because the
 * checkout page, a client component, has to know where to send the cart.
 */
export function isBigCommerceStorefrontEnabled(): boolean {
  return process.env.NEXT_PUBLIC_COMMERCE_BACKEND === 'bigcommerce' && isBigCommerceConfigured('main')
}

/** BigCommerce does not cap untracked stock; this matches the cart's default ceiling. */
const UNTRACKED_STOCK = 99

export type BigCommercePricing = {
  price: number
  compareAtPrice: number | null
  /** Stock the storefront should show: 0 when BigCommerce will not sell it. */
  inventory: number
}

export function toBigCommercePricing(product: BigCommerceProduct): BigCommercePricing {
  return {
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    inventory: !product.isPurchasable
      ? 0
      : product.inventoryTracked
        ? (product.inventoryLevel ?? 0)
        : (product.maxQuantity ?? UNTRACKED_STOCK),
  }
}

export type BigCommercePricingIndex = {
  /** Products mapped to a site page, by site slug. */
  bySlug: Map<string, BigCommercePricing>
  /** Products missing from the map, by normalized name. */
  byName: Map<string, BigCommercePricing>
}

/** BigCommerce's price and stock for every product, keyed the ways a site product can match it. */
export function indexBigCommercePricing(products: BigCommerceProduct[]): BigCommercePricingIndex {
  const bySlug = new Map<string, BigCommercePricing>()
  const byName = new Map<string, BigCommercePricing>()
  for (const product of products) {
    if (product.siteSlug) bySlug.set(product.siteSlug, toBigCommercePricing(product))
    else byName.set(normalizeProductName(product.name), toBigCommercePricing(product))
  }
  return { bySlug, byName }
}

type PricedProduct = {
  slug: string
  name?: string
  price: number
  compareAtPrice?: number | null
  inventory?: number
}

/**
 * Replaces price, compare-at price and stock with BigCommerce's on every
 * product BigCommerce sells, matched by the product map or, failing that, by
 * name. A product it does not sell keeps its price but shows no stock, because
 * BigCommerce's checkout could not take it.
 */
export function overlayBigCommercePricing<T extends PricedProduct>(
  products: T[],
  pricing: BigCommercePricingIndex,
): T[] {
  return products.map((product) => {
    const bc =
      pricing.bySlug.get(product.slug) ??
      (product.name ? pricing.byName.get(normalizeProductName(product.name)) : undefined)
    if (!bc) return 'inventory' in product ? { ...product, inventory: 0 } : product
    return {
      ...product,
      price: bc.price,
      compareAtPrice: bc.compareAtPrice,
      ...('inventory' in product ? { inventory: bc.inventory } : {}),
    }
  })
}

/**
 * `overlayBigCommercePricing` against the live catalog, when the storefront is
 * switched to BigCommerce. If BigCommerce cannot be reached the database
 * prices stand: BigCommerce's checkout reprices every cart regardless, so a
 * stale price can never be what gets charged.
 */
export async function applyBigCommercePricing<T extends PricedProduct>(products: T[]): Promise<T[]> {
  if (!isBigCommerceStorefrontEnabled() || products.length === 0) return products
  try {
    return overlayBigCommercePricing(products, indexBigCommercePricing(await getBigCommerceProducts('main')))
  } catch (error) {
    console.error('[bigcommerce] catalog pricing unavailable; showing database prices', {
      message: error instanceof Error ? error.message : String(error),
    })
    return products
  }
}
