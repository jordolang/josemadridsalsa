import 'server-only'
import { getBigCommerceProducts, type BigCommerceProduct } from '@/lib/bigcommerce/catalog'
import { isBigCommerceConfigured } from '@/lib/bigcommerce/config'

/**
 * The fundraising shop's catalog: the BigCommerce fundraising store's visible
 * products, in its sort order. Staff hide seasonal flavors and change prices
 * there; this site follows within the catalog cache window.
 */

export type FundraisingProduct = {
  id: number
  name: string
  /** URL slug on this site, from the store's own product URL (`/original-mild-salsa/`). */
  slug: string
  descriptionHtml: string
  price: number
  isPurchasable: boolean
  isFeatured: boolean
  images: BigCommerceProduct['images']
  seoTitle: string | null
  seoDescription: string | null
}

export function fundraisingProductSlug(product: Pick<BigCommerceProduct, 'legacyPath' | 'id'>): string {
  return product.legacyPath.replace(/^\/+|\/+$/g, '') || `product-${product.id}`
}

export function toFundraisingProduct(product: BigCommerceProduct): FundraisingProduct {
  return {
    id: product.id,
    name: product.name,
    slug: fundraisingProductSlug(product),
    descriptionHtml: product.descriptionHtml,
    price: product.price,
    isPurchasable: product.isPurchasable,
    isFeatured: product.isFeatured,
    images: product.images,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
  }
}

/** Visible products only. Empty when the fundraising store is not configured. */
export async function getFundraisingProducts(): Promise<FundraisingProduct[]> {
  if (!isBigCommerceConfigured('fundraising')) return []
  const products = await getBigCommerceProducts('fundraising')
  return products.filter((product) => product.isVisible).map(toFundraisingProduct)
}

/**
 * A product by its slug — including hidden seasonal flavors, so an old link
 * to one shows the product as unavailable rather than a 404.
 */
export async function getFundraisingProductBySlug(slug: string): Promise<FundraisingProduct | null> {
  if (!isBigCommerceConfigured('fundraising')) return null
  const products = await getBigCommerceProducts('fundraising')
  const match = products.find((product) => fundraisingProductSlug(product) === slug)
  if (!match) return null
  return { ...toFundraisingProduct(match), isPurchasable: match.isVisible && match.isPurchasable }
}
