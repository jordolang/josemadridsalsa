'use client'

import { useEffect, useState } from 'react'
import { ProductCard } from './product-card'
import { Skeleton } from '@/components/ui/skeleton'

interface RecommendedProduct {
  id: string
  name: string
  slug: string
  price: number
  featuredImage: string | null
  heatLevel: string | null
  sku: string
  inventory: number
  score: number
}

interface ProductRecommendationsProps {
  productId: string
  title?: string
  type?: 'frequently-bought' | 'similar' | 'all'
  limit?: number
}

export function ProductRecommendations({
  productId,
  title = 'You May Also Like',
  type = 'all',
  limit = 8,
}: ProductRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<RecommendedProduct[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchRecommendations() {
      try {
        setIsLoading(true)
        const response = await fetch(
          `/api/products/${productId}/recommendations?type=${type}&limit=${limit}`
        )

        if (!response.ok) {
          throw new Error('Failed to fetch recommendations')
        }

        const data = await response.json()

        // Combine both types if type is 'all'
        const combined =
          type === 'all'
            ? [...(data.frequentlyBoughtTogether || []), ...(data.youMayAlsoLike || [])]
            : type === 'frequently-bought'
            ? data.frequentlyBoughtTogether || []
            : data.youMayAlsoLike || []

        setRecommendations(combined.slice(0, limit))
      } catch (error) {
        console.error('Error fetching recommendations:', error)
        setRecommendations([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchRecommendations()
  }, [productId, type, limit])

  if (isLoading) {
    return (
      <section className="py-12">
        <h2 className="text-3xl font-bold mb-8">{title}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (recommendations.length === 0) {
    return null
  }

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold mb-8">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {recommendations.map(product => (
          <ProductCard
            key={product.id}
            product={{
              id: product.id,
              name: product.name,
              slug: product.slug,
              description: null,
              price: product.price,
              featuredImage: product.featuredImage,
              heatLevel: product.heatLevel || 'MEDIUM',
              sku: product.sku,
              inventory: product.inventory,
              isFeatured: false,
            }}
          />
        ))}
      </div>
    </section>
  )
}

export function FrequentlyBoughtTogether({ productId }: { productId: string }) {
  return (
    <ProductRecommendations
      productId={productId}
      title="Frequently Bought Together"
      type="frequently-bought"
      limit={4}
    />
  )
}

export function YouMayAlsoLike({ productId }: { productId: string }) {
  return (
    <ProductRecommendations
      productId={productId}
      title="You May Also Like"
      type="similar"
      limit={8}
    />
  )
}
