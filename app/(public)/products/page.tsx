'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'
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

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedHeatLevel, setSelectedHeatLevel] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/products')
        if (!response.ok) {
          throw new Error('Failed to fetch products')
        }
        const data = await response.json()
        setProducts(data)
      } catch (error) {
        console.error('Error fetching products:', error)
        setProducts([])
      } finally {
        setLoading(false)
      }
    }
    fetchProducts()
  }, [])

  // Filter products based on search and heat level
  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.description &&
        product.description.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesHeatLevel =
      selectedHeatLevel === 'all' || product.heatLevel === selectedHeatLevel
    return matchesSearch && matchesHeatLevel
  })

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
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Input
                type="search"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-4 pr-4 focus:ring-salsa-500 focus:border-salsa-500"
              />
            </div>

            {/* Heat Level Filter */}
            <div className="flex flex-wrap gap-2">
              {heatLevels.map((level) => (
                <Button
                  key={level.value}
                  variant={selectedHeatLevel === level.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedHeatLevel(level.value)}
                  className={selectedHeatLevel === level.value ? 'bg-salsa-500 hover:bg-salsa-600' : ''}
                >
                  {level.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="mt-4 text-sm text-muted-foreground">
            Showing {filteredProducts.length} of {products.length} products
          </div>
        </div>
      </section>

      {/* Gift Box Quick Add */}
      <GiftBoxQuickAdd />

      {/* Products Grid */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-salsa-500" />
              <span className="ml-2 text-lg">Loading products...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">No products found matching your criteria.</p>
              <Button
                onClick={() => {
                  setSearchTerm('')
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