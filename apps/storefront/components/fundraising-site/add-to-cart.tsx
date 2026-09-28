'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Minus, Plus, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { MAX_LINE_QUANTITY, useFundraisingCart, type FundraisingCartLine } from '@/lib/fundraising-site/cart-store'

type Props = {
  product: Omit<FundraisingCartLine, 'quantity'>
  available: boolean
  /** Show a quantity stepper (product page) rather than a single add button (grid). */
  withQuantity?: boolean
}

export function FundraisingAddToCart({ product, available, withQuantity = false }: Props) {
  const add = useFundraisingCart((state) => state.add)
  const [quantity, setQuantity] = useState(1)

  if (!available) {
    return (
      <Button disabled variant="outline" className="w-full">
        Not available right now
      </Button>
    )
  }

  const handleAdd = () => {
    add(product, withQuantity ? quantity : 1)
    toast.success(`${withQuantity ? quantity : 1} × ${product.name} added`, {
      action: { label: 'View cart', onClick: () => window.location.assign('/cart') },
    })
  }

  return (
    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
      {withQuantity && (
        <div className="flex items-center rounded-md border border-input" role="group" aria-label="Quantity">
          <button
            type="button"
            className="p-3 hover:bg-muted disabled:opacity-40"
            onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            disabled={quantity <= 1}
            aria-label="Fewer jars"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="min-w-10 text-center font-semibold tabular-nums" aria-live="polite">
            {quantity}
          </span>
          <button
            type="button"
            className="p-3 hover:bg-muted disabled:opacity-40"
            onClick={() => setQuantity((value) => Math.min(MAX_LINE_QUANTITY, value + 1))}
            disabled={quantity >= MAX_LINE_QUANTITY}
            aria-label="More jars"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}
      <Button onClick={handleAdd} className="flex-1 bg-salsa-600 hover:bg-salsa-700">
        <ShoppingCart className="mr-2 h-4 w-4" aria-hidden />
        Add to cart
      </Button>
      {withQuantity && (
        <Button asChild variant="outline" className="sm:hidden">
          <Link href="/cart">View cart</Link>
        </Button>
      )}
    </div>
  )
}
