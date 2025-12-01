'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'
import { ProductCard } from '@/components/store/product-card'

type Salsa = {
  id: string
  name: string
  slug: string
  description: string | null
  price: number
  compareAtPrice?: number | null
  featuredImage: string | null
  heatLevel: string
  sku: string
  inventory: number
  isFeatured: boolean
}

const heatLevels = [
  { value: 'all', label: 'All Heat Levels' },
  { value: 'MILD', label: 'Mild' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HOT', label: 'Hot' },
  { value: 'EXTRA_HOT', label: 'Extra Hot' },
  { value: 'FRUIT', label: 'Fruit Salsas' },
]

export default function SalsasPage() {
  const [salsas, setSalsas] = useState<Salsa[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedHeatLevel, setSelectedHeatLevel] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const fetchSalsas = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/salsas')
        if (!response.ok) throw new Error('Failed to fetch salsas')
        const data = await response.json()
        setSalsas(data)
      } catch (error) {
        console.error('Error fetching salsas:', error)
        setSalsas([])
      } finally {
        setLoading(false)
      }
    }
    fetchSalsas()
  }, [])

  // Filter salsas based on search and heat level
  const filteredSalsas = salsas.filter((salsa) => {
    const normalizedSearch = searchTerm.toLowerCase()
    const matchesSearch =
      salsa.name.toLowerCase().includes(normalizedSearch) ||
      (salsa.description?.toLowerCase() ?? '').includes(normalizedSearch)
    const matchesHeatLevel = selectedHeatLevel === 'all' || salsa.heatLevel === selectedHeatLevel
    return matchesSearch && matchesHeatLevel
  })

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <section className="bg-card py-12 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold font-serif text-foreground mb-4">
              Our Premium <span className="text-gradient">Salsas</span>
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
          
          <div className="mt-4 text-sm text-muted-foreground">
            Showing {filteredSalsas.length} of {salsas.length} salsas
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-salsa-500" />
              <span className="ml-2 text-lg">Loading salsas...</span>
            </div>
          ) : filteredSalsas.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">No salsas found matching your criteria.</p>
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
              {filteredSalsas.map((salsa) => (
                <ProductCard key={salsa.id} product={salsa} />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
