'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Grid3X3, List } from 'lucide-react'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { PullToRefreshIndicator } from '@/components/ui/pull-to-refresh-indicator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ProductCard, type Product } from '@/components/store/product-card'
import { GiftBoxQuickAdd } from '@/components/store/gift-box-quick-add'
import type { PackOverrides } from '@/lib/bundles'
import { typicalJarPrice } from '@/lib/bundles'
import { cn } from '@/lib/utils'

const heatLevels = [
  { value: 'all', label: 'All Heat Levels' },
  { value: 'MILD', label: 'Mild' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HOT', label: 'Hot' },
  { value: 'EXTRA_HOT', label: 'Extra Hot' },
  { value: 'FRUIT', label: 'Fruit Salsas' },
]

interface Category {
  id: string
  name: string
  slug: string
  _count: { products: number }
}

interface SalsasClientProps {
  initialProducts: Product[]
  categories: Category[]
  initialCategory?: string
  initialHeatLevel?: string
  initialSearch?: string
  initialView?: 'grid' | 'list'
  /** Live pack prices and availability from BigCommerce, when the storefront sells through it. */
  packOverrides?: PackOverrides
}

export function SalsasClient({
  initialProducts,
  categories,
  initialCategory,
  initialHeatLevel,
  initialSearch,
  initialView,
  packOverrides,
}: SalsasClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedCategory, setSelectedCategory] = useState(initialCategory || 'all')
  const [selectedHeatLevel, setSelectedHeatLevel] = useState(initialHeatLevel || 'all')
  const [searchTerm, setSearchTerm] = useState(initialSearch || '')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(initialView || 'grid')

  // Update URL when filters change
  const updateFilters = (updates: {
    category?: string
    heatLevel?: string
    search?: string
    view?: 'grid' | 'list'
  }) => {
    const params = new URLSearchParams(searchParams.toString())

    if (updates.category !== undefined) {
      if (updates.category === 'all') {
        params.delete('category')
      } else {
        params.set('category', updates.category)
      }
      setSelectedCategory(updates.category)
    }

    if (updates.heatLevel !== undefined) {
      if (updates.heatLevel === 'all') {
        params.delete('heatLevel')
      } else {
        params.set('heatLevel', updates.heatLevel)
      }
      setSelectedHeatLevel(updates.heatLevel)
    }

    if (updates.search !== undefined) {
      if (!updates.search) {
        params.delete('search')
      } else {
        params.set('search', updates.search)
      }
      setSearchTerm(updates.search)
    }

    if (updates.view !== undefined) {
      if (updates.view === 'grid') {
        params.delete('view')
      } else {
        params.set('view', updates.view)
      }
      setViewMode(updates.view)
    }

    router.push(`/salsas?${params.toString()}`, { scroll: false })
  }

  // Since we're using server-side filtering, we don't need client-side filtering
  const filteredProducts = initialProducts

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
      <section className="bg-card py-12 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold font-serif text-foreground mb-4">
              Our Premium <span className="text-gradient">Salsas</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Discover our complete collection of handcrafted salsas, from mild and family-friendly to scorching hot.
            </p>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="bg-card py-6 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6">
            {/* Search and View Toggle */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Input
                  type="search"
                  placeholder="Search salsas..."
                  value={searchTerm}
                  onChange={(e) => updateFilters({ search: e.target.value })}
                  className="pl-4 pr-4 focus:ring-salsa-500 focus:border-salsa-500"
                />
              </div>

              {/* View Toggle */}
              <div className="flex border rounded-md overflow-hidden">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => updateFilters({ view: 'grid' })}
                  className={cn(
                    'rounded-none border-0',
                    viewMode === 'grid' && 'bg-salsa-500 hover:bg-salsa-600'
                  )}
                  aria-label="Grid view"
                >
                  <Grid3X3 className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => updateFilters({ view: 'list' })}
                  className={cn(
                    'rounded-none border-0 border-l',
                    viewMode === 'list' && 'bg-salsa-500 hover:bg-salsa-600'
                  )}
                  aria-label="List view"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Category Filter */}
            {categories.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium text-muted-foreground">Categories</h3>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={selectedCategory === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateFilters({ category: 'all' })}
                    className={selectedCategory === 'all' ? 'bg-salsa-500 hover:bg-salsa-600' : ''}
                  >
                    All Categories
                  </Button>
                  {categories.map((category) => (
                    <Button
                      key={category.slug}
                      variant={selectedCategory === category.slug ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => updateFilters({ category: category.slug })}
                      className={selectedCategory === category.slug ? 'bg-salsa-500 hover:bg-salsa-600' : ''}
                    >
                      {category.name} ({category._count.products})
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Heat Level Filter */}
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-muted-foreground">Heat Level</h3>
              <div className="flex flex-wrap gap-2">
                {heatLevels.map((level) => (
                  <Button
                    key={level.value}
                    variant={selectedHeatLevel === level.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateFilters({ heatLevel: level.value })}
                    className={selectedHeatLevel === level.value ? 'bg-salsa-500 hover:bg-salsa-600' : ''}
                  >
                    {level.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 text-sm text-muted-foreground">
            Showing {filteredProducts.length} salsas
          </div>
        </div>
      </section>

      {/* Gift Box Quick Add */}
      <GiftBoxQuickAdd jarPrice={typicalJarPrice(initialProducts.map((product) => product.price))} packOverrides={packOverrides} />

      {/* Products Grid */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">No salsas found matching your criteria.</p>
              <Button
                onClick={() => {
                  router.push('/salsas')
                  setSearchTerm('')
                  setSelectedCategory('all')
                  setSelectedHeatLevel('all')
                }}
                className="mt-4 bg-salsa-500 hover:bg-salsa-600"
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            <div
              className={cn(
                viewMode === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8'
                  : 'flex flex-col gap-6'
              )}
            >
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
