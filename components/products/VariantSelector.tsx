'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatPrice, cn } from '@/lib/utils'

export interface ProductVariant {
  id: string
  productId: string
  name: string
  type: string
  price: number | null
  sku: string | null
  inStock: boolean
  createdAt: Date
  updatedAt: Date
}

interface VariantSelectorProps {
  variants: ProductVariant[]
  basePrice: number
  onVariantChange?: (variant: ProductVariant | null, effectivePrice: number) => void
}

export function VariantSelector({
  variants,
  basePrice,
  onVariantChange,
}: VariantSelectorProps) {
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({})

  // Group variants by type
  const variantsByType = variants.reduce((acc, variant) => {
    if (!acc[variant.type]) {
      acc[variant.type] = []
    }
    acc[variant.type].push(variant)
    return acc
  }, {} as Record<string, ProductVariant[]>)

  // Get currently selected variant (if any)
  const getSelectedVariant = (): ProductVariant | null => {
    const variantTypes = Object.keys(variantsByType)
    if (variantTypes.length === 0) return null

    // For single variant type, return the selected variant
    if (variantTypes.length === 1) {
      const type = variantTypes[0]
      const selectedId = selectedVariants[type]
      if (!selectedId) return null
      return variants.find((v) => v.id === selectedId) || null
    }

    // For multiple variant types, we'd need to combine them
    // For now, return the first selected variant with a price override
    for (const type of variantTypes) {
      const selectedId = selectedVariants[type]
      if (selectedId) {
        const variant = variants.find((v) => v.id === selectedId)
        if (variant && variant.price !== null) {
          return variant
        }
      }
    }

    return null
  }

  // Calculate effective price based on selected variants
  const getEffectivePrice = (): number => {
    const selectedVariant = getSelectedVariant()
    return selectedVariant?.price ?? basePrice
  }

  const handleVariantSelect = (type: string, variantId: string) => {
    const newSelectedVariants = {
      ...selectedVariants,
      [type]: variantId,
    }
    setSelectedVariants(newSelectedVariants)

    // Find the selected variant
    const foundVariant = variants.find((v) => v.id === variantId)
    const variant: ProductVariant | null = foundVariant !== undefined ? foundVariant : null
    const effectivePrice = variant?.price ?? basePrice

    // Notify parent component
    if (onVariantChange) {
      onVariantChange(variant, effectivePrice)
    }
  }

  // If no variants, don't render anything
  if (variants.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      {Object.entries(variantsByType).map(([type, typeVariants]) => (
        <div key={type} className="space-y-2">
          <label className="text-sm font-medium capitalize">
            {type}
            {typeVariants.some((v) => !v.inStock) && (
              <span className="ml-2 text-xs text-muted-foreground">
                (Some options out of stock)
              </span>
            )}
          </label>
          <div className="flex flex-wrap gap-2">
            {typeVariants.map((variant) => {
              const isSelected = selectedVariants[type] === variant.id
              const isOutOfStock = !variant.inStock

              return (
                <Button
                  key={variant.id}
                  variant={isSelected ? 'default' : 'outline'}
                  size="sm"
                  disabled={isOutOfStock}
                  onClick={() => handleVariantSelect(type, variant.id)}
                  className={cn(
                    'relative transition-all',
                    isSelected && 'ring-2 ring-salsa-500 ring-offset-2',
                    isOutOfStock &&
                      'opacity-50 cursor-not-allowed hover:bg-background'
                  )}
                >
                  {variant.name}
                  {variant.price !== null && variant.price !== basePrice && (
                    <Badge
                      variant="secondary"
                      className="ml-2 text-xs bg-salsa-100 text-salsa-800"
                    >
                      {formatPrice(variant.price)}
                    </Badge>
                  )}
                  {isOutOfStock && (
                    <span className="ml-2 text-xs">(Out of Stock)</span>
                  )}
                </Button>
              )
            })}
          </div>
        </div>
      ))}

      {/* Display effective price if different from base */}
      {getEffectivePrice() !== basePrice && (
        <div className="flex items-center gap-2 pt-2 border-t">
          <span className="text-sm text-muted-foreground">Selected Price:</span>
          <span className="text-2xl font-bold text-salsa-600">
            {formatPrice(getEffectivePrice())}
          </span>
        </div>
      )}
    </div>
  )
}
