import { notFound, permanentRedirect } from 'next/navigation'
import { getProductBySlug } from '@/lib/db/products'
import { formatPrice, getHeatLevelColor, getHeatLevelText } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ImageGallery } from '@/components/products/ImageGallery'
import { NutritionalInfo } from '@/components/products/NutritionalInfo'
import { ProductReviews } from '@/components/reviews/product-reviews'
import { AddToCartButton } from '@/components/store/add-to-cart-button'
import { YouMayAlsoLike } from '@/components/store/product-recommendations'
import { buildProductSchema } from '@/lib/seo/schema-generator'
import { buildTemplatedMeta } from '@/lib/seo/metadata'
import { prisma } from '@/lib/prisma'
import { Metadata } from 'next'
import { legacyProductDestination } from '@/bigcommerce-redirects.mjs'

export const revalidate = 900 // Revalidate every 15 minutes


type Props = {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  // During build, prefer skipping database to avoid connection issues
  if (process.env.VERCEL || process.env.CI || !process.env.DATABASE_URL) {
    console.log('Build environment detected, skipping product static params generation')
    return []
  }

  try {
    // Add timeout to prevent hanging during build (5 second max)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Database query timeout')), 5000)
    })

    const products = await Promise.race([
      prisma.product.findMany({
        where: { isActive: true },
        select: { slug: true },
        take: 50, // Limit to top 50 products for build time
        orderBy: [
          { isFeatured: 'desc' },
          { sortOrder: 'asc' },
        ],
      }),
      timeoutPromise,
    ])

    if (products.length > 0) {
      return products.map(({ slug }) => ({ slug }))
    }
  } catch (error) {
    console.warn('Falling back to empty product static params:', error instanceof Error ? error.message : 'Unknown error')
  }

  return []
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

  const ingredientNames = product.productIngredients
    ?.map((pi: any) => pi.ingredient.name)
    .slice(0, 5)
    .join(', ')

  const fallbackDescription = product.description
    || `Buy ${product.name} - Premium handcrafted salsa from Jose Madrid Salsa.${ingredientNames ? ` Made with ${ingredientNames}.` : ''}`

  const { title, description: metaDescription } = await buildTemplatedMeta({
    entity: 'product',
    variables: {
      product_name: product.name,
      category: product.category?.name ?? '',
      heat_level: getHeatLevelText(product.heatLevel),
      price: formatPrice(product.price),
    },
    overrideTitle: product.metaTitle,
    overrideDescription: product.metaDescription,
    fallbackTitle: `${product.name} | Jose Madrid Salsa`,
    fallbackDescription,
  })

  return {
    title,
    description: metaDescription,
    alternates: {
      canonical: `/products/${slug}`,
    },
    openGraph: {
      title: product.name,
      description: metaDescription,
      images: product.featuredImage ? [product.featuredImage] : undefined,
      type: 'website',
      url: `/products/${slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: product.name,
      description: metaDescription,
      images: product.featuredImage ? [product.featuredImage] : undefined,
    },
    other: {
      'product:price:amount': product.price.toFixed(2),
      'product:price:currency': 'USD',
      'product:availability': product.inventory > 0 ? 'in stock' : 'out of stock',
      'product:condition': 'new',
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
    // Old links (e.g. the Facebook Shop catalog) still carry the BigCommerce-era slugs.
    const legacyDestination = legacyProductDestination(slug)
    if (legacyDestination) permanentRedirect(legacyDestination)
    notFound()
  }

  // Fetch review stats for structured data (AggregateRating) and any admin-edited schema override
  const [reviewStats, schemaOverride] = await Promise.all([
    prisma.review.aggregate({
      where: { productId: product.id, status: 'APPROVED' },
      _avg: { rating: true },
      _count: { rating: true },
    }),
    prisma.structuredData.findUnique({
      where: { entityType_entityId: { entityType: 'PRODUCT', entityId: product.id } },
    }),
  ])

  const isOutOfStock = product.inventory <= 0
  const isLowStock = !isOutOfStock && product.inventory <= product.lowStockThreshold
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price
  const discountPercentage = hasDiscount
    ? Math.round(((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100)
    : 0

  // Build JSON-LD structured data (admin-edited override wins when active)
  const jsonLd = schemaOverride?.isActive
    ? schemaOverride.jsonLd
    : buildProductSchema({
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        featuredImage: product.featuredImage,
        images: product.images || [],
        sku: product.sku,
        inventory: product.inventory,
        heatLevel: product.heatLevel,
        weight: product.weight,
        ingredients: product.ingredients,
        nutritionalInfo: product.nutritionalInfo,
        productIngredients: product.productIngredients,
        reviewStats: reviewStats._count.rating > 0
          ? {
              averageRating: reviewStats._avg.rating ?? 0,
              reviewCount: reviewStats._count.rating,
            }
          : null,
      })

  return (
    <main className="min-h-screen bg-background">
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

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
              <div className="flex flex-wrap items-center gap-2 mb-3">
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
                {isLowStock && (
                  <Badge className="bg-orange-500 text-white">Low Stock</Badge>
                )}
                {isOutOfStock && (
                  <Badge variant="destructive">Out of Stock</Badge>
                )}
              </div>

              {/* Product Name */}
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
                {product.name}
              </h1>

              {/* Price */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="text-2xl sm:text-3xl font-bold text-foreground">
                  {formatPrice(product.price)}
                </span>
                {hasDiscount && (
                  <span className="text-lg sm:text-xl text-muted-foreground line-through">
                    {formatPrice(product.compareAtPrice!)}
                  </span>
                )}
              </div>
            </div>

            {/* Description */}
            {product.description && (
              <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
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
                productIngredients={product.productIngredients}
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

            {/* Add to Cart Button */}
            <AddToCartButton
              product={{
                id: product.id,
                name: product.name,
                slug: product.slug,
                price: product.price,
                featuredImage: product.featuredImage,
                sku: product.sku,
                heatLevel: product.heatLevel,
                inventory: product.inventory,
              }}
              size="lg"
              className="w-full"
            />

            {/* Low stock warning */}
            {isLowStock && (
              <div className="text-orange-600 text-sm font-medium">
                ⚠️ Only {product.inventory} left in stock!
              </div>
            )}

            {/* Add to Cart Button - Mobile optimized with 44px min height */}
            <div className="pt-4 border-t">
              <AddToCartButton
                product={{
                  id: product.id,
                  name: product.name,
                  slug: product.slug,
                  price: product.price,
                  featuredImage: product.featuredImage,
                  sku: product.sku,
                  heatLevel: product.heatLevel,
                  inventory: product.inventory,
                }}
                quantity={1}
                size="lg"
                className="w-full sm:w-auto min-h-[44px] text-base font-semibold"
              />
            </div>

            {/* Reviews Section */}
            {reviewStats._count.rating > 0 && (
              <div className="pt-6 border-t">
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                    Customer Reviews
                  </h2>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {reviewStats._avg.rating?.toFixed(1)}
                    </span>
                    <span>({reviewStats._count.rating} reviews)</span>
                  </div>
                </div>
                <a
                  href="#reviews-heading"
                  className="text-base font-medium text-primary hover:underline"
                >
                  Read what customers are saying
                </a>
              </div>
            )}
          </div>
        </div>

        <ProductReviews
          productId={product.id}
          productName={product.name}
          initialAverageRating={reviewStats._avg.rating ?? 0}
          initialReviewCount={reviewStats._count.rating ?? 0}
        />

        {/* You May Also Like Recommendations */}
        <YouMayAlsoLike productId={product.id} />
      </div>
    </main>
  )
}
