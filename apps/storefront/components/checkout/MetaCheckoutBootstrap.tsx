'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useCartStore, type CartItem } from '@/lib/store/cart'

/** sessionStorage key holding a coupon carried over from a Meta checkout link. */
export const META_CHECKOUT_COUPON_KEY = 'metaCheckoutCoupon'

interface MetaCheckoutBootstrapProps {
  items: CartItem[]
  coupon: string | null
  unresolvedCount: number
}

/**
 * Hydrates the cart from a Meta Commerce checkout link, then forwards the
 * shopper into the normal `/checkout` flow.
 *
 * Replaces the existing cart so a shop link always reflects exactly what the
 * buyer selected on Facebook/Instagram. The coupon is stashed in sessionStorage
 * for the checkout flow to pick up; the current checkout UI does not yet have a
 * discount-application step, so it is captured but not auto-applied.
 */
export function MetaCheckoutBootstrap({
  items,
  coupon,
  unresolvedCount,
}: MetaCheckoutBootstrapProps) {
  const router = useRouter()
  const clearCart = useCartStore((state) => state.clearCart)
  const addItem = useCartStore((state) => state.addItem)
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    clearCart()
    for (const item of items) {
      addItem(item)
    }

    if (coupon) {
      try {
        window.sessionStorage.setItem(META_CHECKOUT_COUPON_KEY, coupon)
      } catch {
        // sessionStorage can be unavailable (private mode); coupon is optional.
      }
    } else {
      try {
        window.sessionStorage.removeItem(META_CHECKOUT_COUPON_KEY)
      } catch {
        // ignore
      }
    }

    router.replace('/checkout')
  }, [items, coupon, addItem, clearCart, router])

  return (
    <div className="container mx-auto px-4 py-24">
      <div className="max-w-md mx-auto text-center">
        <Loader2 className="h-10 w-10 mx-auto mb-4 animate-spin text-primary" />
        <h1 className="text-xl font-semibold mb-2">Preparing your checkout…</h1>
        <p className="text-muted-foreground">
          We&apos;re loading your salsas from the shop.
        </p>
        {unresolvedCount > 0 && (
          <p className="text-sm text-muted-foreground mt-4">
            {unresolvedCount} item{unresolvedCount === 1 ? '' : 's'} from your link
            {unresolvedCount === 1 ? ' is' : ' are'} no longer available and{' '}
            {unresolvedCount === 1 ? 'was' : 'were'} skipped.
          </p>
        )}
      </div>
    </div>
  )
}
