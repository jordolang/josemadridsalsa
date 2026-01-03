'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ShoppingCart, Heart, X } from 'lucide-react'
import { useCartStore } from '@/lib/store/cart'
import { useWishlistStore } from '@/lib/store/wishlist'
import Image from 'next/image'
import Link from 'next/link'
import { toast } from 'sonner'

interface QuickViewProduct {
  id: string
  name: string
  slug: string
  description: string | null
  price: number
  featuredImage: string | null
  heatLevel: string
  sku: string
  inventory: number
}

interface QuickViewModalProps {
  product: QuickViewProduct | null
  isOpen: boolean
  onClose: () => void
}

export function QuickViewModal({ product, isOpen, onClose }: QuickViewModalProps) {
  const [quantity, setQuantity] = useState(1)
  const addItem = useCartStore((state) => state.addItem)
  const { addItem: addToWishlist, isInWishlist } = useWishlistStore()
  const [imageError, setImageError] = useState(false)

  if (!product) return null

  const inWishlist = isInWishlist(product.id)
  const isOutOfStock = product.inventory <= 0

  const handleAddToCart = () => {
    if (isOutOfStock) return

    addItem({
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      image: product.featuredImage || '/images/placeholder.png',
      quantity,
      sku: product.sku,
      heatLevel: product.heatLevel,
      maxQuantity: product.inventory,
    })

    toast.success(`Added ${quantity} ${product.name} to cart`)
    onClose()
  }

  const handleToggleWishlist = () => {
    if (inWishlist) {
      toast.info('Removed from wishlist')
    } else {
      addToWishlist(product.id)
      toast.success('Added to wishlist')
    }
  }

  const getHeatLevelColor = (level: string) => {
    const colors: Record<string, string> = {
      MILD: 'bg-green-100 text-green-800',
      MEDIUM: 'bg-yellow-100 text-yellow-800',
      HOT: 'bg-orange-100 text-orange-800',
      'EXTRA HOT': 'bg-red-100 text-red-800',
    }
    return colors[level] || 'bg-gray-100 text-gray-800'
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Product Image */}
          <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
            <Image
              src={
                imageError || !product.featuredImage
                  ? '/images/placeholder.png'
                  : product.featuredImage
              }
              alt={product.name}
              fill
              className="object-cover"
              onError={() => setImageError(true)}
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>

          {/* Product Details */}
          <div className="flex flex-col gap-6">
            <div>
              <DialogTitle className="text-3xl font-bold mb-2">
                {product.name}
              </DialogTitle>
              <div className="flex items-center gap-2 mb-4">
                <Badge className={getHeatLevelColor(product.heatLevel)}>
                  {product.heatLevel}
                </Badge>
                {isOutOfStock && (
                  <Badge variant="destructive">Out of Stock</Badge>
                )}
              </div>
              <p className="text-3xl font-bold text-salsa-600">
                ${product.price.toFixed(2)}
              </p>
            </div>

            {product.description && (
              <p className="text-gray-600 line-clamp-4">{product.description}</p>
            )}

            {/* Quantity Selector */}
            {!isOutOfStock && (
              <div className="flex items-center gap-4">
                <label className="font-semibold">Quantity:</label>
                <div className="flex items-center border rounded-lg">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-4 py-2 hover:bg-gray-100"
                    disabled={quantity <= 1}
                  >
                    -
                  </button>
                  <span className="px-6 py-2 border-x">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(product.inventory, quantity + 1))}
                    className="px-4 py-2 hover:bg-gray-100"
                    disabled={quantity >= product.inventory}
                  >
                    +
                  </button>
                </div>
                <span className="text-sm text-gray-500">
                  {product.inventory} available
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className="flex-1"
                size="lg"
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
              </Button>
              <Button
                variant={inWishlist ? 'default' : 'outline'}
                size="lg"
                onClick={handleToggleWishlist}
                className="px-4"
              >
                <Heart className={`w-5 h-5 ${inWishlist ? 'fill-current' : ''}`} />
              </Button>
            </div>

            {/* View Full Details Link */}
            <Link
              href={`/salsas/${product.slug}`}
              className="text-salsa-600 hover:text-salsa-700 font-semibold text-center"
              onClick={onClose}
            >
              View Full Details →
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
