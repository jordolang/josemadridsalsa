'use client'

import { ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCartStore } from '@/lib/store/cart'
import { cn } from '@/lib/utils'

export interface AddToCartButtonProduct {
  id: string
  name: string
  slug: string
  price: number
  featuredImage: string | null
  sku: string
  heatLevel: string
  inventory: number
}

export interface AddToCartButtonProps {
  product: AddToCartButtonProduct
  quantity?: number
  variant?: 'default' | 'icon' | 'ghost'
  size?: 'sm' | 'default' | 'lg'
  className?: string
  disabled?: boolean
  showIcon?: boolean
  children?: React.ReactNode
  onAddToCart?: () => void
  onClick?: (e: React.MouseEvent) => void
}

export function AddToCartButton({
  product,
  quantity = 1,
  variant = 'default',
  size = 'sm',
  className,
  disabled = false,
  showIcon = true,
  children,
  onAddToCart,
  onClick,
}: AddToCartButtonProps) {
  const addItem = useCartStore((state) => state.addItem)
  const openCart = useCartStore((state) => state.openCart)

  const isOutOfStock = product.inventory <= 0
  const isDisabled = disabled || isOutOfStock

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      onClick(e)
    } else {
      e.preventDefault()
      e.stopPropagation()
    }

    if (isDisabled) return

    addItem({
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      image: product.featuredImage || '/images/placeholder-salsa.jpg',
      sku: product.sku,
      heatLevel: product.heatLevel,
      maxQuantity: product.inventory,
      quantity,
    })
    openCart()

    // Call optional callback
    if (onAddToCart) {
      onAddToCart()
    }
  }

  // Icon-only variant (round button with just icon)
  if (variant === 'icon') {
    return (
      <Button
        size={size}
        disabled={isDisabled}
        className={cn(
          'h-9 w-9 rounded-full p-0 bg-salsa-500 hover:bg-salsa-600 shadow-lg',
          className
        )}
        onClick={handleClick}
        aria-label={isOutOfStock ? 'Out of stock' : 'Add to cart'}
      >
        <ShoppingCart className="h-4 w-4" />
        <span className="sr-only">{isOutOfStock ? 'Out of stock' : 'Add to cart'}</span>
      </Button>
    )
  }

  // Default variant with text and optional icon
  return (
    <Button
      size={size}
      variant={variant === 'ghost' ? 'ghost' : 'default'}
      disabled={isDisabled}
      className={cn(
        variant === 'default' && 'bg-salsa-500 hover:bg-salsa-600',
        className
      )}
      onClick={handleClick}
      aria-label={isOutOfStock ? 'Out of stock' : 'Add to cart'}
    >
      {showIcon && <ShoppingCart className="h-4 w-4 mr-2" />}
      {children || (isOutOfStock ? 'Out of Stock' : 'Add to Cart')}
    </Button>
  )
}
