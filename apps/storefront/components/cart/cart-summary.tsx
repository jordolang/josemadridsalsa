'use client'

import { Card, CardContent } from '@/components/ui/card'
import { useCartStore } from '@/lib/store/cart'

export function CartSummary() {
  const totalPrice = useCartStore((state) => state.totalPrice())
  const totalItems = useCartStore((state) => state.totalItems())

  // Format price to USD currency
  const formattedTotal = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(totalPrice)

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Subtotal ({totalItems} {totalItems === 1 ? 'item' : 'items'})
            </span>
            <span className="font-medium">{formattedTotal}</span>
          </div>

          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold">Total</span>
              <span className="text-lg font-semibold">{formattedTotal}</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Shipping and taxes calculated at checkout
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
