import { notFound } from 'next/navigation'
import Image from 'next/image'
import { getProductBySlug } from '@/lib/db/products'
import { formatPrice, getHeatLevelColor, getHeatLevelText } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
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

  // Use images array or fall back to featuredImage
  const productImages = product.images && product.images.length > 0
    ? product.images
    : product.featuredImage
    ? [product.featuredImage]
    : ['/images/placeholder-salsa.jpg']

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Product Images Section */}
          <div className="space-y-4">
            <div className="bg-card rounded-lg overflow-hidden surface-shadow flex items-center justify-center min-h-[400px]">
              <Image
                src={productImages[0]}
                alt={product.name}
                width={600}
                height={600}
                className="w-full h-auto object-contain"
                priority
              />
            </div>

            {/* Thumbnails - only show if more than one image */}
            {productImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {productImages.map((image, index) => (
                  <div
                    key={index}
                    className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 border-border flex items-center justify-center bg-card"
                  >
                    <Image
                      src={image}
                      alt={`${product.name} ${index + 1}`}
                      width={80}
                      height={80}
                      className="w-full h-full object-contain"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

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

            {/* Ingredients */}
            {product.ingredients && product.ingredients.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Ingredients
                </h3>
                <p className="text-muted-foreground">
                  {product.ingredients.join(', ')}
                </p>
              </div>
            )}

            {/* Nutritional Info (if available) */}
            {product.nutritionalInfo && (
              <div className="bg-card rounded-lg p-4 space-y-2 surface-shadow">
                <h3 className="text-lg font-semibold text-foreground mb-3">
                  Nutritional Information
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Serving Size:</span>
                    <span className="font-medium">{product.nutritionalInfo.servingSize}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Calories:</span>
                    <span className="font-medium">{product.nutritionalInfo.calories}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Fat:</span>
                    <span className="font-medium">{product.nutritionalInfo.totalFat}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sodium:</span>
                    <span className="font-medium">{product.nutritionalInfo.sodium}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Carbs:</span>
                    <span className="font-medium">{product.nutritionalInfo.totalCarbs}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Protein:</span>
                    <span className="font-medium">{product.nutritionalInfo.protein}</span>
                  </div>
                </div>
                {product.nutritionalInfo.allergens && (
                  <div className="pt-2 border-t border-border mt-2">
                    <span className="text-sm text-muted-foreground">
                      Allergens: {product.nutritionalInfo.allergens}
                    </span>
                  </div>
                )}
              </div>
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

            {/* Variants (if available) */}
            {product.variants && product.variants.length > 0 && (
              <div className="bg-card rounded-lg p-4 surface-shadow">
                <h3 className="text-lg font-semibold text-foreground mb-3">
                  Available Variants
                </h3>
                <div className="space-y-2">
                  {product.variants.map((variant) => (
                    <div
                      key={variant.id}
                      className="flex justify-between items-center p-2 border border-border rounded"
                    >
                      <div>
                        <span className="font-medium">{variant.name}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          ({variant.type})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {variant.price && (
                          <span className="font-medium">{formatPrice(variant.price)}</span>
                        )}
                        {!variant.inStock && (
                          <Badge variant="destructive" className="text-xs">
                            Out of Stock
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
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
