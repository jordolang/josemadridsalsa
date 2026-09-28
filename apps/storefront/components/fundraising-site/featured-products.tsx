import { getFundraisingProducts } from '@/lib/fundraising-site/catalog'
import { FundraisingProductCard } from './product-card'

/**
 * A grid of the shop's products — featured ones first, like the old store's
 * "Most Popular" row. Renders nothing when the catalog cannot be read, so a
 * BigCommerce outage leaves the page usable.
 */
export async function FeaturedFundraisingProducts({ limit = 8 }: { limit?: number }) {
  const products = await getFundraisingProducts().catch(() => [])
  if (products.length === 0) return null
  const ordered = [...products.filter((p) => p.isFeatured), ...products.filter((p) => !p.isFeatured)].slice(0, limit)

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {ordered.map((product) => (
        <FundraisingProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
