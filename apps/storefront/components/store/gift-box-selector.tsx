'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ShoppingCart, Plus, Minus, X, ChevronDown } from 'lucide-react'
import { useCartStore } from '@/lib/store/cart'
import { SALSA_BUNDLES, type SalsaBundle } from '@/lib/bundles'
import { formatPrice } from '@/lib/utils'

type Product = {
  id: string
  name: string
  slug: string
  price: number
  featuredImage: string
  heatLevel: string
  sku: string
}

export function GiftBoxSelector() {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedBox, setSelectedBox] = useState<SalsaBundle | null>(null)
  const [selections, setSelections] = useState<Record<number, Product | null>>({})
  const [loading, setLoading] = useState(true)
  const addBundle = useCartStore((state) => state.addBundle)
  const openCart = useCartStore((state) => state.openCart)

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch('/api/salsas')
        if (!response.ok) throw new Error('Failed to fetch salsas')
        const data = await response.json()
        setProducts(data)
      } catch (error) {
        console.error('Error fetching salsas:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchProducts()
  }, [])

  const handleSelectBox = (box: SalsaBundle) => {
    setSelectedBox(box)
    // Initialize selections with null for each slot
    const newSelections: Record<number, Product | null> = {}
    for (let i = 0; i < box.size; i++) {
      newSelections[i] = null
    }
    setSelections(newSelections)
  }

  const handleSelectSalsa = (slotIndex: number, product: Product) => {
    setSelections((prev) => ({
      ...prev,
      [slotIndex]: product,
    }))
  }

  const handleRemoveSalsa = (slotIndex: number) => {
    setSelections((prev) => ({
      ...prev,
      [slotIndex]: null,
    }))
  }

  const handleAddToCart = () => {
    if (!selectedBox) return

    const selectedProducts = Object.values(selections).filter((p) => p !== null) as Product[]

    if (selectedProducts.length !== selectedBox.size) {
      alert(`Please select all ${selectedBox.size} salsas before adding to cart.`)
      return
    }

    // Added as a pack, not as loose jars. Adding them individually is what used to charge a
    // $28 Choose 5 at five times the catalogue price once the customer reached checkout.
    const added = addBundle(
      selectedBox.id,
      selectedProducts.map((product) => ({
        productId: product.id,
        name: product.name,
        slug: product.slug,
        image: product.featuredImage,
        sku: product.sku,
        heatLevel: product.heatLevel,
        price: product.price,
      }))
    )

    if (!added) {
      alert('Sorry, this pack could not be added to your cart. Please try again.')
      return
    }

    openCart()

    // Reset after adding
    setSelectedBox(null)
    setSelections({})
  }

  const selectedCount = Object.values(selections).filter((p) => p !== null).length
  const isComplete = selectedBox && selectedCount === selectedBox.size

  return (
    <section className="py-20 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold font-serif text-foreground mb-4">
            Create Your Perfect <span className="text-gradient">Gift Box</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Mix and match your favorite salsas to create the perfect gift box. Choose from 3, 5, 6, or 12 packs.
          </p>
        </div>

        {!selectedBox ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {SALSA_BUNDLES.map((box) => (
              <div
                key={box.id}
                className="card p-6 text-center group hover:scale-105 transition-transform duration-300 cursor-pointer"
                onClick={() => handleSelectBox(box)}
              >
                <div className="relative w-full h-48 mb-4 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                  <Image
                    src={box.image}
                    alt={box.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
                  />
                </div>
                <h3 className="text-xl font-bold mb-2 text-foreground">{box.name}</h3>
                <p className="text-2xl font-bold text-salsa-600 mb-4">{formatPrice(box.price)}</p>
                <Button className="w-full">Select This Box</Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <div className="card p-8 mb-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-foreground mb-2">{selectedBox.name}</h3>
                  <p className="text-3xl font-bold text-salsa-600">{formatPrice(selectedBox.price)}</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedBox(null)
                    setSelections({})
                  }}
                >
                  Change Box
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {Array.from({ length: selectedBox.size }).map((_, index) => {
                  const selectedProduct = selections[index]
                  return (
                    <div
                      key={index}
                      className="border-2 border-dashed border-border rounded-lg p-4 min-h-[200px] flex flex-col"
                    >
                      <div className="text-sm font-semibold text-muted-foreground mb-3">
                        Slot {index + 1}
                      </div>
                      {selectedProduct ? (
                        <div className="flex-1 flex flex-col">
                          <div className="relative w-full h-24 mb-3 rounded overflow-hidden bg-gray-100 dark:bg-gray-800">
                            <Image
                              src={selectedProduct.featuredImage}
                              alt={selectedProduct.name}
                              fill
                              className="object-cover"
                              sizes="150px"
                            />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm text-foreground mb-1 line-clamp-2">
                              {selectedProduct.name}
                            </h4>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-2 text-xs"
                              onClick={() => handleRemoveSalsa(index)}
                            >
                              <X className="h-3 w-3 mr-1" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <SalsaDropdown
                          products={products}
                          onSelect={(product) => handleSelectSalsa(index, product)}
                        />
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div className="text-sm text-muted-foreground">
                  {selectedCount} of {selectedBox.size} selected
                </div>
                <Button
                  onClick={handleAddToCart}
                  disabled={!isComplete}
                  className="bg-salsa-600 hover:bg-salsa-700"
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Add to Cart
                </Button>
              </div>
            </div>

            {/* Enhanced dropdown with icons */}
            <div className="card p-6">
              <h4 className="font-semibold text-foreground mb-4">Available Salsas</h4>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted cursor-pointer"
                    onClick={() => {
                      // Find first empty slot
                      const emptySlot = Array.from({ length: selectedBox.size }).findIndex(
                        (_, i) => selections[i] === null
                      )
                      if (emptySlot !== -1) {
                        handleSelectSalsa(emptySlot, product)
                      }
                    }}
                  >
                    <div className="relative w-16 h-16 rounded overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0">
                      <Image
                        src={product.featuredImage}
                        alt={product.name}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground text-sm">{product.name}</div>
                      <div className="text-xs text-muted-foreground">{formatPrice(product.price)}</div>
                    </div>
                    {Object.values(selections).includes(product) && (
                      <Badge variant="secondary" className="text-xs">
                        Selected
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

// Custom dropdown component with icons
function SalsaDropdown({
  products,
  onSelect,
}: {
  products: Product[]
  onSelect: (product: Product) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="flex-1 relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-2 border border-border rounded bg-background text-foreground text-sm flex items-center justify-between hover:bg-muted transition-colors"
      >
        <span className="text-muted-foreground">Select a salsa...</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {products.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground text-center">
              No salsas available
            </div>
          ) : (
            <div className="py-1">
              {products.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => {
                    onSelect(product)
                    setIsOpen(false)
                  }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-muted transition-colors text-left"
                >
                  <div className="relative w-12 h-12 rounded overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0">
                    <Image
                      src={product.featuredImage}
                      alt={product.name}
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-foreground truncate">{product.name}</div>
                    <div className="text-xs text-muted-foreground">{formatPrice(product.price)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

