'use client'

import { useEffect, useState } from 'react'
import { useRecentlyViewedStore } from '@/lib/store/recently-viewed'
import { ProductCard } from './product-card'

export function RecentlyViewedProducts({ currentProductId }: { currentProductId?: string }) {
  const [mounted, setMounted] = useState(false)
  const getRecent = useRecentlyViewedStore((state) => state.getRecent)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  const recentProducts = getRecent(8).filter(p => p.id !== currentProductId)

  if (recentProducts.length === 0) {
    return null
  }

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold mb-8">Recently Viewed</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {recentProducts.map(product => (
          <ProductCard
            key={product.id}
            product={{
              id: product.id,
              name: product.name,
              slug: product.slug,
              description: null,
              price: product.price,
              featuredImage: product.image,
              heatLevel: product.heatLevel,
              sku: '',
              inventory: 1,
              isFeatured: false,
            }}
          />
        ))}
      </div>
    </section>
  )
}
