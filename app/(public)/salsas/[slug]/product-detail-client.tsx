'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Minus, Plus, Heart, Scale } from 'lucide-react'
import { useWishlistStore } from '@/lib/store/wishlist'
import { useComparisonStore } from '@/lib/store/comparison'
import { useRecentlyViewedStore } from '@/lib/store/recently-viewed'
import { toast } from 'sonner'
import { AddToCartButton } from '@/components/store/add-to-cart-button'
import { formatPrice, getHeatLevelColor, getHeatLevelText, cn } from '@/lib/utils'
import { HeatGauge } from '@/components/store/heat-gauge'
import { getSalsaHeatRating } from '@/lib/salsa-heat'
import { useSession } from 'next-auth/react'
import { SocialShare } from '@/components/ui/social-share'
import { ShareContent } from '@/types/sharing'
import { generateHashtags } from '@/lib/sharing/metadata-extractor'
import { RecentlyViewedProducts } from '@/components/store/recently-viewed'
import { NutritionalInfo } from '@/components/products/NutritionalInfo'

type NutritionalInfoData = {
  id: string
  productId: string
  servingSize: string
  servingsPerContainer: number
  calories: number
  caloriesFromFat: number
  totalFatG: number
  totalFatDV: number
  saturatedFatG: number
  saturatedFatDV: number
  transFatG: number
  cholesterolMg: number
  cholesterolDV: number
  sodiumMg: number
  sodiumDV: number
  totalCarbG: number
  totalCarbDV: number
  dietaryFiberG: number
  dietaryFiberDV: number
  sugarsG: number
  proteinG: number
  vitaminADV: number
  vitaminCDV: number
  calciumDV: number
  ironDV: number
  allergens: string | null
}

type ProductIngredientData = {
  id: string
  sortOrder: number
  qualifier: string | null
  ingredient: {
    id: string
    name: string
  }
}

export type Product = {
  id: string
  name: string
  slug: string
  description: string
  price: number
  compareAtPrice?: number | null
  featuredImage: string
  images: string[]
  heatLevel: string
  sku: string
  inventory: number
  isFeatured: boolean
  ingredients: string[]
  searchKeywords: string[]
  weight?: string | null
  dimensions?: string | null
  nutritionalInfo?: NutritionalInfoData | null
  productIngredients?: ProductIngredientData[]
}

interface ProductDetailClientProps {
  product: Product
}

