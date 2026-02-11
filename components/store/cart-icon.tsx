'use client'

import { ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCartStore } from '@/lib/store/cart'
import { cn } from '@/lib/utils'

interface CartIconProps {
  className?: string
  size?: 'sm' | 'default' | 'lg'
  showBadge?: boolean
}

export function CartIcon({
  className,
  size = 'sm',
  showBadge = true
}: CartIconProps) {
  const { totalItems, toggleCart } = useCartStore()

  const itemCount = totalItems()

  const iconSize = {
    sm: 'h-4 w-4',
    default: 'h-5 w-5',
    lg: 'h-6 w-6',
  }[size]

  const buttonSize = {
    sm: 'p-1.5',
    default: 'p-2',
    lg: 'p-2.5',
  }[size]

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={toggleCart}
      className={cn('relative', buttonSize, className)}
      aria-label={`Shopping cart with ${itemCount} items`}
    >
      <ShoppingCart className={iconSize} />
      {showBadge && itemCount > 0 && (
        <Badge
          variant="destructive"
          className="absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center p-0 text-[10px] bg-salsa-500 hover:bg-salsa-600"
        >
          {itemCount}
        </Badge>
      )}
    </Button>
  )
}
