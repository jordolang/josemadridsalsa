'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Trash2, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useWishlistStore, WishlistItem } from '@/lib/store/wishlist'
import { useCartStore } from '@/lib/store/cart'
import { formatPrice, getHeatLevelColor, getHeatLevelText } from '@/lib/utils'
import { useState } from 'react'

interface WishlistItemCardProps {
  item: WishlistItem
}

export function WishlistItemCard({ item }: WishlistItemCardProps) {
  const removeItem = useWishlistStore((state) => state.removeItem)
  const addToCart = useCartStore((state) => state.addItem)
  const openCart = useCartStore((state) => state.openCart)
  const [imageError, setImageError] = useState(false)

  const handleAddToCart = () => {
    addToCart({
      id: item.productId,
      name: item.name,
      slug: item.slug,
      price: item.price,
      image: item.image || '/images/placeholder-salsa.jpg',
      sku: item.sku,
      heatLevel: item.heatLevel,
      maxQuantity: item.inventory,
    })
    openCart()
  }

  const handleRemove = () => {
    removeItem(item.productId)
  }

  const isOutOfStock = item.inventory <= 0
  const hasDiscount = item.compareAtPrice && item.compareAtPrice > item.price
  const discountPercentage = hasDiscount
    ? Math.round(((item.compareAtPrice! - item.price) / item.compareAtPrice!) * 100)
    : 0
  const productImage = imageError || !item.image ? '/images/placeholder-salsa.jpg' : item.image

  return (
    <Card className="group overflow-hidden">
      <div className="relative">
        <Link href={`/salsas/${item.slug}`}>
          <div className="relative overflow-hidden bg-muted flex items-center justify-center min-h-[250px]">
            <Image
              src={productImage}
              alt={item.name}
              width={300}
              height={300}
              className="w-full h-auto object-contain transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              onError={() => setImageError(true)}
            />

            {/* Badges */}
            <div className="absolute top-3 left-3 flex flex-col gap-2">
              {hasDiscount && (
                <Badge className="bg-green-500 text-white hover:bg-green-600">
                  {discountPercentage}% OFF
                </Badge>
              )}
              {isOutOfStock && (
                <Badge variant="destructive">Out of Stock</Badge>
              )}
            </div>

            {/* Heat Level Badge */}
            <div className="absolute top-3 right-3">
              <Badge className={getHeatLevelColor(item.heatLevel)}>
                {getHeatLevelText(item.heatLevel)}
              </Badge>
            </div>
          </div>
        </Link>
      </div>

      <CardContent className="p-4">
        <Link href={`/salsas/${item.slug}`}>
          <h3 className="text-lg font-semibold text-foreground transition-colors hover:text-salsa-600 line-clamp-2 mb-2">
            {item.name}
          </h3>
        </Link>

        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-xl font-bold text-foreground">
            {formatPrice(item.price)}
          </span>
          {hasDiscount && (
            <span className="text-sm text-muted-foreground line-through">
              {formatPrice(item.compareAtPrice!)}
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleRemove}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Remove
          </Button>

          {!isOutOfStock && (
            <Button
              onClick={handleAddToCart}
              size="sm"
              className="flex-1 bg-salsa-500 hover:bg-salsa-600"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Add to Cart
            </Button>
          )}
        </div>

        {isOutOfStock && (
          <p className="text-sm text-destructive mt-2 text-center">
            Currently unavailable
          </p>
        )}
      </CardContent>
    </Card>
  )
}