export function ProductDetailClient({ product }: ProductDetailClientProps) {
  const router = useRouter()
  const [quantity, setQuantity] = useState(1)
  const [selectedImage, setSelectedImage] = useState(0)

  const { addItem: addToWishlist, removeItem: removeFromWishlist, isInWishlist } = useWishlistStore()
  const { addProduct: addToComparison, removeProduct: removeFromComparison, isInComparison, canAddMore, openPanel } = useComparisonStore()
  const addRecentlyViewed = useRecentlyViewedStore((state) => state.addProduct)
  const { data: session } = useSession()

  // Track recently viewed products
  useEffect(() => {
    addRecentlyViewed({
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      image: product.featuredImage,
      heatLevel: product.heatLevel,
    })
  }, [product, addRecentlyViewed])

  const handleWishlistToggle = () => {
    if (!session) {
      router.push(`/auth/signin?callbackUrl=/salsas/${product.slug}`)
      return
    }

    if (isInWishlist(product.id)) {
      removeFromWishlist(product.id)
    } else {
      addToWishlist(product.id)
    }
  }

  const handleComparisonToggle = () => {
    if (inComparison) {
      removeFromComparison(product.id)
      toast.success('Removed from comparison')
    } else {
      if (!canAddMore()) {
        toast.error('Maximum 4 products can be compared')
        return
      }

      addToComparison({
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: product.price,
        image: product.featuredImage,
        heatLevel: product.heatLevel,
        sku: product.sku,
        description: product.description,
        inventory: product.inventory,
        ingredients: product.ingredients || null,
        weight: product.weight || null,
        dimensions: product.dimensions || null,
        nutritionalInfo: product.nutritionalInfo || null,
      })
      toast.success('Added to comparison')
      openPanel()
    }
  }

  const inWishlist = isInWishlist(product.id)
  const inComparison = isInComparison(product.id)

  const allImages = [product.featuredImage, ...product.images]
  const heatRating = getSalsaHeatRating(product.name, product.heatLevel)
  const productUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://josemadridsalsa.com'}/salsas/${product.slug}`
  const shareContent: ShareContent = {
    title: product.name,
    description: product.description,
    url: productUrl,
    image: product.featuredImage,
    contentType: 'product',
    hashtags: generateHashtags('product'),
  }

  const formattedIngredients = product.productIngredients
    ?.map((pi) => {
      const qualifier = pi.qualifier ? `${pi.qualifier} ` : ''
      return `${qualifier}${pi.ingredient.name}`
    })
    .join(', ')

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 mb-12">
          {/* Image Gallery */}
          <div className="space-y-4">
            <div className="relative aspect-square bg-card rounded-2xl overflow-hidden surface-shadow">
              <Image
                src={allImages[selectedImage]}
                alt={product.name}
                fill
                className="object-cover"
                priority
              />
            </div>
            {allImages.length > 1 && (
              <div className="grid grid-cols-4 gap-3">
                {allImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    className={cn(
                      'relative aspect-square bg-card rounded-lg overflow-hidden border-2 transition-all',
                      selectedImage === idx
                        ? 'border-salsa-500 ring-2 ring-salsa-200'
                        : 'border-transparent hover:border-salsa-300'
                    )}
                  >
                    <Image src={img} alt={`${product.name} view ${idx + 1}`} fill className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <div className="flex items-start justify-between gap-4 mb-3">
                <h1 className="text-3xl lg:text-4xl font-serif font-bold text-foreground">{product.name}</h1>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleWishlistToggle}
                    className={cn(inWishlist && 'text-red-500 border-red-500')}
                    aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
                  >
                    <Heart className={cn('w-5 h-5', inWishlist && 'fill-current')} />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleComparisonToggle}
                    className={cn(inComparison && 'text-blue-500 border-blue-500')}
                    aria-label={inComparison ? 'Remove from comparison' : 'Add to comparison'}
                  >
                    <Scale className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {product.isFeatured && (
                <Badge variant="secondary" className="mb-3">
                  Featured
                </Badge>
              )}

              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-3xl font-bold text-foreground">{formatPrice(product.price)}</span>
                {product.compareAtPrice && product.compareAtPrice > product.price && (
                  <>
                    <span className="text-xl text-muted-foreground line-through">
                      {formatPrice(product.compareAtPrice)}
                    </span>
                    <Badge variant="destructive" className="text-xs">
                      Save {Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)}%
                    </Badge>
                  </>
                )}
              </div>

              <p className="text-muted-foreground leading-relaxed mb-6">{product.description}</p>

              {/* Heat Level */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Heat Level</span>
                  <Badge className={getHeatLevelColor(product.heatLevel)}>{getHeatLevelText(product.heatLevel)}</Badge>
                </div>
                <HeatGauge value={heatRating.value} heatLevel={product.heatLevel} />
              </div>

              {/* Inventory Status */}
              {product.inventory <= 5 && product.inventory > 0 && (
                <p className="text-sm text-amber-600 font-medium mb-4">Only {product.inventory} left in stock!</p>
              )}
              {product.inventory === 0 && <p className="text-sm text-red-600 font-medium mb-4">Out of stock</p>}

              {/* Quantity Selector and Add to Cart */}
              <div className="flex gap-4 mb-6">
                <div className="flex items-center border border-border rounded-lg">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="px-4 py-2 min-w-[3rem] text-center font-medium">{quantity}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setQuantity(Math.min(product.inventory, quantity + 1))}
                    disabled={quantity >= product.inventory}
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

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
                  quantity={quantity}
                  className="flex-1"
                />
              </div>

              {/* Social Share */}
              <div className="pt-4 border-t border-border">
                <SocialShare content={shareContent} />
              </div>
            </div>
          </div>
        </div>

        {/* Product Details Tabs */}
        <div className="max-w-4xl space-y-8">
          {/* Ingredients */}
          {formattedIngredients && (
            <div className="bg-card surface-shadow rounded-2xl p-6">
              <h2 className="text-xl font-semibold mb-4 text-foreground">Ingredients</h2>
              <p className="text-muted-foreground leading-relaxed">{formattedIngredients}</p>
            </div>
          )}

          {/* Nutritional Info */}
          {product.nutritionalInfo && (
            <div className="bg-card surface-shadow rounded-2xl p-6">
              <h2 className="text-xl font-semibold mb-4 text-foreground">Nutritional Information</h2>
              <NutritionalInfo
                nutritionalInfo={product.nutritionalInfo}
                productIngredients={product.productIngredients}
                ingredients={product.ingredients}
              />
            </div>
          )}

          {/* Product Details */}
          <div className="bg-card surface-shadow rounded-2xl p-6">
            <h2 className="text-xl font-semibold mb-4 text-foreground">Product Details</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="font-medium text-muted-foreground mb-1">SKU</dt>
                <dd className="text-foreground">{product.sku}</dd>
              </div>
              {product.weight && (
                <div>
                  <dt className="font-medium text-muted-foreground mb-1">Weight</dt>
                  <dd className="text-foreground">{product.weight}</dd>
                </div>
              )}
              {product.dimensions && (
                <div>
                  <dt className="font-medium text-muted-foreground mb-1">Dimensions</dt>
                  <dd className="text-foreground">{product.dimensions}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Recently Viewed */}
        <div className="mt-16">
          <RecentlyViewedProducts currentProductId={product.id} />
        </div>
      </div>
    </main>
  )
}
