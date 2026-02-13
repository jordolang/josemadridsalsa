'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ProductCard, type Product } from '@/components/store/product-card'
import { GiftBoxQuickAdd } from '@/components/store/gift-box-quick-add'

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

interface ProductsClientProps {
  initialProducts: Product[]
  categories: Category[]
  initialCategory?: string
  initialHeatLevel?: string
  initialSearch?: string
}

export function ProductsClient({
  initialProducts,
  categories,
  initialCategory,
  initialHeatLevel,
  initialSearch,
}: ProductsClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedCategory, setSelectedCategory] = useState(initialCategory || 'all')
  const [selectedHeatLevel, setSelectedHeatLevel] = useState(initialHeatLevel || 'all')
  const [searchTerm, setSearchTerm] = useState(initialSearch || '')

  // Update URL when filters change
  const updateFilters = (updates: {
    category?: string
    heatLevel?: string
    search?: string
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

    router.push(`/products?${params.toString()}`, { scroll: false })
  }

  // Since we're using server-side filtering, we don't need client-side filtering
  // The initialProducts already reflect the current filters
  const filteredProducts = initialProducts

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <section className="bg-card py-12 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold font-serif text-foreground mb-4">
              Our Premium <span className="text-gradient">Products</span>
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
            {/* Search */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Input
                  type="search"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => updateFilters({ search: e.target.value })}
                  className="pl-4 pr-4 focus:ring-salsa-500 focus:border-salsa-500"
                />
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
            Showing {filteredProducts.length} products
          </div>
        </div>
      </section>

      {/* Gift Box Quick Add */}
      <GiftBoxQuickAdd />

      {/* Products Grid */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">No products found matching your criteria.</p>
              <Button
                onClick={() => {
                  router.push('/products')
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
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
