import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as getProducts } from '@/app/api/products/route'
import { GET as getFeaturedProducts } from '@/app/api/products/featured/route'
import { GET as searchProducts, POST as autocompleteProducts } from '@/app/api/products/search/route'
import { GET as getRecommendations } from '@/app/api/products/[id]/recommendations/route'

/**
 * Product API Tests
 *
 * Testing approach:
 * - Uses Vitest vi.mock for internal dependencies (Prisma)
 * - MSW is available via vitest-setup.ts for external HTTP mocking if needed
 * - Tests verify product listing, search, filtering, and recommendation logic
 *
 * Note: MSW server is configured globally and resets between tests.
 * Use server.use() from 'msw/node' to add test-specific HTTP handlers.
 */

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  default: {
    product: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
  },
  prisma: {
    product: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
  },
}))

// Mock recommendations library
vi.mock('@/lib/recommendations', () => ({
  getFrequentlyBoughtTogether: vi.fn(),
  getYouMayAlsoLike: vi.fn(),
}))

describe('Products API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockProduct = {
    id: 'prod-1',
    name: 'Jose Madrid Mild Salsa',
    slug: 'jose-madrid-mild-salsa',
    description: 'Delicious mild salsa',
    price: 8.99,
    compareAtPrice: 10.99,
    featuredImage: '/images/mild.jpg',
    images: ['/images/mild.jpg'],
    heatLevel: 'MILD',
    sku: 'JMS-MILD-001',
    inventory: 100,
    isFeatured: true,
    isActive: true,
    ingredients: ['tomatoes', 'onions'],
    searchKeywords: ['mild', 'salsa'],
    productTags: [
      {
        tag: {
          id: 'tag-1',
          name: 'Best Seller',
          slug: 'best-seller',
        },
      },
    ],
    nutritionalInfo: {
      id: 'nutr-1',
      servingSize: '2 tbsp',
      calories: 10,
      totalFat: 0,
      saturatedFat: 0,
      transFat: 0,
      cholesterol: 0,
      sodium: 150,
      totalCarbohydrates: 2,
      dietaryFiber: 0,
      totalSugars: 1,
      addedSugars: 0,
      protein: 0,
    },
    productIngredients: [
      {
        ingredient: {
          id: 'ing-1',
          name: 'Tomatoes',
        },
        sortOrder: 1,
      },
    ],
  }

  describe('GET /api/products', () => {
    it('should return all active products', async () => {
      const prisma = (await import('@/lib/prisma')).default

      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct])

      const request = new NextRequest('http://localhost/api/products')
      const response = await getProducts(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data)).toBe(true)
      expect(data).toHaveLength(1)
      expect(data[0]).toMatchObject({
        id: 'prod-1',
        name: 'Jose Madrid Mild Salsa',
        slug: 'jose-madrid-mild-salsa',
        price: 8.99,
        heatLevel: 'MILD',
      })
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
          }),
        })
      )
    })

    it('should filter products by heat level', async () => {
      const prisma = (await import('@/lib/prisma')).default

      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct])

      const request = new NextRequest('http://localhost/api/products?heatLevel=MILD')
      const response = await getProducts(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            heatLevel: 'MILD',
          }),
        })
      )
    })

    it('should filter products by search query', async () => {
      const prisma = (await import('@/lib/prisma')).default

      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct])

      const request = new NextRequest('http://localhost/api/products?search=mild')
      const response = await getProducts(request)

      expect(response.status).toBe(200)
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            OR: expect.arrayContaining([
              expect.objectContaining({
                name: {
                  contains: 'mild',
                  mode: 'insensitive',
                },
              }),
            ]),
          }),
        })
      )
    })

    it('should filter featured products', async () => {
      const prisma = (await import('@/lib/prisma')).default

      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct])

      const request = new NextRequest('http://localhost/api/products?featured=true')
      const response = await getProducts(request)

      expect(response.status).toBe(200)
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            isFeatured: true,
          }),
        })
      )
    })

    it('should filter in-stock products', async () => {
      const prisma = (await import('@/lib/prisma')).default

      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct])

      const request = new NextRequest('http://localhost/api/products?inStock=true')
      const response = await getProducts(request)

      expect(response.status).toBe(200)
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            inventory: { gt: 0 },
          }),
        })
      )
    })

    it('should support pagination with take and skip', async () => {
      const prisma = (await import('@/lib/prisma')).default

      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct])

      const request = new NextRequest('http://localhost/api/products?take=10&skip=5')
      const response = await getProducts(request)

      expect(response.status).toBe(200)
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 5,
        })
      )
    })

    it('should filter by categories', async () => {
      const prisma = (await import('@/lib/prisma')).default

      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct])

      const request = new NextRequest('http://localhost/api/products?categories=salsa,dips')
      const response = await getProducts(request)

      expect(response.status).toBe(200)
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            category: {
              slug: { in: ['salsa', 'dips'] },
            },
          }),
        })
      )
    })

    it('should filter by tags', async () => {
      const prisma = (await import('@/lib/prisma')).default

      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct])

      const request = new NextRequest('http://localhost/api/products?tags=best-seller,new')
      const response = await getProducts(request)

      expect(response.status).toBe(200)
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            productTags: {
              some: {
                tag: {
                  slug: { in: ['best-seller', 'new'] },
                },
              },
            },
          }),
        })
      )
    })

    it('should handle database errors gracefully', async () => {
      const prisma = (await import('@/lib/prisma')).default

      vi.mocked(prisma.product.findMany).mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost/api/products')
      const response = await getProducts(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch products')
      expect(data.details).toBe('Database error')
    })
  })

  describe('GET /api/products/featured', () => {
    it('should return featured products only', async () => {
      const prisma = (await import('@/lib/prisma')).default

      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct])

      const response = await getFeaturedProducts()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data)).toBe(true)
      expect(data).toHaveLength(1)
      expect(data[0].isFeatured).toBe(true)
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            isFeatured: true,
          },
          take: 6,
        })
      )
    })

    it('should convert Decimal prices to numbers', async () => {
      const prisma = (await import('@/lib/prisma')).default

      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct])

      const response = await getFeaturedProducts()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(typeof data[0].price).toBe('number')
      expect(data[0].price).toBe(8.99)
    })

    it('should return mock data when database fails', async () => {
      const prisma = (await import('@/lib/prisma')).default

      vi.mocked(prisma.product.findMany).mockRejectedValue(new Error('Database error'))

      const response = await getFeaturedProducts()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBeGreaterThan(0)
    })
  })

  describe('GET /api/products/search', () => {
    it('should validate search parameters', async () => {
      const request = new NextRequest('http://localhost/api/products/search?limit=invalid')
      const response = await searchProducts(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid search parameters')
    })

    it('should search products by query', async () => {
      const prisma = (await import('@/lib/prisma')).default

      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct])
      vi.mocked(prisma.product.count).mockResolvedValue(1)

      const request = new NextRequest('http://localhost/api/products/search?q=mild')
      const response = await searchProducts(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.products).toHaveLength(1)
      expect(data.pagination).toMatchObject({
        total: 1,
        limit: 20,
        offset: 0,
        hasMore: false,
      })
      expect(data.query.q).toBe('mild')
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            OR: expect.arrayContaining([
              expect.objectContaining({
                name: {
                  contains: 'mild',
                  mode: 'insensitive',
                },
              }),
            ]),
          }),
        })
      )
    })

    it('should filter by heat level', async () => {
      const prisma = (await import('@/lib/prisma')).default

      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct])
      vi.mocked(prisma.product.count).mockResolvedValue(1)

      const request = new NextRequest('http://localhost/api/products/search?heatLevel=MILD')
      const response = await searchProducts(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.query.filters.heatLevel).toBe('MILD')
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            heatLevel: 'MILD',
          }),
        })
      )
    })

    it('should filter by price range', async () => {
      const prisma = (await import('@/lib/prisma')).default

      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct])
      vi.mocked(prisma.product.count).mockResolvedValue(1)

      const request = new NextRequest('http://localhost/api/products/search?minPrice=5&maxPrice=10')
      const response = await searchProducts(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.query.filters.minPrice).toBe(5)
      expect(data.query.filters.maxPrice).toBe(10)
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            price: {
              gte: 5,
              lte: 10,
            },
          }),
        })
      )
    })

    it('should filter in-stock products', async () => {
      const prisma = (await import('@/lib/prisma')).default

      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct])
      vi.mocked(prisma.product.count).mockResolvedValue(1)

      const request = new NextRequest('http://localhost/api/products/search?inStock=true')
      const response = await searchProducts(request)

      expect(response.status).toBe(200)
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            inventory: { gt: 0 },
          }),
        })
      )
    })

    it('should support sorting by price ascending', async () => {
      const prisma = (await import('@/lib/prisma')).default

      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct])
      vi.mocked(prisma.product.count).mockResolvedValue(1)

      const request = new NextRequest('http://localhost/api/products/search?sortBy=price-asc')
      const response = await searchProducts(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.query.sortBy).toBe('price-asc')
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { price: 'asc' },
        })
      )
    })

    it('should support sorting by price descending', async () => {
      const prisma = (await import('@/lib/prisma')).default

      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct])
      vi.mocked(prisma.product.count).mockResolvedValue(1)

      const request = new NextRequest('http://localhost/api/products/search?sortBy=price-desc')
      const response = await searchProducts(request)

      expect(response.status).toBe(200)
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { price: 'desc' },
        })
      )
    })

    it('should support pagination', async () => {
      const prisma = (await import('@/lib/prisma')).default

      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct])
      vi.mocked(prisma.product.count).mockResolvedValue(50)

      const request = new NextRequest('http://localhost/api/products/search?limit=10&offset=20')
      const response = await searchProducts(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.pagination).toMatchObject({
        total: 50,
        limit: 10,
        offset: 20,
        hasMore: true,
      })
    })

    it('should handle database errors', async () => {
      const prisma = (await import('@/lib/prisma')).default

      vi.mocked(prisma.product.findMany).mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost/api/products/search?q=test')
      const response = await searchProducts(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to search products')
    })
  })

  describe('POST /api/products/search', () => {
    it('should return autocomplete suggestions', async () => {
      const prisma = (await import('@/lib/prisma')).default

      vi.mocked(prisma.product.findMany).mockResolvedValue([
        {
          name: 'Jose Madrid Mild Salsa',
          slug: 'jose-madrid-mild-salsa',
          featuredImage: '/images/mild.jpg',
          price: 8.99,
          heatLevel: 'MILD',
        },
      ] as any)

      const request = new NextRequest('http://localhost/api/products/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'mild' }),
      })

      const response = await autocompleteProducts(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.suggestions).toHaveLength(1)
      expect(data.suggestions[0]).toMatchObject({
        name: 'Jose Madrid Mild Salsa',
        slug: 'jose-madrid-mild-salsa',
        price: 8.99,
      })
    })

    it('should return empty suggestions for short queries', async () => {
      const request = new NextRequest('http://localhost/api/products/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'a' }),
      })

      const response = await autocompleteProducts(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.suggestions).toEqual([])
    })

    it('should limit suggestions to 10 items', async () => {
      const prisma = (await import('@/lib/prisma')).default

      vi.mocked(prisma.product.findMany).mockResolvedValue([])

      const request = new NextRequest('http://localhost/api/products/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'salsa' }),
      })

      await autocompleteProducts(request)

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        })
      )
    })

    it('should handle errors gracefully', async () => {
      const prisma = (await import('@/lib/prisma')).default

      vi.mocked(prisma.product.findMany).mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost/api/products/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
      })

      const response = await autocompleteProducts(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to get suggestions')
    })
  })

  describe('GET /api/products/[id]/recommendations', () => {
    it('should return all recommendations by default', async () => {
      const { getFrequentlyBoughtTogether, getYouMayAlsoLike } = await import('@/lib/recommendations')

      const frequentlyBought = [
        {
          id: 'prod-2',
          name: 'Medium Salsa',
          slug: 'medium-salsa',
          price: 8.99,
          featuredImage: '/images/medium.jpg',
          heatLevel: 'MEDIUM',
          sku: 'JMS-MED-001',
          inventory: 50,
          score: 0.8,
        },
      ]

      const youMayLike = [
        {
          id: 'prod-3',
          name: 'Hot Salsa',
          slug: 'hot-salsa',
          price: 9.49,
          featuredImage: '/images/hot.jpg',
          heatLevel: 'HOT',
          sku: 'JMS-HOT-001',
          inventory: 30,
          score: 0.7,
        },
      ]

      vi.mocked(getFrequentlyBoughtTogether).mockResolvedValue(frequentlyBought)
      vi.mocked(getYouMayAlsoLike).mockResolvedValue(youMayLike)

      const request = new NextRequest('http://localhost/api/products/prod-1/recommendations')
      const response = await getRecommendations(request, { params: Promise.resolve({ id: 'prod-1' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.frequentlyBoughtTogether).toEqual(frequentlyBought)
      expect(data.youMayAlsoLike).toEqual(youMayLike)
      expect(getFrequentlyBoughtTogether).toHaveBeenCalledWith('prod-1', 4)
      expect(getYouMayAlsoLike).toHaveBeenCalledWith('prod-1', 8)
    })

    it('should return only frequently bought together when type is specified', async () => {
      const { getFrequentlyBoughtTogether, getYouMayAlsoLike } = await import('@/lib/recommendations')

      vi.mocked(getFrequentlyBoughtTogether).mockResolvedValue([])
      vi.mocked(getYouMayAlsoLike).mockResolvedValue([])

      const request = new NextRequest('http://localhost/api/products/prod-1/recommendations?type=frequently-bought')
      const response = await getRecommendations(request, { params: Promise.resolve({ id: 'prod-1' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.frequentlyBoughtTogether).toEqual([])
      expect(data.youMayAlsoLike).toEqual([])
      expect(getFrequentlyBoughtTogether).toHaveBeenCalled()
      expect(getYouMayAlsoLike).not.toHaveBeenCalled()
    })

    it('should return only similar products when type is specified', async () => {
      const { getFrequentlyBoughtTogether, getYouMayAlsoLike } = await import('@/lib/recommendations')

      vi.mocked(getFrequentlyBoughtTogether).mockResolvedValue([])
      vi.mocked(getYouMayAlsoLike).mockResolvedValue([])

      const request = new NextRequest('http://localhost/api/products/prod-1/recommendations?type=similar')
      const response = await getRecommendations(request, { params: Promise.resolve({ id: 'prod-1' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.frequentlyBoughtTogether).toEqual([])
      expect(data.youMayAlsoLike).toEqual([])
      expect(getFrequentlyBoughtTogether).not.toHaveBeenCalled()
      expect(getYouMayAlsoLike).toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      const { getFrequentlyBoughtTogether, getYouMayAlsoLike } = await import('@/lib/recommendations')

      vi.mocked(getFrequentlyBoughtTogether).mockRejectedValue(new Error('Database error'))
      vi.mocked(getYouMayAlsoLike).mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost/api/products/prod-1/recommendations')
      const response = await getRecommendations(request, { params: Promise.resolve({ id: 'prod-1' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch recommendations')
    })

    describe('Query Optimization Verification', () => {
      it('should return correctly structured frequently bought together products', async () => {
        const { getFrequentlyBoughtTogether } = await import('@/lib/recommendations')

        const mockRecommendations = [
          {
            id: 'prod-2',
            name: 'Medium Salsa',
            slug: 'medium-salsa',
            price: 8.99,
            featuredImage: '/images/medium.jpg',
            heatLevel: 'MEDIUM',
            sku: 'JMS-MED-001',
            inventory: 50,
            score: 1.0,
          },
          {
            id: 'prod-3',
            name: 'Hot Salsa',
            slug: 'hot-salsa',
            price: 9.49,
            featuredImage: '/images/hot.jpg',
            heatLevel: 'HOT',
            sku: 'JMS-HOT-001',
            inventory: 30,
            score: 0.67,
          },
        ]

        vi.mocked(getFrequentlyBoughtTogether).mockResolvedValue(mockRecommendations)

        const request = new NextRequest('http://localhost/api/products/prod-1/recommendations?type=frequently-bought')
        const response = await getRecommendations(request, { params: Promise.resolve({ id: 'prod-1' }) })
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.frequentlyBoughtTogether).toHaveLength(2)

        // Verify all required fields are present
        data.frequentlyBoughtTogether.forEach((product: any) => {
          expect(product).toHaveProperty('id')
          expect(product).toHaveProperty('name')
          expect(product).toHaveProperty('slug')
          expect(product).toHaveProperty('price')
          expect(product).toHaveProperty('featuredImage')
          expect(product).toHaveProperty('heatLevel')
          expect(product).toHaveProperty('sku')
          expect(product).toHaveProperty('inventory')
          expect(product).toHaveProperty('score')

          // Verify data types
          expect(typeof product.id).toBe('string')
          expect(typeof product.name).toBe('string')
          expect(typeof product.slug).toBe('string')
          expect(typeof product.price).toBe('number')
          expect(typeof product.sku).toBe('string')
          expect(typeof product.inventory).toBe('number')
          expect(typeof product.score).toBe('number')
        })
      })

      it('should verify scores are normalized between 0 and 1', async () => {
        const { getFrequentlyBoughtTogether } = await import('@/lib/recommendations')

        const mockRecommendations = [
          {
            id: 'prod-2',
            name: 'Product 2',
            slug: 'product-2',
            price: 10.0,
            featuredImage: '/images/2.jpg',
            heatLevel: 'MEDIUM',
            sku: 'SKU-2',
            inventory: 100,
            score: 1.0,
          },
          {
            id: 'prod-3',
            name: 'Product 3',
            slug: 'product-3',
            price: 10.0,
            featuredImage: '/images/3.jpg',
            heatLevel: 'MILD',
            sku: 'SKU-3',
            inventory: 50,
            score: 0.5,
          },
          {
            id: 'prod-4',
            name: 'Product 4',
            slug: 'product-4',
            price: 10.0,
            featuredImage: '/images/4.jpg',
            heatLevel: 'HOT',
            sku: 'SKU-4',
            inventory: 25,
            score: 0.25,
          },
        ]

        vi.mocked(getFrequentlyBoughtTogether).mockResolvedValue(mockRecommendations)

        const request = new NextRequest('http://localhost/api/products/prod-1/recommendations?type=frequently-bought')
        const response = await getRecommendations(request, { params: Promise.resolve({ id: 'prod-1' }) })
        const data = await response.json()

        expect(response.status).toBe(200)

        // Verify all scores are between 0 and 1
        data.frequentlyBoughtTogether.forEach((product: any) => {
          expect(product.score).toBeGreaterThanOrEqual(0)
          expect(product.score).toBeLessThanOrEqual(1)
        })

        // Verify scores are in descending order
        for (let i = 1; i < data.frequentlyBoughtTogether.length; i++) {
          expect(data.frequentlyBoughtTogether[i - 1].score).toBeGreaterThanOrEqual(
            data.frequentlyBoughtTogether[i].score
          )
        }
      })

      it('should respect the limit parameter for frequently bought together', async () => {
        const { getFrequentlyBoughtTogether } = await import('@/lib/recommendations')

        const mockRecommendations = [
          {
            id: 'prod-2',
            name: 'Product 2',
            slug: 'product-2',
            price: 10.0,
            featuredImage: '/images/2.jpg',
            heatLevel: 'MEDIUM',
            sku: 'SKU-2',
            inventory: 100,
            score: 1.0,
          },
          {
            id: 'prod-3',
            name: 'Product 3',
            slug: 'product-3',
            price: 10.0,
            featuredImage: '/images/3.jpg',
            heatLevel: 'MILD',
            sku: 'SKU-3',
            inventory: 50,
            score: 0.8,
          },
          {
            id: 'prod-4',
            name: 'Product 4',
            slug: 'product-4',
            price: 10.0,
            featuredImage: '/images/4.jpg',
            heatLevel: 'HOT',
            sku: 'SKU-4',
            inventory: 25,
            score: 0.6,
          },
          {
            id: 'prod-5',
            name: 'Product 5',
            slug: 'product-5',
            price: 10.0,
            featuredImage: '/images/5.jpg',
            heatLevel: 'EXTRA_HOT',
            sku: 'SKU-5',
            inventory: 10,
            score: 0.4,
          },
        ]

        vi.mocked(getFrequentlyBoughtTogether).mockResolvedValue(mockRecommendations)

        const request = new NextRequest('http://localhost/api/products/prod-1/recommendations?type=frequently-bought')
        const response = await getRecommendations(request, { params: Promise.resolve({ id: 'prod-1' }) })
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(getFrequentlyBoughtTogether).toHaveBeenCalledWith('prod-1', 4)
        expect(data.frequentlyBoughtTogether).toHaveLength(4)
      })

      it('should return empty array when no recommendations found', async () => {
        const { getFrequentlyBoughtTogether } = await import('@/lib/recommendations')

        vi.mocked(getFrequentlyBoughtTogether).mockResolvedValue([])

        const request = new NextRequest('http://localhost/api/products/prod-999/recommendations?type=frequently-bought')
        const response = await getRecommendations(request, { params: Promise.resolve({ id: 'prod-999' }) })
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.frequentlyBoughtTogether).toEqual([])
        expect(Array.isArray(data.frequentlyBoughtTogether)).toBe(true)
      })

      it('should verify price values are numbers not Decimals', async () => {
        const { getFrequentlyBoughtTogether } = await import('@/lib/recommendations')

        const mockRecommendations = [
          {
            id: 'prod-2',
            name: 'Product with Price',
            slug: 'product-with-price',
            price: 12.99,
            featuredImage: '/images/test.jpg',
            heatLevel: 'MEDIUM',
            sku: 'SKU-TEST',
            inventory: 100,
            score: 1.0,
          },
        ]

        vi.mocked(getFrequentlyBoughtTogether).mockResolvedValue(mockRecommendations)

        const request = new NextRequest('http://localhost/api/products/prod-1/recommendations?type=frequently-bought')
        const response = await getRecommendations(request, { params: Promise.resolve({ id: 'prod-1' }) })
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(typeof data.frequentlyBoughtTogether[0].price).toBe('number')
        expect(data.frequentlyBoughtTogether[0].price).toBe(12.99)
      })

      it('should verify inventory values are numbers', async () => {
        const { getFrequentlyBoughtTogether } = await import('@/lib/recommendations')

        const mockRecommendations = [
          {
            id: 'prod-2',
            name: 'Product with Inventory',
            slug: 'product-with-inventory',
            price: 10.0,
            featuredImage: '/images/test.jpg',
            heatLevel: 'MEDIUM',
            sku: 'SKU-TEST',
            inventory: 42,
            score: 1.0,
          },
        ]

        vi.mocked(getFrequentlyBoughtTogether).mockResolvedValue(mockRecommendations)

        const request = new NextRequest('http://localhost/api/products/prod-1/recommendations?type=frequently-bought')
        const response = await getRecommendations(request, { params: Promise.resolve({ id: 'prod-1' }) })
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(typeof data.frequentlyBoughtTogether[0].inventory).toBe('number')
        expect(data.frequentlyBoughtTogether[0].inventory).toBe(42)
      })
    })
  })
})
