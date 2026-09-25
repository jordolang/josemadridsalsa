'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { CartItem } from '@/lib/store/cart'
import { getReferralCodeFromCookie } from '@/lib/fundraising/referral-tracker.client'

/**
 * Sends a retail cart to BigCommerce's hosted checkout. The cart is rebuilt in
 * BigCommerce, which prices it, takes payment and creates the order. A cart
 * that turns out to be a fundraiser sale (by referral) is handed back via
 * `onSiteCheckout` to this site's own checkout.
 */
export function BigCommerceCheckoutHandoff({
  items,
  onSiteCheckout,
}: {
  items: CartItem[]
  onSiteCheckout: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    // The cart is read once: it is loaded from storage before the first
    // client render, and a second request would build a second cart.
    if (started.current || items.length === 0) return
    started.current = true

    fetch('/api/checkout/bigcommerce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: items.map((item) => ({
          slug: item.slug,
          name: item.name,
          quantity: item.quantity,
          bundleId: item.bundleId,
          bundleGroupId: item.bundleGroupId,
        })),
        referralCode: getReferralCodeFromCookie() || undefined,
      }),
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          checkoutUrl?: string
          siteCheckout?: boolean
          error?: string
        }
        if (res.ok && data.siteCheckout) return onSiteCheckout()
        if (!res.ok || !data.checkoutUrl) throw new Error(data.error || 'Checkout is unavailable right now.')
        window.location.assign(data.checkoutUrl)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Checkout is unavailable right now.')
      })
  }, [items, onSiteCheckout])

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="mb-4 text-3xl font-bold text-gray-900">Your cart is empty</h1>
        <Button asChild>
          <Link href="/salsas">Shop salsas</Link>
        </Button>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="mb-4 text-3xl font-bold text-gray-900">We couldn&apos;t start checkout</h1>
        <p className="mb-6 text-gray-600">{error}</p>
        <Button asChild>
          <Link href="/cart">Back to cart</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center" role="status" aria-live="polite">
      <h1 className="mb-4 text-3xl font-bold text-gray-900">Taking you to secure checkout…</h1>
      <p className="text-gray-600">This only takes a moment.</p>
    </div>
  )
}
