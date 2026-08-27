'use client'

import Image from 'next/image'
import Link from 'next/link'
import { X, Plus, Minus, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCartStore } from '@/lib/store/cart'
import { formatPrice, getHeatLevelColor, getHeatLevelText } from '@/lib/utils'

export function CartSidebar() {
  const {
    items,
    isOpen,
    closeCart,
    removeItem,
    updateQuantity,
  } = useCartStore()

  // Use selectors for computed values
  const itemsCount = useCartStore((state) =>
    state.items.reduce((total, item) => total + item.quantity, 0)
  )
  const total = useCartStore((state) =>
    state.items.reduce((total, item) => total + item.price * item.quantity, 0)
  )

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
        onClick={closeCart}
      />

      {/* Sidebar */}
      <div className="surface-shadow fixed right-0 top-0 z-50 h-full w-full max-w-md border-l border-border bg-card text-card-foreground transition-transform duration-300 ease-in-out">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground">
              Shopping Cart ({itemsCount})
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={closeCart}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close cart</span>
            </Button>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {items.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <ShoppingBag className="mb-4 h-16 w-16 text-muted-foreground opacity-60" />
                <h3 className="mb-2 text-lg font-medium text-foreground">
                  Your cart is empty
                </h3>
                <p className="mb-6 text-sm text-muted-foreground">
                  Add some delicious salsa to get started!
                </p>
                <Button onClick={closeCart} asChild>
                  <Link href="/salsas">
                    Shop Salsas
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => {
                  // A pack is priced as a whole, so its jars are added and removed together.
                  const isBundleItem = Boolean(item.bundleGroupId)
                  return (
                  <div key={item.id} className="flex items-center space-x-4 rounded-xl bg-muted p-3 transition hover:bg-card">
                    <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-sm font-medium text-foreground">
                        {item.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={`text-xs ${getHeatLevelColor(item.heatLevel)}`}>
                          {getHeatLevelText(item.heatLevel)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{item.sku}</span>
                      </div>
                      {isBundleItem && item.bundleName && (
                        <p className="mt-1 text-xs font-medium text-salsa-600">
                          Part of your {item.bundleName}
                        </p>
                      )}
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {formatPrice(item.price)}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      {isBundleItem ? (
                        <span className="text-sm font-medium text-muted-foreground">
                          Qty {item.quantity}
                        </span>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>

                          <span className="text-sm font-medium w-8 text-center">
                            {item.quantity}
                          </span>

                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            disabled={item.quantity >= (item.maxQuantity || 99)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.id)}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                      <span className="sr-only">
                        {isBundleItem ? 'Remove pack' : 'Remove item'}
                      </span>
                    </Button>
                  </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="border-t border-border px-6 py-4 space-y-4">
              <div className="flex items-center justify-between text-lg font-semibold">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </div>
              
              <div className="space-y-2">
                <Button asChild className="w-full bg-salsa-500 hover:bg-salsa-600">
                  <Link href="/checkout" onClick={closeCart}>
                    Checkout
                  </Link>
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full"
                  asChild
                >
                  <Link href="/cart" onClick={closeCart}>
                    View Cart
                  </Link>
                </Button>
              </div>
              
              <p className="text-center text-xs text-muted-foreground">
                Shipping calculated at checkout
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
