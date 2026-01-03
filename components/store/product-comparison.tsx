'use client'

import { useEffect, useState } from 'react'
import { useComparisonStore } from '@/lib/store/comparison'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X, ShoppingCart } from 'lucide-react'
import { useCartStore } from '@/lib/store/cart'
import Image from 'next/image'
import Link from 'next/link'
import { toast } from 'sonner'

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

  const handleAddToCart = (product: any) => {
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

  const getHeatLevelColor = (level: string) => {
    const colors: Record<string, string> = {
      MILD: 'bg-green-100 text-green-800',
      MEDIUM: 'bg-yellow-100 text-yellow-800',
      HOT: 'bg-orange-100 text-orange-800',
      'EXTRA HOT': 'bg-red-100 text-red-800',
    }
    return colors[level] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-salsa-500 shadow-2xl z-50 max-h-[70vh] overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b bg-gray-50">
        <h3 className="text-xl font-bold">
          Compare Products ({products.length}/{4})
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={clearComparison}>
            Clear All
          </Button>
          <button onClick={closePanel} className="p-2 hover:bg-gray-200 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-4 text-left font-semibold sticky left-0 bg-gray-50 z-10">
                Feature
              </th>
              {products.map(product => (
                <th key={product.id} className="p-4 min-w-[250px]">
                  <button
                    onClick={() => removeProduct(product.id)}
                    className="absolute top-2 right-2 p-1 hover:bg-gray-200 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Product Images */}
            <tr className="border-b">
              <td className="p-4 font-semibold sticky left-0 bg-white">Image</td>
              {products.map(product => (
                <td key={product.id} className="p-4">
                  <div className="relative w-full aspect-square bg-gray-100 rounded-lg overflow-hidden">
                    <Image
                      src={product.image || '/images/placeholder.png'}
                      alt={product.name}
                      fill
                      className="object-cover"
                      sizes="250px"
                    />
                  </div>
                </td>
              ))}
            </tr>

            {/* Product Names */}
            <tr className="border-b bg-gray-50">
              <td className="p-4 font-semibold sticky left-0 bg-gray-50">Name</td>
              {products.map(product => (
                <td key={product.id} className="p-4">
                  <Link
                    href={`/salsas/${product.slug}`}
                    className="font-bold hover:text-salsa-600"
                  >
                    {product.name}
                  </Link>
                </td>
              ))}
            </tr>

            {/* Price */}
            <tr className="border-b">
              <td className="p-4 font-semibold sticky left-0 bg-white">Price</td>
              {products.map(product => (
                <td key={product.id} className="p-4">
                  <span className="text-2xl font-bold text-salsa-600">
                    ${product.price.toFixed(2)}
                  </span>
                </td>
              ))}
            </tr>

            {/* Heat Level */}
            <tr className="border-b bg-gray-50">
              <td className="p-4 font-semibold sticky left-0 bg-gray-50">Heat Level</td>
              {products.map(product => (
                <td key={product.id} className="p-4">
                  <Badge className={getHeatLevelColor(product.heatLevel)}>
                    {product.heatLevel}
                  </Badge>
                </td>
              ))}
            </tr>

            {/* Description */}
            <tr className="border-b">
              <td className="p-4 font-semibold sticky left-0 bg-white">Description</td>
              {products.map(product => (
                <td key={product.id} className="p-4">
                  <p className="text-sm text-gray-600 line-clamp-3">
                    {product.description || 'No description available'}
                  </p>
                </td>
              ))}
            </tr>

            {/* Availability */}
            <tr className="border-b bg-gray-50">
              <td className="p-4 font-semibold sticky left-0 bg-gray-50">Availability</td>
              {products.map(product => (
                <td key={product.id} className="p-4">
                  {product.inventory > 0 ? (
                    <Badge className="bg-green-100 text-green-800">
                      In Stock ({product.inventory})
                    </Badge>
                  ) : (
                    <Badge variant="destructive">Out of Stock</Badge>
                  )}
                </td>
              ))}
            </tr>

            {/* Add to Cart */}
            <tr>
              <td className="p-4 font-semibold sticky left-0 bg-white">Action</td>
              {products.map(product => (
                <td key={product.id} className="p-4">
                  <Button
                    onClick={() => handleAddToCart(product)}
                    disabled={product.inventory <= 0}
                    className="w-full"
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Add to Cart
                  </Button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Floating compare button
export function CompareFloatingButton() {
  const [mounted, setMounted] = useState(false)
  const { products, openPanel } = useComparisonStore()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || products.length === 0) {
    return null
  }

  return (
    <button
      onClick={openPanel}
      className="fixed bottom-6 right-6 bg-salsa-600 text-white px-6 py-3 rounded-full shadow-lg hover:bg-salsa-700 transition-all z-40 flex items-center gap-2"
    >
      <span className="font-semibold">Compare ({products.length})</span>
    </button>
  )
}
