'use client'

import { useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCartStore, type CartStoreContext } from '@/lib/store/cart'
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
  /**
   * The fundraiser store this button is selling from, if any. Carried onto the cart line so
   * checkout prices and credits the sale through that campaign rather than at retail.
   */
  store?: { slug: string; name: string }
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
  store,
}: AddToCartButtonProps) {
  const addItem = useCartStore((state) => state.addItem)
  const replaceWithItem = useCartStore((state) => state.replaceWithItem)
  const openCart = useCartStore((state) => state.openCart)
  // Set when the cart already holds another store's goods, so the customer can decide
  // rather than have their cart silently emptied or silently mispriced.
  const [conflict, setConflict] = useState<CartStoreContext | undefined>(undefined)

  const isOutOfStock = product.inventory <= 0
  const isDisabled = disabled || isOutOfStock

  const line = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    price: product.price,
    image: product.featuredImage || '/images/placeholder-salsa.jpg',
    sku: product.sku,
    heatLevel: product.heatLevel,
    maxQuantity: product.inventory,
    quantity,
    fundraiserSlug: store?.slug,
    fundraiserName: store?.name,
  }

  const finish = () => {
    setConflict(undefined)
    openCart()
    if (onAddToCart) {
      onAddToCart()
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      onClick(e)
    } else {
      e.preventDefault()
      e.stopPropagation()
    }

    if (isDisabled) return

    const result = addItem(line)
    if (!result.added) {
      setConflict(result.currentStore)
      return
    }

    finish()
  }

  const startNewCart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    replaceWithItem(line)
    finish()
  }

  const conflictNotice = conflict !== undefined && (
    <div
      role="alert"
      className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900"
    >
      <p>
        Your cart holds items from{' '}
        <strong>{conflict?.name ?? 'the Jose Madrid Salsa store'}</strong>
        . Each fundraiser checks out on its own, so you can only shop one at a time.
      </p>
      <div className="mt-2 flex gap-2">
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={startNewCart}>
          Start a new cart
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setConflict(undefined)
          }}
        >
          Keep my cart
        </Button>
      </div>
    </div>
  )

  // Icon-only variant (round button with just icon)
  if (variant === 'icon') {
    return (
      <>
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
      {conflictNotice}
      </>
    )
  }

  // Default variant with text and optional icon
  return (
    <>
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
    {conflictNotice}
    </>
  )
}
