'use client'

import { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ShoppingCart, Plus, Minus, X } from 'lucide-react'
import { useCartStore } from '@/lib/store/cart'
import { offeredBundles, type OfferedSalsaBundle, type PackOverrides } from '@/lib/bundles'
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

export function GiftBoxSelector({ packOverrides = {} }: { packOverrides?: PackOverrides } = {}) {
  const bundles = useMemo(() => offeredBundles(packOverrides), [packOverrides])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedBox, setSelectedBox] = useState<OfferedSalsaBundle | null>(null)
  const [selections, setSelections] = useState<Record<number, Product | null>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [cartError, setCartError] = useState<string | null>(null)
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
        setLoadError(true)
      } finally {
        setLoading(false)
      }
    }
    fetchProducts()
  }, [])

  const handleSelectBox = (box: OfferedSalsaBundle) => {
    setSelectedBox(box)
    // Initialize selections with null for each slot
    const newSelections: Record<number, Product | null> = {}
    for (let i = 0; i < box.size; i++) {
      newSelections[i] = null
    }
    setSelections(newSelections)
  }

  const handleSelectSalsa = (slotIndex: number, product: Product) => {
    setCartError(null)
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
      setCartError(`Choose all ${selectedBox.size} salsas before adding this box to your cart.`)
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
      })),
      packOverrides
    )

    if (!added) {
      setCartError('This box could not be added to your cart. Please try again.')
      return
    }

    openCart()

    // Reset after adding
    setSelectedBox(null)
    setSelections({})
  }

  const selectedCount = Object.values(selections).filter((p) => p !== null).length
  const isComplete = selectedBox && selectedCount === selectedBox.size

  const slots = useMemo(() => {
    if (!selectedBox) return []
    return Array.from({ length: selectedBox.size })
  }, [selectedBox])

  return (
    <section className="py-20 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="mb-3 inline-block text-xs font-semibold uppercase tracking-widest text-salsa-600">
            Gift Boxes
          </span>
          <h2 className="text-4xl font-bold font-serif text-foreground mb-4">
            Create Your Perfect <span className="text-gradient">Gift Box</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Mix and match your favorite salsas to create the perfect gift box. Choose from 3, 5, 6, or 12 packs.
          </p>
        </div>

        {!selectedBox ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {bundles.map((box) => (
              <div
                key={box.id}
                className={
                  box.available
                    ? 'interactive-card card p-6 text-center cursor-pointer'
                    : 'card p-6 text-center opacity-60'
                }
                onClick={box.available ? () => handleSelectBox(box) : undefined}
                aria-disabled={!box.available}
              >
                <div className="relative w-full h-48 mb-4 rounded-lg overflow-hidden bg-muted">
                  <Image
                    src={box.image}
                    alt={box.name}
                    fill
                    className="object-contain"
                    sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
                  />
                </div>
                <h3 className="text-xl font-bold mb-2 text-foreground">{box.name}</h3>
                <p className="text-2xl font-bold text-salsa-600 mb-4">{formatPrice(box.price)}</p>
                <Button className="w-full bg-salsa-500 text-white hover:bg-salsa-600" disabled={!box.available}>
                  {box.available ? 'Select This Box' : 'Out of Stock'}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            {(loadError || (!loading && products.length === 0)) && (
              <p
                role="alert"
                className="mb-4 rounded-lg border border-salsa-200 bg-salsa-50 p-4 text-sm text-salsa-800 dark:border-salsa-900 dark:bg-salsa-950/40 dark:text-salsa-200"
              >
                {loadError
                  ? <>We couldn&apos;t load the salsa list. Refresh the page to try again, or{' '}</>
                  : <>No salsas are available for gift boxes right now. You can still{' '}</>}
                <Link href="/products" className="font-semibold underline underline-offset-2">
                  shop single jars
                </Link>
                .
              </p>
            )}
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
                {slots.map((_, index) => {
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
                          <div className="relative w-full h-24 mb-3 rounded overflow-hidden bg-muted">
                            <Image
                              src={selectedProduct.featuredImage}
                              alt={selectedProduct.name}
                              fill
                              className="object-contain"
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
                        <SalsaSelect
                          id={`gift-slot-${index}`}
                          label={`Salsa for slot ${index + 1}`}
                          products={products}
                          onSelect={(product) => handleSelectSalsa(index, product)}
                        />
                      )}
                    </div>
                  )
                })}
              </div>

              {cartError && (
                <p role="alert" className="mb-3 text-sm font-medium text-salsa-700 dark:text-salsa-300">
                  {cartError}
                </p>
              )}
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div className="text-sm text-muted-foreground">
                  {selectedCount} of {selectedBox.size} selected
                </div>
                <Button
                  onClick={handleAddToCart}
                  disabled={!isComplete}
                  className="min-h-11 bg-salsa-500 text-white hover:bg-salsa-600"
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Add to Cart
                </Button>
              </div>
            </div>

            {/* Quick add: tapping a salsa fills the first empty slot */}
            <div className="card p-6">
              <h4 className="font-semibold text-foreground mb-4">Available Salsas</h4>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {products.map((product) => (
                  <button
                    type="button"
                    key={product.id}
                    className="flex w-full items-center gap-3 p-3 rounded-lg border border-border text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-salsa-500"
                    onClick={() => {
                      // Find first empty slot
                      const emptySlot = slots.findIndex(
                        (_, i) => selections[i] === null
                      )
                      if (emptySlot !== -1) {
                        handleSelectSalsa(emptySlot, product)
                      }
                    }}
                  >
                    <div className="relative w-16 h-16 rounded overflow-hidden bg-muted flex-shrink-0">
                      <Image
                        src={product.featuredImage}
                        alt=""
                        fill
                        className="object-contain"
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
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

// A native select: keyboard and screen-reader support for free, and phones open
// their own picker instead of a 25-item custom list.
function SalsaSelect({
  id,
  label,
  products,
  onSelect,
}: {
  id: string
  label: string
  products: Product[]
  onSelect: (product: Product) => void
}) {
  return (
    <div className="mt-auto">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value=""
        disabled={products.length === 0}
        onChange={(event) => {
          const product = products.find((p) => p.id === event.target.value)
          if (product) onSelect(product)
        }}
        className="min-h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-salsa-500 disabled:opacity-60"
      >
        <option value="" disabled>
          {products.length === 0 ? 'No salsas available' : 'Select a salsa…'}
        </option>
        {products.map((product) => (
          <option key={product.id} value={product.id}>
            {product.name}
          </option>
        ))}
      </select>
    </div>
  )
}
