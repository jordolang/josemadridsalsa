'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Navigation } from '@/components/store/navigation'
import { Footer } from '@/components/store/footer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ShoppingCart } from 'lucide-react'
import { useCartStore } from '@/lib/store/cart'
import { formatPrice, getHeatLevelColor, getHeatLevelText } from '@/lib/utils'

// Mock product data - in a real app this would come from your API/database
const products = [
  {
    id: '1',
    name: 'Jose Madrid Original Mild',
    slug: 'jose-madrid-original-mild',
    description: 'Our signature mild salsa made with fresh tomatoes, onions, and a perfect blend of spices.',
    price: 8.99,
    compareAtPrice: 10.99,
    featuredImage: '/images/products/mild.png',
    heatLevel: 'MILD',
    sku: 'JMS-MILD-001',
    inventory: 150,
    isFeatured: true,
  },
  {
    id: '2',
    name: 'Clovis Medium Salsa',
    slug: 'clovis-medium-salsa',
    description: 'Our most popular medium heat salsa with the perfect balance of flavor and spice.',
    price: 8.99,
    compareAtPrice: 10.99,
    featuredImage: '/images/products/clovis-medium.png',
    heatLevel: 'MEDIUM',
    sku: 'JMS-MED-001',
    inventory: 200,
    isFeatured: true,
  },
  {
    id: '3',
    name: 'Jose Madrid Hot Salsa',
    slug: 'jose-madrid-hot-salsa',
    description: 'For heat lovers! This bold salsa packs serious flavor with a kick that builds.',
    price: 9.49,
    compareAtPrice: 11.49,
    featuredImage: '/images/products/hot.png',
    heatLevel: 'HOT',
    sku: 'JMS-HOT-001',
    inventory: 80,
    isFeatured: true,
  },
  {
    id: '4',
    name: 'X-Hot Extreme Salsa',
    slug: 'x-hot-extreme-salsa',
    description: 'Our hottest salsa yet! Fire-roasted peppers create intense heat and incredible flavor.',
    price: 12.99,
    featuredImage: '/images/products/x-hot.png',
    heatLevel: 'EXTRA_HOT',
    sku: 'JMS-XHOT-001',
    inventory: 50,
    isFeatured: false,
  },
  {
    id: '5',
    name: 'Mango Habanero Salsa',
    slug: 'mango-habanero-salsa',
    description: 'Sweet tropical mango meets spicy habanero in this gourmet fruit salsa.',
    price: 11.99,
    featuredImage: '/images/products/mango-habanero.png',
    heatLevel: 'FRUIT',
    sku: 'JMS-FRUIT-001',
    inventory: 75,
    isFeatured: true,
  },
  {
    id: '6',
    name: 'Peach Mild Salsa',
    slug: 'peach-mild-salsa',
    description: 'Juicy peaches create a delightfully sweet and slightly spicy gourmet salsa.',
    price: 10.99,
    featuredImage: '/images/products/peach-mild.png',
    heatLevel: 'FRUIT',
    sku: 'JMS-FRUIT-002',
    inventory: 60,
    isFeatured: false,
  },
  {
    id: '7',
    name: 'Ghost of Clovis',
    slug: 'ghost-of-clovis',
    description: 'An otherworldly hot salsa that will haunt your taste buds with incredible flavor.',
    price: 13.99,
    featuredImage: '/images/products/ghost-of-clovis.png',
    heatLevel: 'EXTRA_HOT',
    sku: 'JMS-GHOST-001',
    inventory: 25,
    isFeatured: false,
  },
  {
    id: '8',
    name: 'Black Bean Corn Poblano',
    slug: 'black-bean-corn-poblano',
    description: 'A hearty salsa with black beans, sweet corn, and roasted poblano peppers.',
    price: 9.99,
    featuredImage: '/images/products/black-bean-corn-poblano-salsa.png',
    heatLevel: 'MEDIUM',
    sku: 'JMS-BBCP-001',
    inventory: 90,
    isFeatured: false,
  },
]

const heatLevels = [
  { value: 'all', label: 'All Heat Levels' },
  { value: 'MILD', label: 'Mild' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HOT', label: 'Hot' },
  { value: 'EXTRA_HOT', label: 'Extra Hot' },
  { value: 'FRUIT', label: 'Fruit Salsas' },
]

export default function SalsasPage() {
  const [selectedHeatLevel, setSelectedHeatLevel] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const addItem = useCartStore((state) => state.addItem)
  const openCart = useCartStore((state) => state.openCart)

  const handleAddToCart = (product: typeof products[0]) => {
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

  // Filter products based on search and heat level
  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesHeatLevel = selectedHeatLevel === 'all' || product.heatLevel === selectedHeatLevel
    return matchesSearch && matchesHeatLevel
  })

  return (
    <main className="min-h-screen bg-gray-50">
      <Navigation />
      
      {/* Header */}
      <section className="bg-white py-12 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold font-serif text-gray-900 mb-4">
              Our Premium <span className="text-gradient">Salsas</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Discover our complete collection of handcrafted salsas, from mild and family-friendly to scorching hot.
            </p>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="bg-white py-6 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Input
                type="search"
                placeholder="Search salsas..."
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
          
          <div className="mt-4 text-sm text-gray-600">
            Showing {filteredProducts.length} of {products.length} salsas
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No salsas found matching your criteria.</p>
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
                <div
                  key={product.id}
                  className="group bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden"
                >
                  <Link href={`/salsas/${product.slug}`}>
                    <div className="relative aspect-square bg-gray-100">
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
                          <Badge className="bg-salsa-500 text-white">
                            Featured
                          </Badge>
                        )}
                        {product.compareAtPrice && (
                          <Badge className="bg-green-500 text-white">
                            Sale
                          </Badge>
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
                      <h3 className="font-semibold text-lg text-gray-900 hover:text-salsa-600 transition-colors line-clamp-2 mb-2">
                        {product.name}
                      </h3>
                    </Link>
                    
                    <p className="text-sm text-gray-600 line-clamp-2 mb-4">
                      {product.description}
                    </p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-gray-900">
                          {formatPrice(product.price)}
                        </span>
                        {product.compareAtPrice && (
                          <span className="text-sm text-gray-500 line-through">
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
                        Add to Cart
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
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </main>
  )
}