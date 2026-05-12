'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Plus, Minus, X, ShoppingBag, ArrowLeft } from 'lucide-react'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { PullToRefreshIndicator } from '@/components/ui/pull-to-refresh-indicator'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCartStore } from '@/lib/store/cart'
import { formatPrice, getHeatLevelColor, getHeatLevelText } from '@/lib/utils'

export function CartClient() {
  const router = useRouter()
  const {
    items,
    removeItem,
    updateQuantity,
    totalItems,
    totalPrice,
  } = useCartStore()

  const itemsCount = totalItems()
  const total = totalPrice()

  const handleRefresh = useCallback(async () => {
    router.refresh()
    // Small delay so user sees the refresh animation
    await new Promise((resolve) => setTimeout(resolve, 500))
  }, [router])

  const { isRefreshing, pullDistance, handlers } = usePullToRefresh({
    onRefresh: handleRefresh,
  })

  return (
    <main
      className="min-h-screen bg-background"
      style={{ overscrollBehavior: 'none' }}
      {...handlers}
    >
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />

      {/* Header */}
      <section className="bg-card py-8 border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/salsas')}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Continue Shopping
            </Button>
          </div>
          <div className="text-center">
            <h1 className="text-4xl font-bold font-serif text-foreground mb-2">
              Shopping <span className="text-gradient">Cart</span>
            </h1>
            <p className="text-muted-foreground">
              {itemsCount === 0 ? 'Your cart is empty' : `${itemsCount} ${itemsCount === 1 ? 'item' : 'items'} in your cart`}
            </p>
          </div>
        </div>
      </section>

      {/* Cart Content */}
      <section className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ShoppingBag className="mb-6 h-24 w-24 text-muted-foreground opacity-40" />
              <h2 className="mb-2 text-2xl font-semibold text-foreground">
                Your cart is empty
              </h2>
              <p className="mb-8 text-muted-foreground max-w-md">
                Add some delicious salsa to get started! Browse our collection of handcrafted salsas.
              </p>
              <Button asChild className="bg-salsa-500 hover:bg-salsa-600">
                <Link href="/salsas">
                  Shop Salsas
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-8 lg:grid-cols-3">
              {/* Cart Items */}
              <div className="lg:col-span-2 space-y-4">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 rounded-xl bg-card border border-border p-4 transition hover:border-salsa-500"
                  >
                    <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        className="object-cover"
                        sizes="96px"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        {item.name}
                      </h3>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={`text-xs ${getHeatLevelColor(item.heatLevel)}`}>
                          {getHeatLevelText(item.heatLevel)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{item.sku}</span>
                      </div>
                      <p className="text-lg font-medium text-foreground">
                        {formatPrice(item.price)}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(item.id)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500"
                      >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Remove item</span>
                      </Button>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>

                        <span className="text-sm font-medium w-10 text-center">
                          {item.quantity}
                        </span>

                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          disabled={item.quantity >= (item.maxQuantity || 99)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Order Summary */}
              <div className="lg:col-span-1">
                <div className="rounded-xl bg-card border border-border p-6 sticky top-4">
                  <h2 className="text-xl font-semibold text-foreground mb-4">
                    Order Summary
                  </h2>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Subtotal ({itemsCount} {itemsCount === 1 ? 'item' : 'items'})</span>
                      <span>{formatPrice(total)}</span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Shipping</span>
                      <span className="text-sm">Calculated at checkout</span>
                    </div>
                    <div className="border-t border-border pt-3 flex items-center justify-between text-lg font-semibold">
                      <span>Total</span>
                      <span>{formatPrice(total)}</span>
                    </div>
                  </div>

                  <Button asChild className="w-full bg-salsa-500 hover:bg-salsa-600 mb-3">
                    <Link href="/checkout">
                      Proceed to Checkout
                    </Link>
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => router.push('/salsas')}
                  >
                    Continue Shopping
                  </Button>

                  <p className="text-center text-xs text-muted-foreground mt-4">
                    Free shipping on orders over $50
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
