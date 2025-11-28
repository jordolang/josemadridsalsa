'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ShoppingCart, Heart, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useInteractiveCard } from '@/hooks/useInteractiveCard'
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
  const [isQuickViewOpen, setQuickViewOpen] = useState(false)
  const {
    cardRef,
    handlePointerMove,
    handlePointerLeave,
    handlePointerUp,
  } = useInteractiveCard<HTMLDivElement>()

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

  const handleQuickAddToCart = () => {
    handleAddToCart()
    setQuickViewOpen(false)
  }

  const isOutOfStock = product.inventory <= 0
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price
  const discountPercentage = hasDiscount
    ? Math.round(((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100)
    : 0
  const productImage = imageError || !product.featuredImage ? '/images/placeholder-salsa.jpg' : product.featuredImage

  return (
    <Dialog open={isQuickViewOpen} onOpenChange={setQuickViewOpen}>
      <Card
        ref={cardRef}
        className="group interactive-card overflow-hidden"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerUp={handlePointerUp}
      >
        <div className="relative">
          <Link href={`/salsas/${product.slug}`}>
            <div className="relative overflow-hidden bg-muted flex items-center justify-center min-h-[300px]">
              <Image
                src={productImage}
                alt={product.name}
                width={400}
                height={400}
                className="w-full h-auto object-contain transition-transform duration-300 group-hover:scale-105"
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
                    className="h-10 w-10 rounded-full p-0"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setQuickViewOpen(true)
                    }}
                  >
                    <Eye className="h-4 w-4" />
                    <span className="sr-only">Quick view</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-10 w-10 rounded-full p-0"
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
            <h3 className="text-lg font-semibold text-foreground transition-colors hover:text-salsa-600 line-clamp-2">
              {product.name}
            </h3>
          </Link>
          
          {product.description && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
              {product.description}
            </p>
          )}

          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-foreground">
                {formatPrice(product.price)}
              </span>
              {hasDiscount && (
                <span className="text-sm text-muted-foreground line-through">
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

          <div className="mt-2">
            <Button
              variant="link"
              size="sm"
              className="h-auto px-0 text-salsa-600 hover:text-salsa-700"
              onClick={() => setQuickViewOpen(true)}
            >
              Quick view details
            </Button>
          </div>

          {/* Low stock warning */}
          {!isOutOfStock && product.inventory <= 5 && (
            <div className="mt-2 text-sm text-orange-600">
              Only {product.inventory} left in stock!
            </div>
          )}
        </CardContent>
      </Card>

      <DialogContent className="max-w-3xl">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
            <Image
              src={productImage}
              alt={product.name}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          </div>

          <div className="flex flex-col gap-4">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-2xl font-semibold">
                {product.name}
              </DialogTitle>
              {product.description && (
                <DialogDescription className="text-base text-muted-foreground">
                  {product.description}
                </DialogDescription>
              )}
            </DialogHeader>

            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-foreground">
                {formatPrice(product.price)}
              </span>
              {hasDiscount && (
                <span className="text-base text-muted-foreground line-through">
                  {formatPrice(product.compareAtPrice!)}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">Heat level:</span>
                <Badge className={getHeatLevelColor(product.heatLevel)}>
                  {getHeatLevelText(product.heatLevel)}
                </Badge>
              </div>
              <div>
                {isOutOfStock ? (
                  <span className="text-red-600 font-medium">Currently out of stock</span>
                ) : (
                  <span>In stock: {product.inventory}</span>
                )}
              </div>
            </div>

            {!isOutOfStock ? (
              <Button
                size="lg"
                className="bg-salsa-500 hover:bg-salsa-600"
                onClick={handleQuickAddToCart}
              >
                Quick add to cart
              </Button>
            ) : (
              <Button size="lg" disabled>
                Unavailable
              </Button>
            )}

            <Link
              href={`/salsas/${product.slug}`}
              className="text-sm text-salsa-600 hover:text-salsa-700 underline underline-offset-4"
              onClick={() => setQuickViewOpen(false)}
            >
              View full product details
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
