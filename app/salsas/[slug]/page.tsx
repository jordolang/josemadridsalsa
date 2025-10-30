'use client'

import { useState, useEffect } from 'react'
import { useParams, notFound } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ShoppingCart, Minus, Plus, Loader2 } from 'lucide-react'
import { useCartStore } from '@/lib/store/cart'
import { formatPrice, getHeatLevelColor, getHeatLevelText } from '@/lib/utils'

type Product = {
  id: string
  name: string
  slug: string
  description: string
  price: number
  compareAtPrice?: number
  featuredImage: string
  images: string[]
  heatLevel: string
  sku: string
  inventory: number
  isFeatured: boolean
  ingredients: string[]
  searchKeywords: string[]
  productType: string
  packSize?: number
}

export default function ProductPage() {
  const params = useParams()
  const slug = params.slug as string
  
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [selectedImage, setSelectedImage] = useState(0)
  
  const addItem = useCartStore((state) => state.addItem)
  const openCart = useCartStore((state) => state.openCart)

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/products`)
        if (!response.ok) {
          throw new Error('Failed to fetch products')
        }
        const products = await response.json()
        const foundProduct = products.find((p: Product) => p.slug === slug)
        
        if (!foundProduct) {
          notFound()
          return
        }
        
        setProduct(foundProduct)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load product')
      } finally {
        setLoading(false)
      }
    }

    fetchProduct()
  }, [slug])

  const handleAddToCart = () => {
    if (!product) return
    
    addItem({
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      image: product.featuredImage,
      sku: product.sku,
      heatLevel: product.heatLevel,
      maxQuantity: product.inventory,
    }, quantity)
    
    openCart()
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-salsa-500" />
          <span className="ml-2 text-lg">Loading product...</span>
        </div>
      </main>
    )
  }

  if (error || !product) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="text-center py-20">
          <p className="text-red-500 text-lg mb-4">
            {error || 'Product not found'}
          </p>
          <Button 
            onClick={() => window.location.href = '/salsas'}
            className="bg-salsa-500 hover:bg-salsa-600"
          >
            Back to Salsas
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Product Images */}
          <div className="space-y-4">
            <div className="aspect-square bg-white rounded-lg overflow-hidden">
              <Image
                src={product.images[selectedImage] || product.featuredImage}
                alt={product.name}
                width={600}
                height={600}
                className="w-full h-full object-cover"
                priority
              />
            </div>
            
            {product.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {product.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 ${
                      selectedImage === index ? 'border-salsa-500' : 'border-gray-200'
                    }`}
                  >
                    <Image
                      src={image}
                      alt={`${product.name} ${index + 1}`}
                      width={80}
                      height={80}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Badge className={getHeatLevelColor(product.heatLevel)}>
                  {getHeatLevelText(product.heatLevel)}
                </Badge>
                {product.isFeatured && (
                  <Badge className="bg-salsa-500 text-white">
                    Featured
                  </Badge>
                )}
                {product.productType === 'MULTI_PACK' && (
                  <Badge className="bg-blue-500 text-white">
                    Multi-Pack ({product.packSize})
                  </Badge>
                )}
              </div>
              
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {product.name}
              </h1>
              
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl font-bold text-gray-900">
                  {formatPrice(product.price)}
                </span>
                {product.compareAtPrice && (
                  <span className="text-xl text-gray-500 line-through">
                    {formatPrice(product.compareAtPrice)}
                  </span>
                )}
              </div>
            </div>
            
            <p className="text-gray-600 text-lg leading-relaxed">
              {product.description}
            </p>
            
            {/* Ingredients */}
            {product.ingredients.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Ingredients
                </h3>
                <p className="text-gray-600">
                  {product.ingredients.join(', ')}
                </p>
              </div>
            )}
            
            {/* Product Details */}
            <div className="bg-white rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">SKU:</span>
                <span className="font-medium">{product.sku}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">In Stock:</span>
                <span className="font-medium text-green-600">
                  {product.inventory} available
                </span>
              </div>
            </div>
            
            {/* Add to Cart */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-lg font-medium">Quantity:</span>
                <div className="flex items-center border border-gray-300 rounded-lg">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="p-2 hover:bg-gray-100 transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="px-4 py-2 border-x border-gray-300 min-w-[3rem] text-center">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(Math.min(product.inventory, quantity + 1))}
                    className="p-2 hover:bg-gray-100 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <Button
                onClick={handleAddToCart}
                size="lg"
                className="w-full bg-salsa-500 hover:bg-salsa-600 text-lg py-3"
                disabled={product.inventory === 0}
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                {product.inventory === 0 ? 'Out of Stock' : 'Add to Cart'}
              </Button>
              
              {product.inventory <= 5 && product.inventory > 0 && (
                <p className="text-orange-600 text-sm">
                  Only {product.inventory} left in stock!
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
