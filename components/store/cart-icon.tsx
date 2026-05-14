'use client'

import { ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCartStore } from '@/lib/store/cart'
import { cn } from '@/lib/utils'

interface CartIconProps {
  variant?: 'default' | 'ghost'
  size?: 'sm' | 'default' | 'lg'
  className?: string
  showBadge?: boolean
}

export function CartIcon({
  variant = 'ghost',
  size = 'sm',
  className,
  showBadge = true,
}: CartIconProps) {
  const toggleCart = useCartStore((state) => state.toggleCart)
  const cartItemCount = useCartStore((state) => state.totalItems)

  return (
    <Button
      variant={variant}
      size={size}
      onClick={toggleCart}
      className={cn('relative p-1.5', className)}
      aria-label={`Shopping cart with ${cartItemCount} items`}
    >
      <ShoppingCart className="w-4 h-4" />
      {showBadge && cartItemCount > 0 && (
        <Badge
          variant="destructive"
          className="absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center p-0 text-[10px] bg-salsa-500"
          aria-label={`${cartItemCount} items in cart`}
        >
          {cartItemCount}
        </Badge>
      )}
    </Button>
  )
}
