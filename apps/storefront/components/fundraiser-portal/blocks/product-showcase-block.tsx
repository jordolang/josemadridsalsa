import type { ProductShowcaseBlock as ProductShowcaseBlockType } from '@/lib/fundraiser-page-config'
import {
  FundraiserStore,
  type FundraiserStoreProduct,
} from '@/components/fundraiser/fundraiser-store'

type Props = {
  block: ProductShowcaseBlockType
  fundraiser: {
    slug: string
    name: string
    organizationName: string
    commissionRate: number
    storeProducts: FundraiserStoreProduct[]
  }
}

/**
 * The campaign's shop, as a page block.
 *
 * The products come from the fundraiser's own store, at the fundraiser's own prices, and add
 * to the cart tagged with the campaign. This block used to link out to the retail product
 * pages instead, which quoted ten dollars here and charged nine at the till.
 */
export function ProductShowcaseBlock({ block, fundraiser }: Props) {
  const pricePoints = block.pricePoints

  // A price-point filter narrows the shelf to the tiers the campaign advertises. An empty
  // result means the campaign's prices have moved since the page was laid out, so show
  // everything rather than an empty shop.
  const filtered =
    pricePoints.length > 0
      ? fundraiser.storeProducts.filter((product) =>
          pricePoints.some((point) => Math.abs(product.price - point) < 0.01)
        )
      : fundraiser.storeProducts

  return (
    <section className="bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-6xl">
        <FundraiserStore
          slug={fundraiser.slug}
          name={fundraiser.name}
          organizationName={fundraiser.organizationName}
          commissionRate={fundraiser.commissionRate}
          products={filtered.length > 0 ? filtered : fundraiser.storeProducts}
          title={block.title || 'Support Our Cause'}
          columns={block.columns}
        />
      </div>
    </section>
  )
}
