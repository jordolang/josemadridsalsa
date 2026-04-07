'use client'

import { useEffect, useState } from 'react'
import { useComparisonStore, ComparisonProduct } from '@/lib/store/comparison'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X, ShoppingCart, Scale, Trash2 } from 'lucide-react'
import { useCartStore } from '@/lib/store/cart'
import Image from 'next/image'
import Link from 'next/link'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const HEAT_ORDER: Record<string, number> = {
  MILD: 1,
  MEDIUM: 2,
  HOT: 3,
  EXTRA_HOT: 4,
  FRUIT: 0,
}

function getHeatLabel(level: string) {
  const labels: Record<string, string> = {
    MILD: 'Mild',
    MEDIUM: 'Medium',
    HOT: 'Hot',
    EXTRA_HOT: 'Extra Hot',
    FRUIT: 'Fruit',
  }
  return labels[level] || level
}

function getHeatColor(level: string) {
  const colors: Record<string, string> = {
    MILD: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    HOT: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    EXTRA_HOT: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    FRUIT: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  }
  return colors[level] || 'bg-muted text-muted-foreground'
}

export function ProductComparison() {
  const [mounted, setMounted] = useState(false)
  const { products, isOpen, closePanel, removeProduct, clearComparison } = useComparisonStore()
  const addToCart = useCartStore((state) => state.addItem)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !isOpen || products.length === 0) {
    return null
  }

  const handleAddToCart = (product: ComparisonProduct) => {
    addToCart({
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      image: product.image,
      quantity: 1,
      sku: product.sku,
      heatLevel: product.heatLevel,
      maxQuantity: product.inventory,
    })
    toast.success(`Added ${product.name} to cart`)
  }

  // Helpers for highlighting best/worst values
  const prices = products.map(p => p.price)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)

  const getCalories = (p: ComparisonProduct) => p.nutritionalInfo?.calories ?? null
  const getSodium = (p: ComparisonProduct) => p.nutritionalInfo?.sodiumMg ?? null
  const getFat = (p: ComparisonProduct) => p.nutritionalInfo?.totalFatG ?? null
  const getCarbs = (p: ComparisonProduct) => p.nutritionalInfo?.totalCarbG ?? null
  const getSugars = (p: ComparisonProduct) => p.nutritionalInfo?.sugarsG ?? null
  const getProtein = (p: ComparisonProduct) => p.nutritionalInfo?.proteinG ?? null

  // Calculate price per oz if weight available
  const getPricePerOz = (p: ComparisonProduct) => {
    if (!p.weight) return null
    const w = parseFloat(p.weight)
    if (isNaN(w) || w <= 0) return null
    return p.price / w
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={closePanel}
        aria-hidden
      />

      {/* Sidebar */}
      <div className="fixed top-0 right-0 h-full w-full max-w-[400px] bg-card border-l border-border shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-bold text-lg">
              Compare ({products.length})
            </h3>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={clearComparison} className="text-xs">
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Clear
            </Button>
            <button onClick={closePanel} className="p-1.5 hover:bg-muted rounded-md">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Product thumbnails row */}
          <div className="flex gap-2 p-4 border-b border-border">
            {products.map(product => (
              <div key={product.id} className="flex-1 min-w-0">
                <div className="relative group">
                  <Link href={`/salsas/${product.slug}`} onClick={closePanel}>
                    <div className="relative w-full aspect-square bg-muted rounded-lg overflow-hidden max-w-[80px] mx-auto">
                      <Image
                        src={product.image || '/images/placeholder-salsa.jpg'}
                        alt={product.name}
                        fill
                        className="object-contain"
                        sizes="80px"
                      />
                    </div>
                  </Link>
                  <button
                    onClick={() => removeProduct(product.id)}
                    className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={`Remove ${product.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <p className="text-[0.65rem] text-center mt-1 text-muted-foreground line-clamp-2 leading-tight">
                  {product.name}
                </p>
              </div>
            ))}
          </div>

          {/* Comparison rows */}
          <div className="divide-y divide-border">
            {/* Price */}
            <ComparisonSection label="Price">
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${products.length}, 1fr)` }}>
                {products.map(product => {
                  const isLowest = products.length > 1 && product.price === minPrice && minPrice !== maxPrice
                  return (
                    <div key={product.id} className="text-center">
                      <span className={cn(
                        "text-lg font-bold",
                        isLowest ? "text-green-600 dark:text-green-400" : "text-foreground"
                      )}>
                        ${product.price.toFixed(2)}
                      </span>
                      {isLowest && (
                        <div className="text-[0.6rem] text-green-600 dark:text-green-400 font-medium">Best Price</div>
                      )}
                      {(() => {
                        const ppo = getPricePerOz(product)
                        if (ppo !== null) {
                          return (
                            <div className="text-[0.6rem] text-muted-foreground">
                              ${ppo.toFixed(2)}/oz
                            </div>
                          )
                        }
                        return null
                      })()}
                    </div>
                  )
                })}
              </div>
            </ComparisonSection>

            {/* Heat Level */}
            <ComparisonSection label="Heat Level">
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${products.length}, 1fr)` }}>
                {products.map(product => (
                  <div key={product.id} className="text-center">
                    <Badge className={cn("text-[0.65rem]", getHeatColor(product.heatLevel))}>
                      {getHeatLabel(product.heatLevel)}
                    </Badge>
                    <div className="mt-1 flex justify-center gap-0.5">
                      {[1, 2, 3, 4].map(level => (
                        <div
                          key={level}
                          className={cn(
                            "w-2 h-2 rounded-full",
                            level <= (HEAT_ORDER[product.heatLevel] || 0)
                              ? "bg-red-500"
                              : "bg-muted-foreground/20"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ComparisonSection>

            {/* Nutrition Comparison */}
            {products.some(p => p.nutritionalInfo) && (
              <>
                <NutritionRow
                  label="Calories"
                  products={products}
                  getValue={getCalories}
                  unit=""
                  lowerIsBetter
                />
                <NutritionRow
                  label="Sodium"
                  products={products}
                  getValue={getSodium}
                  unit="mg"
                  lowerIsBetter
                />
                <NutritionRow
                  label="Total Fat"
                  products={products}
                  getValue={getFat}
                  unit="g"
                  lowerIsBetter
                />
                <NutritionRow
                  label="Carbs"
                  products={products}
                  getValue={getCarbs}
                  unit="g"
                  lowerIsBetter
                />
                <NutritionRow
                  label="Sugars"
                  products={products}
                  getValue={getSugars}
                  unit="g"
                  lowerIsBetter
                />
                <NutritionRow
                  label="Protein"
                  products={products}
                  getValue={getProtein}
                  unit="g"
                  lowerIsBetter={false}
                />
              </>
            )}

            {/* Weight */}
            {products.some(p => p.weight) && (
              <ComparisonSection label="Net Weight">
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${products.length}, 1fr)` }}>
                  {products.map(product => (
                    <div key={product.id} className="text-center text-sm text-muted-foreground">
                      {product.weight ? `${product.weight} oz` : '—'}
                    </div>
                  ))}
                </div>
              </ComparisonSection>
            )}

            {/* Availability */}
            <ComparisonSection label="Availability">
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${products.length}, 1fr)` }}>
                {products.map(product => (
                  <div key={product.id} className="text-center">
                    {product.inventory > 0 ? (
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                        In Stock
                      </span>
                    ) : (
                      <span className="text-xs text-destructive font-medium">
                        Out of Stock
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </ComparisonSection>

            {/* Add to Cart buttons */}
            <div className="p-4">
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${products.length}, 1fr)` }}>
                {products.map(product => (
                  <Button
                    key={product.id}
                    size="sm"
                    onClick={() => handleAddToCart(product)}
                    disabled={product.inventory <= 0}
                    className="text-xs"
                  >
                    <ShoppingCart className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function ComparisonSection({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="px-4 py-3">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        {label}
      </div>
      {children}
    </div>
  )
}

function NutritionRow({
  label,
  products,
  getValue,
  unit,
  lowerIsBetter,
}: {
  label: string
  products: ComparisonProduct[]
  getValue: (p: ComparisonProduct) => number | null
  unit: string
  lowerIsBetter: boolean
}) {
  const values = products.map(p => getValue(p))
  const numericValues = values.filter((v): v is number => v !== null)

  if (numericValues.length === 0) return null

  const best = lowerIsBetter
    ? Math.min(...numericValues)
    : Math.max(...numericValues)
  const worst = lowerIsBetter
    ? Math.max(...numericValues)
    : Math.min(...numericValues)
  const hasDifference = best !== worst

  return (
    <ComparisonSection label={label}>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${products.length}, 1fr)` }}>
        {products.map((product, i) => {
          const val = values[i]
          const isBest = hasDifference && val === best
          const isWorst = hasDifference && val === worst
          return (
            <div key={product.id} className="text-center">
              <span className={cn(
                "text-sm font-semibold",
                isBest && "text-green-600 dark:text-green-400",
                isWorst && "text-red-500 dark:text-red-400",
                !isBest && !isWorst && "text-foreground"
              )}>
                {val !== null ? `${val}${unit}` : '—'}
              </span>
            </div>
          )
        })}
      </div>
    </ComparisonSection>
  )
}

// Floating compare button
export function CompareFloatingButton() {
  const [mounted, setMounted] = useState(false)
  const { products, isOpen, openPanel } = useComparisonStore()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || products.length === 0 || isOpen) {
    return null
  }

  return (
    <button
      onClick={openPanel}
      className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center rounded-l-lg border border-r-0 border-gray-200 bg-[#FFF8EE] py-4 px-2 text-gray-600 shadow-md hover:bg-[#F7EDD8] hover:shadow-lg hover:pr-3 active:scale-y-95 transition-all duration-200 cursor-pointer"
      style={{ writingMode: 'vertical-rl', transform: 'translateY(-50%) rotate(180deg)' }}
    >
      <Scale className="h-4 w-4 mb-2" style={{ transform: 'rotate(180deg)' }} />
      <span className="uppercase tracking-widest text-[10px] font-semibold">Compare ({products.length})</span>
    </button>
  )
}
