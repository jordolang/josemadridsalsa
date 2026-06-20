'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { ScrollReveal } from '@/components/ui/scroll-reveal'
import { ProductCard, type Product } from '@/components/store/product-card'
import { Skeleton } from '@/components/ui/skeleton'

interface PersonalizedHeroProps {
  /** Maximum number of recommended products to display. Defaults to 6. */
  limit?: number
}

interface RecommendationResponse {
  data: Array<{
    id: string
    name: string
    slug: string
    description: string | null
    price: number
    compareAtPrice: number | null
    featuredImage: string | null
    heatLevel: string
    sku: string
    inventory: number
    isFeatured: boolean
    ingredients: string[] | null
    score?: number
  }>
}

export function PersonalizedHero({ limit = 6 }: PersonalizedHeroProps) {
  const [recommendations, setRecommendations] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchRecommendations() {
      try {
        setIsLoading(true)
        setError(null)
        const response = await fetch(`/api/recommendations/homepage?limit=${limit}`)

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Authentication required')
          }
          throw new Error('Failed to fetch recommendations')
        }

        const data: RecommendationResponse = await response.json()

        // Map API response to Product type
        const products: Product[] = data.data.map(item => ({
          id: item.id,
          name: item.name,
          slug: item.slug,
          description: item.description,
          price: item.price,
          compareAtPrice: item.compareAtPrice,
          featuredImage: item.featuredImage,
          heatLevel: item.heatLevel,
          sku: item.sku,
          inventory: item.inventory,
          isFeatured: item.isFeatured,
          ingredients: item.ingredients,
        }))

        setRecommendations(products)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch recommendations')
        setRecommendations([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchRecommendations()
  }, [limit])

  if (isLoading) {
    return (
      <section className="bg-background py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <Skeleton className="mx-auto mb-3 h-4 w-32" />
            <Skeleton className="mx-auto mb-3 h-12 w-96" />
            <Skeleton className="mx-auto h-6 w-[600px]" />
          </div>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="aspect-square w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  // If error or no recommendations, return null (will fallback to default hero)
  if (error || recommendations.length === 0) {
    return null
  }

  return (
    <section className="bg-background py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="mb-12 text-center">
            <span className="mb-3 inline-block text-xs font-semibold uppercase tracking-widest text-salsa-600">
              Recommended For You
            </span>
            <h2 className="mb-3 font-serif text-4xl font-bold tracking-[-0.02em] text-foreground md:text-5xl">
              Handpicked Based on <span className="text-gradient">Your Taste</span>
            </h2>
            <p className="mx-auto max-w-xl text-muted-foreground">
              We&apos;ve selected these flavors just for you — based on your heat preferences
              and favorite profiles. Each jar is small-batch and handcrafted in Zanesville, Ohio.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-6">
          {recommendations.map((product) => (
            <ScrollReveal key={product.id}>
              <ProductCard product={product} />
            </ScrollReveal>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-7 py-3.5 text-base font-semibold text-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-salsa-300 hover:shadow-md"
          >
            Explore All 25+ Flavors
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
