'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ShoppingCart, Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useCartStore } from '@/lib/store/cart'
import { formatPrice, getHeatLevelColor, getHeatLevelText } from '@/lib/utils'
import { useState } from 'react'

interface Product {
  id: string
  name: string
  slug: string
  description: string | null
  price: number
  compareAtPrice?: number | null
  featuredImage: string | null
  heatLevel: string
  sku: string
  inventory: number
  isFeatured: boolean
}

interface ProductCardProps {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem)
  const openCart = useCartStore((state) => state.openCart)
  const [imageError, setImageError] = useState(false)

  const handleAddToCart = () => {
    addItem({
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      image: product.featuredImage || '/images/placeholder-salsa.jpg',
      sku: product.sku,
      heatLevel: product.heatLevel,
      maxQuantity: product.inventory,
    })
    openCart()
  }

  const isOutOfStock = product.inventory <= 0
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price
  const discountPercentage = hasDiscount
    ? Math.round(((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100)
    : 0

  return (
    <Card className="group overflow-hidden border-0 bg-white shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      <div className="relative">
        <Link href={`/salsas/${product.slug}`}>
          <div className="relative aspect-square overflow-hidden bg-gray-100">
            <Image
              src={imageError || !product.featuredImage ? '/images/placeholder-salsa.jpg' : product.featuredImage}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              onError={() => setImageError(true)}
            />
            
            {/* Badges */}
            <div className="absolute top-3 left-3 flex flex-col gap-2">
              {product.isFeatured && (
                <Badge className="bg-salsa-500 text-white hover:bg-salsa-600">
                  Featured
                </Badge>
              )}
              {hasDiscount && (
                <Badge className="bg-green-500 text-white hover:bg-green-600">
                  {discountPercentage}% OFF
                </Badge>
              )}
              {isOutOfStock && (
                <Badge variant="destructive">
                  Out of Stock
                </Badge>
              )}
            </div>

            {/* Heat Level Badge */}
            <div className="absolute top-3 right-3">
              <Badge className={getHeatLevelColor(product.heatLevel)}>
                {getHeatLevelText(product.heatLevel)}
              </Badge>
            </div>

            {/* Quick Actions */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-10 w-10 rounded-full p-0 bg-white/90 hover:bg-white"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    // Add to wishlist logic
                  }}
                >
                  <Heart className="h-4 w-4" />
                  <span className="sr-only">Add to wishlist</span>
                </Button>
                {!isOutOfStock && (
                  <Button
                    size="sm"
                    className="h-10 w-10 rounded-full p-0 bg-salsa-500 hover:bg-salsa-600"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleAddToCart()
                    }}
                  >
                    <ShoppingCart className="h-4 w-4" />
                    <span className="sr-only">Add to cart</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Link>
      </div>

      <CardContent className="p-4">
        <Link href={`/salsas/${product.slug}`}>
          <h3 className="font-semibold text-lg text-gray-900 hover:text-salsa-600 transition-colors line-clamp-2">
            {product.name}
          </h3>
        </Link>
        
        {product.description && (
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
            {product.description}
          </p>
        )}

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-gray-900">
              {formatPrice(product.price)}
            </span>
            {hasDiscount && (
              <span className="text-sm text-gray-500 line-through">
                {formatPrice(product.compareAtPrice!)}
              </span>
            )}
          </div>
          
          {!isOutOfStock ? (
            <Button
              size="sm"
              onClick={handleAddToCart}
              className="bg-salsa-500 hover:bg-salsa-600"
            >
              Add to Cart
            </Button>
          ) : (
            <Button size="sm" disabled>
              Out of Stock
            </Button>
          )}
        </div>

        {/* Low stock warning */}
        {!isOutOfStock && product.inventory <= 5 && (
          <div className="mt-2 text-sm text-orange-600">
            Only {product.inventory} left in stock!
          </div>
        )}
      </CardContent>
    </Card>
  )
}