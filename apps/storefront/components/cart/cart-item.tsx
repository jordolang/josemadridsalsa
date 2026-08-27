'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CartItem as CartItemType } from '@/lib/store/cart'
import { formatPrice } from '@/lib/utils'

interface CartItemProps {
  item: CartItemType
  onUpdateQuantity: (id: string, quantity: number) => void
  onRemove: (id: string) => void
  onNavigate?: () => void
}

export function CartItem({ item, onUpdateQuantity, onRemove, onNavigate }: CartItemProps) {
  const handleDecrease = () => {
    onUpdateQuantity(item.id, item.quantity - 1)
  }

  const handleIncrease = () => {
    onUpdateQuantity(item.id, item.quantity + 1)
  }

  const handleRemove = () => {
    onRemove(item.id)
  }

  const isAtMaxQuantity = item.maxQuantity ? item.quantity >= item.maxQuantity : false
  // A pack is priced as a whole, so its jars cannot be added or dropped one at a time.
  const isBundleItem = Boolean(item.bundleGroupId)

  return (
    <div className="flex gap-4 py-4 border-b last:border-0">
      <div className="relative h-20 w-20 flex-shrink-0 rounded-md overflow-hidden bg-muted">
        <Image
          src={item.image}
          alt={item.name}
          fill
          className="object-cover"
        />
      </div>

      <div className="flex-1 space-y-1">
        <Link
          href={`/products/${item.slug}`}
          onClick={onNavigate}
          className="font-medium hover:underline line-clamp-1"
        >
          {item.name}
        </Link>
        <p className="text-sm text-muted-foreground">
          Heat: {item.heatLevel}
        </p>
        {isBundleItem && item.bundleName && (
          <p className="text-xs font-medium text-salsa-600">
            Part of your {item.bundleName}
          </p>
        )}
        <p className="text-sm font-semibold">
          {formatPrice(item.price)}
        </p>

        <div className="flex items-center gap-2 pt-1">
          {isBundleItem ? (
            <span className="text-sm text-muted-foreground">
              Qty {item.quantity}
            </span>
          ) : (
            <>
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 min-h-[44px] min-w-[44px]"
                onClick={handleDecrease}
                disabled={item.quantity <= 1}
                aria-label="Decrease quantity"
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-8 text-center text-sm font-medium">
                {item.quantity}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 min-h-[44px] min-w-[44px]"
                onClick={handleIncrease}
                disabled={isAtMaxQuantity}
                aria-label="Increase quantity"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 min-h-[44px] min-w-[44px] ml-auto"
            onClick={handleRemove}
            aria-label={isBundleItem ? 'Remove pack' : 'Remove item'}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  )
}
