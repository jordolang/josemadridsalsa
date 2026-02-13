import { notFound } from 'next/navigation'
import { getProductBySlug } from '@/lib/db/products'
import { formatPrice, getHeatLevelColor, getHeatLevelText } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ImageGallery } from '@/components/products/ImageGallery'
import { VariantSelector } from '@/components/products/VariantSelector'
import { NutritionalInfo } from '@/components/products/NutritionalInfo'
import { Metadata } from 'next'

type Props = {
  params: Promise<{ slug: string }>
}

/**
 * Generate metadata for product detail page (SEO)
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlug(slug)

  if (!product) {
    return {
      title: 'Product Not Found',
    }
  }

  return {
    title: `${product.name} | Jose Madrid Salsa`,
    description: product.description || `Buy ${product.name} - Premium handcrafted salsa from Jose Madrid Salsa`,
    openGraph: {
      title: product.name,
      description: product.description || undefined,
      images: product.featuredImage ? [product.featuredImage] : undefined,
    },
  }
}

/**
 * Product Detail Page Server Component
 */
export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params
  const product = await getProductBySlug(slug)

  if (!product) {
    notFound()
  }

  const isOutOfStock = product.inventory <= 0
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price
  const discountPercentage = hasDiscount
    ? Math.round(((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100)
    : 0

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Product Images Section */}
          <ImageGallery
            images={product.images || []}
            productName={product.name}
            featuredImage={product.featuredImage}
          />

          {/* Product Info Section */}
          <div className="space-y-6">
            {/* Badges */}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Badge className={getHeatLevelColor(product.heatLevel)}>
                  {getHeatLevelText(product.heatLevel)}
                </Badge>
                {product.isFeatured && (
                  <Badge className="bg-salsa-500 text-white">Featured</Badge>
                )}
                {hasDiscount && (
                  <Badge className="bg-green-500 text-white">
                    {discountPercentage}% OFF
                  </Badge>
                )}
                {isOutOfStock && (
                  <Badge variant="destructive">Out of Stock</Badge>
                )}
              </div>

              {/* Product Name */}
              <h1 className="text-3xl font-bold text-foreground mb-2">
                {product.name}
              </h1>

              {/* Price */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl font-bold text-foreground">
                  {formatPrice(product.price)}
                </span>
                {hasDiscount && (
                  <span className="text-xl text-muted-foreground line-through">
                    {formatPrice(product.compareAtPrice!)}
                  </span>
                )}
              </div>
            </div>

            {/* Description */}
            {product.description && (
              <p className="text-muted-foreground text-lg leading-relaxed">
                {product.description}
              </p>
            )}

            {/* Category */}
            {product.category && (
              <div>
                <span className="text-sm text-muted-foreground">Category: </span>
                <span className="text-sm font-medium">{product.category.name}</span>
              </div>
            )}

            {/* Nutritional Info and Ingredients */}
            {product.nutritionalInfo && (
              <NutritionalInfo
                nutritionalInfo={product.nutritionalInfo}
                ingredients={product.ingredients}
              />
            )}

            {/* Product Details */}
            <div className="bg-card rounded-lg p-4 space-y-2 surface-shadow">
              <div className="flex justify-between">
                <span className="text-muted-foreground">SKU:</span>
                <span className="font-medium">{product.sku}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">In Stock:</span>
                <span className={`font-medium ${isOutOfStock ? 'text-red-600' : 'text-green-600'}`}>
                  {isOutOfStock ? 'Out of stock' : `${product.inventory} available`}
                </span>
              </div>
              {product.weight && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Weight:</span>
                  <span className="font-medium">{product.weight}</span>
                </div>
              )}
            </div>

            {/* Variant Selector */}
            {product.variants && product.variants.length > 0 && (
              <div className="bg-card rounded-lg p-4 surface-shadow">
                <h3 className="text-lg font-semibold text-foreground mb-3">
                  Select Options
                </h3>
                <VariantSelector
                  variants={product.variants}
                  basePrice={product.price}
                />
              </div>
            )}

            {/* Low stock warning */}
            {!isOutOfStock && product.inventory <= 5 && (
              <div className="text-orange-600 text-sm font-medium">
                ⚠️ Only {product.inventory} left in stock!
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
