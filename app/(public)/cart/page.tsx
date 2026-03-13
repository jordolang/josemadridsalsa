'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCartStore } from '@/lib/store/cart'

export default function CartPage() {
  const router = useRouter()
  const { items, openCart } = useCartStore()

  useEffect(() => {
    // If cart has items, open the sidebar and redirect to checkout
    if (items.length > 0) {
      openCart()
      router.push('/checkout')
    } else {
      // If cart is empty, redirect to products
      router.push('/salsas')
    }
  }, [items, openCart, router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="animate-pulse text-muted-foreground">
        Loading cart...
      </div>
    </div>
  )
}
