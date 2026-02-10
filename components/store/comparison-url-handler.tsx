'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useComparisonStore } from '@/lib/store/comparison'
import { toast } from 'sonner'

export function ComparisonURLHandler() {
  const searchParams = useSearchParams()
  const { addProduct, openPanel, clearComparison } = useComparisonStore()
  const hasProcessed = useRef(false)

  useEffect(() => {
    // Only run once per mount
    if (hasProcessed.current) return

    const compareParam = searchParams.get('compare')
    if (!compareParam) return

    hasProcessed.current = true

    // Parse product IDs from URL
    const productIds = compareParam
      .split(',')
      .map(id => id.trim())
      .filter(Boolean)

    if (productIds.length === 0) return

    // Fetch products and add to comparison
    const loadProducts = async () => {
      try {
        // Fetch all products
        const response = await fetch('/api/products')
        if (!response.ok) {
          throw new Error('Failed to fetch products')
        }

        const allProducts = await response.json()

        // Filter products that match the IDs
        const matchedProducts = allProducts.filter((product: any) =>
          productIds.includes(product.id)
        )

        if (matchedProducts.length === 0) {
          toast.error('No valid products found in comparison link')
          return
        }

        // Clear existing comparison and add new products
        clearComparison()

        matchedProducts.forEach((product: any) => {
          addProduct({
            id: product.id,
            name: product.name,
            slug: product.slug,
            price: product.price,
            image: product.featuredImage || '/images/placeholder.png',
            heatLevel: product.heatLevel,
            sku: product.sku,
            description: product.description,
            inventory: product.inventory,
            ingredients: product.ingredients,
            weight: product.weight || null,
            dimensions: product.dimensions || null,
          })
        })

        // Open the comparison panel
        openPanel()

        // Notify user
        toast.success(`Loaded ${matchedProducts.length} product${matchedProducts.length > 1 ? 's' : ''} into comparison`)

        // Handle invalid IDs
        const invalidCount = productIds.length - matchedProducts.length
        if (invalidCount > 0) {
          toast.warning(`${invalidCount} product${invalidCount > 1 ? 's' : ''} could not be found`)
        }
      } catch (error) {
        console.error('Error loading comparison products:', error)
        toast.error('Failed to load comparison products')
      }
    }

    loadProducts()
  }, [searchParams, addProduct, openPanel, clearComparison])

  return null
}
