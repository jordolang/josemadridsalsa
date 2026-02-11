'use client'

import { useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCartStore } from '@/lib/store/cart'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export interface AddToCartButtonProduct {
  id: string
  name: string
  slug: string
  price: number
  image: string
  sku: string
  heatLevel: string
  inventory: number
}

interface AddToCartButtonProps {
  product: AddToCartButtonProduct
  quantity?: number
  size?: 'sm' | 'default' | 'lg'
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link'
  className?: string
  showIcon?: boolean
  children?: React.ReactNode
  onAddToCart?: () => void
}

export function AddToCartButton({
  product,
  quantity = 1,
  size = 'default',
  variant = 'default',
  className,
  showIcon = true,
  children,
  onAddToCart,
}: AddToCartButtonProps) {
  const addItem = useCartStore((state) => state.addItem)
  const openCart = useCartStore((state) => state.openCart)
  const [isAdding, setIsAdding] = useState(false)

  const isOutOfStock = product.inventory <= 0
  const effectiveQuantity = Math.min(quantity, product.inventory)

  const handleAddToCart = async () => {
    if (isOutOfStock || isAdding) return

    setIsAdding(true)

    try {
      addItem({
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: product.price,
        image: product.image,
        sku: product.sku,
        heatLevel: product.heatLevel,
        maxQuantity: product.inventory,
        quantity: effectiveQuantity,
      })

      // Show success feedback
      toast.success(`Added ${product.name} to cart`)

      // Open cart sidebar
      openCart()

      // Call optional callback
      onAddToCart?.()
    } catch (error) {
      toast.error('Failed to add item to cart')
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <Button
      onClick={handleAddToCart}
      size={size}
      variant={variant}
      disabled={isOutOfStock || isAdding}
      className={cn(
        'bg-salsa-500 hover:bg-salsa-600',
        className
      )}
      aria-label={isOutOfStock ? 'Out of stock' : `Add ${product.name} to cart`}
    >
      {showIcon && <ShoppingCart className="w-4 h-4" />}
      {children || (isOutOfStock ? 'Out of Stock' : 'Add to Cart')}
    </Button>
  )
}
