'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ShoppingCart, Loader2, Search } from 'lucide-react'
import { useCartStore } from '@/lib/store/cart'
import { formatPrice, getHeatLevelColor, getHeatLevelText } from '@/lib/utils'
import { HeatGauge } from '@/components/store/heat-gauge'
import { getSalsaHeatRating } from '@/lib/salsa-heat'

// Simple debounce implementation
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

type Product = {
  id: string
  name: string
  slug: string
  description: string
  price: number
  compareAtPrice?: number
  featuredImage: string
  heatLevel: string
  sku: string
  inventory: number
  isFeatured: boolean
  category?: {
    id: string
    name: string
    slug: string
  } | null
}

type SearchSuggestion = {
  name: string
  slug: string
  image: string
  price: number
  heatLevel: string
}

export default function ProductSearchPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') || ''

  const [query, setQuery] = useState(initialQuery)
  const [products, setProducts] = useState<Product[]>([])
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loading, setLoading] = useState(false)
  const [totalResults, setTotalResults] = useState(0)

  const addItem = useCartStore((state) => state.addItem)
  const openCart = useCartStore((state) => state.openCart)

  // Fetch autocomplete suggestions
  const fetchSuggestions = useCallback(
    debounce(async (searchQuery: string) => {
      if (searchQuery.length < 2) {
        setSuggestions([])
        return
      }

      try {
        const response = await fetch('/api/products/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: searchQuery }),
        })

        if (response.ok) {
          const data = await response.json()
          setSuggestions(data.suggestions || [])
        }
      } catch (error) {
        console.error('Error fetching suggestions:', error)
      }
    }, 300),
    []
  )

  // Fetch search results
  const searchProducts = async (searchQuery: string) => {
    if (!searchQuery) {
      setProducts([])
      setTotalResults(0)
      return
    }

    try {
      setLoading(true)
      const url = new URL('/api/products/search', window.location.origin)
      url.searchParams.set('q', searchQuery)
      url.searchParams.set('limit', '24')

      const response = await fetch(url.toString())

      if (!response.ok) {
        throw new Error('Failed to search products')
      }

      const data = await response.json()
      setProducts(data.products || [])
      setTotalResults(data.pagination?.total || 0)
    } catch (error) {
      console.error('Error searching products:', error)
      setProducts([])
      setTotalResults(0)
    } finally {
      setLoading(false)
    }
  }

  // Handle query input change
  useEffect(() => {
    fetchSuggestions(query)
  }, [query, fetchSuggestions])

  // Handle initial search on mount
  useEffect(() => {
    if (initialQuery) {
      searchProducts(initialQuery)
    }
  }, [initialQuery])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/products/search?q=${encodeURIComponent(query)}`)
      searchProducts(query)
      setShowSuggestions(false)
    }
  }

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.name)
    setShowSuggestions(false)
    router.push(`/salsas/${suggestion.slug}`)
  }

  const handleAddToCart = (product: Product) => {
    addItem({
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      image: product.featuredImage,
      sku: product.sku,
      heatLevel: product.heatLevel,
      maxQuantity: product.inventory,
    })
    openCart()
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <section className="bg-card py-12 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold font-serif text-foreground mb-4">
              Search <span className="text-gradient">Products</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Find the perfect salsa for your taste
            </p>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="max-w-2xl mx-auto relative">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search for salsas, heat levels, ingredients..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setShowSuggestions(true)
                }}
                onFocus={() => setShowSuggestions(true)}
                className="pl-12 pr-4 py-6 text-lg focus:ring-salsa-500 focus:border-salsa-500"
              />
            </div>

            {/* Autocomplete Suggestions */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-2 bg-card border rounded-lg shadow-lg max-h-96 overflow-y-auto">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full flex items-center gap-4 p-4 hover:bg-accent transition-colors text-left"
                  >
                    <div className="relative w-12 h-12 flex-shrink-0">
                      <Image
                        src={suggestion.image}
                        alt={suggestion.name}
                        fill
                        className="object-cover rounded"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-foreground">{suggestion.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatPrice(suggestion.price)} •{' '}
                        {getHeatLevelText(suggestion.heatLevel)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </form>
        </div>
      </section>

      {/* Results */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {query && (
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-foreground">
                Search results for "{query}"
              </h2>
              <p className="text-muted-foreground mt-1">
                {totalResults} {totalResults === 1 ? 'product' : 'products'} found
              </p>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-salsa-500" />
              <span className="ml-2 text-lg">Searching...</span>
            </div>
          ) : !query ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">
                Enter a search term to find products
              </p>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg mb-4">
                No products found for "{query}"
              </p>
              <Link href="/products">
                <Button className="bg-salsa-500 hover:bg-salsa-600">
                  Browse All Products
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {products.map((product) => {
                const heatRating = getSalsaHeatRating(product.name, product.heatLevel)

                return (
                  <div
                    key={product.id}
                    className="group card surface-shadow transition-all duration-300 hover:-translate-y-1 overflow-hidden"
                  >
                    <Link href={`/salsas/${product.slug}`}>
                      <div className="relative aspect-square bg-gray-100 dark:bg-gray-800">
                        <Image
                          src={product.featuredImage}
                          alt={product.name}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                        />

                        {/* Badges */}
                        <div className="absolute top-3 left-3 flex flex-col gap-2">
                          {product.isFeatured && (
                            <Badge className="bg-salsa-500 text-white">Featured</Badge>
                          )}
                          {product.compareAtPrice && (
                            <Badge className="bg-green-500 text-white">Sale</Badge>
                          )}
                        </div>

                        {/* Heat Level Badge */}
                        <div className="absolute top-3 right-3">
                          <Badge className={getHeatLevelColor(product.heatLevel)}>
                            {getHeatLevelText(product.heatLevel)}
                          </Badge>
                        </div>
                      </div>
                    </Link>

                    <div className="p-6">
                      <Link href={`/salsas/${product.slug}`}>
                        <h3 className="font-semibold text-lg text-foreground hover:text-salsa-600 transition-colors line-clamp-2 mb-2">
                          {product.name}
                        </h3>
                      </Link>

                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                        {product.description}
                      </p>

                      <HeatGauge
                        value={heatRating.value}
                        max={heatRating.max}
                        label={heatRating.label}
                        heatLevel={product.heatLevel}
                        className="mb-4"
                      />

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-foreground">
                            {formatPrice(product.price)}
                          </span>
                          {product.compareAtPrice && (
                            <span className="text-sm text-muted-foreground line-through">
                              {formatPrice(product.compareAtPrice)}
                            </span>
                          )}
                        </div>

                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault()
                            handleAddToCart(product)
                          }}
                          className="bg-salsa-500 hover:bg-salsa-600 flex items-center gap-2"
                        >
                          <ShoppingCart className="w-4 h-4" />
                          Add
                        </Button>
                      </div>

                      {/* Stock indicator */}
                      {product.inventory <= 5 && product.inventory > 0 && (
                        <div className="mt-2 text-sm text-orange-600">
                          Only {product.inventory} left!
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
