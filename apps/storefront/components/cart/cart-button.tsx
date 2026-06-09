'use client'

import { ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCartStore } from '@/lib/store/cart'

export function CartButton() {
  const { totalItems, toggleCart } = useCartStore()
  const count = totalItems()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleCart}
      className="relative"
      aria-label="Shopping cart"
    >
      <ShoppingCart className="h-5 w-5" />
      {count > 0 && (
        <Badge
          variant="destructive"
          className="absolute -top-1 -right-1 h-5 min-w-5 rounded-full p-0 flex items-center justify-center"
        >
          {count}
        </Badge>
      )}
    </Button>
  )
}
