import type { ProductShowcaseBlock as ProductShowcaseBlockType } from '@/lib/fundraiser-page-config'
import { fundraiserUnitPrice } from '@/lib/fundraising/pricing'

type FallbackProduct = {
  id: string
  name: string
  slug: string
  description: string | null
  price: any
  images: string[]
}

type Props = {
  block: ProductShowcaseBlockType
  fundraiser: {
    slug: string
    products: Array<{
      price: any
      product: {
        id: string
        name: string
        slug: string
        description: string | null
        price: any
        images: string[]
      }
    }>
  }
  fallbackProducts?: FallbackProduct[]
  isFallback?: boolean
}

export function ProductShowcaseBlock({ block, fundraiser, fallbackProducts, isFallback }: Props) {
  const title = block.title || 'Support Our Cause'
  const pricePoints = block.pricePoints

  const gridCols =
    block.columns === 2
      ? 'sm:grid-cols-2'
      : block.columns === 4
        ? 'sm:grid-cols-2 lg:grid-cols-4'
        : 'sm:grid-cols-2 lg:grid-cols-3'

  // When using fallback, display store products directly
  if (isFallback && fallbackProducts && fallbackProducts.length > 0) {
    return (
      <section id="products" className="bg-gray-50 px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-2 text-center font-serif text-2xl font-bold text-gray-900 sm:text-3xl">
            {title}
          </h2>

          <div className="mb-8 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <span className="text-lg">⚠️</span>
            <p>
              <strong>Note:</strong> No fundraiser-specific products have been configured yet.
              The products below are from the Jose Madrid Salsa store and do <strong>not</strong> benefit this fundraiser.
              Contact the fundraiser organizer for details.
            </p>
          </div>

          <div className={`grid grid-cols-1 gap-6 ${gridCols}`}>
            {fallbackProducts.map((product) => {
              const price = Number(product.price)
              const image = product.images?.[0]
              return (
                <a
                  key={product.id}
                  href={`/products/${product.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
                >
                  <div className="relative aspect-square overflow-hidden bg-gray-100">
                    {image ? (
                      <img
                        src={image}
                        alt={product.name}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-gray-400">
                        No image
                      </div>
                    )}
                    <span className="absolute right-0 top-0 rounded-bl-lg bg-gray-700 px-2 py-1 text-xs text-white">
                      🏪 Store Item
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="mb-1 font-semibold text-gray-900">{product.name}</h3>
                    {product.description && (
                      <p className="mb-2 line-clamp-2 text-sm text-gray-500">
                        {product.description}
                      </p>
                    )}
                    <p className="text-lg font-bold text-salsa-600">${price.toFixed(2)}</p>
                  </div>
                </a>
              )
            })}
          </div>
        </div>
      </section>
    )
  }

  // Normal fundraiser products
  const filteredProducts = fundraiser.products.filter((fp) => {
    const price = fundraiserUnitPrice(fp.product.price, fp.price)
    return pricePoints.some((pp) => Math.abs(price - pp) < 0.01)
  })

  const displayProducts =
    filteredProducts.length > 0 ? filteredProducts : fundraiser.products

  return (
    <section id="products" className="bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-2 text-center font-serif text-2xl font-bold text-gray-900 sm:text-3xl">
          {title}
        </h2>
        {pricePoints.length > 0 && (
          <p className="mb-8 text-center text-gray-500">
            Available at{' '}
            {pricePoints.map((p, i) => (
              <span key={p}>
                {i > 0 && (i === pricePoints.length - 1 ? ' and ' : ', ')}
                <span className="font-semibold text-salsa-600">${p}</span>
              </span>
            ))}
          </p>
        )}

        {displayProducts.length === 0 ? (
          <p className="py-8 text-center text-gray-500">
            Products coming soon! Check back later.
          </p>
        ) : (
          <div className={`grid grid-cols-1 gap-6 ${gridCols}`}>
            {displayProducts.map((fp) => {
              const price = fundraiserUnitPrice(fp.product.price, fp.price)
              const image = fp.product.images?.[0]
              return (
                <a
                  key={fp.product.id}
                  href={`/products/${fp.product.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
                >
                  <div className="aspect-square overflow-hidden bg-gray-100">
                    {image ? (
                      <img
                        src={image}
                        alt={fp.product.name}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-gray-400">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="mb-1 font-semibold text-gray-900">
                      {fp.product.name}
                    </h3>
                    {fp.product.description && (
                      <p className="mb-2 line-clamp-2 text-sm text-gray-500">
                        {fp.product.description}
                      </p>
                    )}
                    <p className="text-lg font-bold text-salsa-600">
                      ${price.toFixed(2)}
                    </p>
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
