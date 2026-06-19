import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getFrequentlyBoughtTogether, getYouMayAlsoLike, getPersonalizedRecommendations, getComplementaryRecommendations } from '@/lib/recommendations'
import { prisma } from '@/lib/prisma'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    product: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    order: {
      findMany: vi.fn(),
    },
  },
}))

describe('getFrequentlyBoughtTogether', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return frequently bought together products with normalized scores', async () => {
    const mockResults = [
      {
        id: 'prod-2',
        name: 'Hot Salsa',
        slug: 'hot-salsa',
        price: 10.99,
        featuredImage: '/images/hot.jpg',
        heatLevel: 'HOT',
        sku: 'JMS-HOT-001',
        inventory: 50,
        co_occurrence_count: 25,
        max_count: 25,
      },
      {
        id: 'prod-3',
        name: 'Medium Salsa',
        slug: 'medium-salsa',
        price: 9.99,
        featuredImage: '/images/medium.jpg',
        heatLevel: 'MEDIUM',
        sku: 'JMS-MED-001',
        inventory: 75,
        co_occurrence_count: 15,
        max_count: 25,
      },
    ]

    vi.mocked(prisma.$queryRaw).mockResolvedValue(mockResults as any)

    const result = await getFrequentlyBoughtTogether('prod-1', 4)

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      id: 'prod-2',
      name: 'Hot Salsa',
      slug: 'hot-salsa',
      price: 10.99,
      featuredImage: '/images/hot.jpg',
      heatLevel: 'HOT',
      sku: 'JMS-HOT-001',
      inventory: 50,
      score: 1.0, // 25/25
    })
    expect(result[1]).toMatchObject({
      id: 'prod-3',
      name: 'Medium Salsa',
      slug: 'medium-salsa',
      price: 9.99,
      featuredImage: '/images/medium.jpg',
      heatLevel: 'MEDIUM',
      sku: 'JMS-MED-001',
      inventory: 75,
      score: 0.6, // 15/25
    })
  })

  it('should convert string prices to numbers', async () => {
    const mockResults = [
      {
        id: 'prod-2',
        name: 'Hot Salsa',
        slug: 'hot-salsa',
        price: '10.99', // String price from database
        featuredImage: '/images/hot.jpg',
        heatLevel: 'HOT',
        sku: 'JMS-HOT-001',
        inventory: 50,
        co_occurrence_count: 20,
        max_count: 20,
      },
    ]

    vi.mocked(prisma.$queryRaw).mockResolvedValue(mockResults as any)

    const result = await getFrequentlyBoughtTogether('prod-1', 4)

    expect(result).toHaveLength(1)
    expect(typeof result[0].price).toBe('number')
    expect(result[0].price).toBe(10.99)
    expect(typeof result[0].inventory).toBe('number')
    expect(result[0].inventory).toBe(50)
  })

  it('should handle empty results gracefully', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([])

    const result = await getFrequentlyBoughtTogether('prod-1', 4)

    expect(result).toEqual([])
    expect(result).toHaveLength(0)
  })

  it('should handle zero max_count without division by zero', async () => {
    const mockResults = [
      {
        id: 'prod-2',
        name: 'Hot Salsa',
        slug: 'hot-salsa',
        price: 10.99,
        featured_image: '/images/hot.jpg',
        heat_level: 'HOT',
        sku: 'JMS-HOT-001',
        inventory: 50,
        co_occurrence_count: 0,
        max_count: 0,
      },
    ]

    vi.mocked(prisma.$queryRaw).mockResolvedValue(mockResults as any)

    const result = await getFrequentlyBoughtTogether('prod-1', 4)

    expect(result).toHaveLength(1)
    expect(result[0].score).toBe(0)
  })

  it('should handle null featured_image and heat_level', async () => {
    const mockResults = [
      {
        id: 'prod-2',
        name: 'Hot Salsa',
        slug: 'hot-salsa',
        price: 10.99,
        featuredImage: null,
        heatLevel: null,
        sku: 'JMS-HOT-001',
        inventory: 50,
        co_occurrence_count: 10,
        max_count: 10,
      },
    ]

    vi.mocked(prisma.$queryRaw).mockResolvedValue(mockResults as any)

    const result = await getFrequentlyBoughtTogether('prod-1', 4)

    expect(result).toHaveLength(1)
    expect(result[0].featuredImage).toBeNull()
    expect(result[0].heatLevel).toBeNull()
  })

  it('should respect the limit parameter', async () => {
    const mockResults = [
      {
        id: 'prod-2',
        name: 'Product 2',
        slug: 'product-2',
        price: 10.99,
        featured_image: null,
        heat_level: 'HOT',
        sku: 'SKU-002',
        inventory: 50,
        co_occurrence_count: 20,
        max_count: 20,
      },
      {
        id: 'prod-3',
        name: 'Product 3',
        slug: 'product-3',
        price: 11.99,
        featured_image: null,
        heat_level: 'MEDIUM',
        sku: 'SKU-003',
        inventory: 40,
        co_occurrence_count: 15,
        max_count: 20,
      },
    ]

    vi.mocked(prisma.$queryRaw).mockResolvedValue(mockResults as any)

    // The SQL query should use the limit parameter
    await getFrequentlyBoughtTogether('prod-1', 2)

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)
  })

  it('should return empty array on error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('Database error'))

    const result = await getFrequentlyBoughtTogether('prod-1', 4)

    expect(result).toEqual([])
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error getting frequently bought together:',
      expect.any(Error)
    )
    consoleErrorSpy.mockRestore()
  })
})

describe('getYouMayAlsoLike', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return similar products with correct scoring', async () => {
    const sourceProduct = {
      categoryId: 'cat-1',
      heatLevel: 'MEDIUM',
      price: 10.0,
    }

    const similarProducts = [
      {
        id: 'prod-2',
        name: 'Similar Salsa 1',
        slug: 'similar-salsa-1',
        price: 10.5, // Within 30% price range
        featuredImage: '/images/similar1.jpg',
        heatLevel: 'MEDIUM', // Same heat level
        sku: 'SIM-001',
        inventory: 50,
        categoryId: 'cat-1', // Same category
      },
      {
        id: 'prod-3',
        name: 'Similar Salsa 2',
        slug: 'similar-salsa-2',
        price: 15.0, // Outside 30% price range
        featuredImage: '/images/similar2.jpg',
        heatLevel: 'MEDIUM', // Same heat level
        sku: 'SIM-002',
        inventory: 40,
        categoryId: 'cat-2', // Different category
      },
      {
        id: 'prod-4',
        name: 'Similar Salsa 3',
        slug: 'similar-salsa-3',
        price: 9.0, // Within 30% price range
        featuredImage: '/images/similar3.jpg',
        heatLevel: 'HOT', // Different heat level
        sku: 'SIM-003',
        inventory: 30,
        categoryId: 'cat-1', // Same category
      },
    ]

    vi.mocked(prisma.product.findUnique).mockResolvedValue(sourceProduct as any)
    vi.mocked(prisma.product.findMany).mockResolvedValue(similarProducts as any)

    const result = await getYouMayAlsoLike('prod-1', 8)

    expect(result).toHaveLength(3)

    // First product should have highest score: same heat (0.4) + same category (0.4) + similar price (0.2) = 1.0
    expect(result[0].id).toBe('prod-2')
    expect(result[0].score).toBeCloseTo(1.0, 5)

    // Second product should have: same category (0.4) + similar price (0.2) = 0.6
    expect(result[1].id).toBe('prod-4')
    expect(result[1].score).toBeCloseTo(0.6, 5)

    // Third product should have: same heat level (0.4) = 0.4
    expect(result[2].id).toBe('prod-3')
    expect(result[2].score).toBeCloseTo(0.4, 5)
  })

  it('should calculate price similarity correctly', async () => {
    const sourceProduct = {
      categoryId: 'cat-1',
      heatLevel: 'MEDIUM',
      price: 10.0,
    }

    // Within 30% range: 7.0 to 13.0
    const similarProducts = [
      {
        id: 'prod-2',
        name: 'Within Range',
        slug: 'within-range',
        price: 12.99, // Within 30%
        featuredImage: null,
        heatLevel: null,
        sku: 'WR-001',
        inventory: 50,
        categoryId: null,
      },
      {
        id: 'prod-3',
        name: 'Outside Range',
        slug: 'outside-range',
        price: 14.0, // Outside 30%
        featuredImage: null,
        heatLevel: null,
        sku: 'OR-001',
        inventory: 40,
        categoryId: null,
      },
    ]

    vi.mocked(prisma.product.findUnique).mockResolvedValue(sourceProduct as any)
    vi.mocked(prisma.product.findMany).mockResolvedValue(similarProducts as any)

    const result = await getYouMayAlsoLike('prod-1', 8)

    expect(result).toHaveLength(2)
    expect(result[0].score).toBe(0.2) // Within price range
    expect(result[1].score).toBe(0) // Outside price range
  })

  it('should return empty array if product not found', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue(null)

    const result = await getYouMayAlsoLike('nonexistent', 8)

    expect(result).toEqual([])
    expect(prisma.product.findMany).not.toHaveBeenCalled()
  })

  it('should handle empty similar products', async () => {
    const sourceProduct = {
      categoryId: 'cat-1',
      heatLevel: 'MEDIUM',
      price: 10.0,
    }

    vi.mocked(prisma.product.findUnique).mockResolvedValue(sourceProduct as any)
    vi.mocked(prisma.product.findMany).mockResolvedValue([])

    const result = await getYouMayAlsoLike('prod-1', 8)

    expect(result).toEqual([])
  })

  it('should respect the limit parameter', async () => {
    const sourceProduct = {
      categoryId: 'cat-1',
      heatLevel: 'MEDIUM',
      price: 10.0,
    }

    const manyProducts = Array.from({ length: 20 }, (_, i) => ({
      id: `prod-${i}`,
      name: `Product ${i}`,
      slug: `product-${i}`,
      price: 10.0,
      featuredImage: null,
      heatLevel: 'MEDIUM',
      sku: `SKU-${i}`,
      inventory: 50,
      categoryId: 'cat-1',
    }))

    vi.mocked(prisma.product.findUnique).mockResolvedValue(sourceProduct as any)
    vi.mocked(prisma.product.findMany).mockResolvedValue(manyProducts as any)

    const result = await getYouMayAlsoLike('prod-1', 5)

    expect(result).toHaveLength(5)
  })

  it('should convert Decimal prices to numbers', async () => {
    const sourceProduct = {
      categoryId: 'cat-1',
      heatLevel: 'MEDIUM',
      price: 10.0,
    }

    const similarProducts = [
      {
        id: 'prod-2',
        name: 'Product',
        slug: 'product',
        price: { toString: () => '10.99' }, // Prisma Decimal mock
        featuredImage: null,
        heatLevel: 'MEDIUM',
        sku: 'SKU-001',
        inventory: 50,
        categoryId: 'cat-1',
      },
    ]

    vi.mocked(prisma.product.findUnique).mockResolvedValue(sourceProduct as any)
    vi.mocked(prisma.product.findMany).mockResolvedValue(similarProducts as any)

    const result = await getYouMayAlsoLike('prod-1', 8)

    expect(result).toHaveLength(1)
    expect(typeof result[0].price).toBe('number')
    expect(result[0].price).toBe(10.99)
  })

  it('should return empty array on error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(prisma.product.findUnique).mockRejectedValue(new Error('Database error'))

    const result = await getYouMayAlsoLike('prod-1', 8)

    expect(result).toEqual([])
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error getting you may also like:',
      expect.any(Error)
    )
    consoleErrorSpy.mockRestore()
  })
})

describe('getPersonalizedRecommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return personalized recommendations based on purchase history', async () => {
    const userOrders = [
      {
        id: 'order-1',
        userId: 'user-1',
        paymentStatus: 'PAID',
        createdAt: new Date(),
        items: [
          {
            productId: 'prod-1',
            product: {
              categoryId: 'cat-1',
              heatLevel: 'MEDIUM',
            },
          },
          {
            productId: 'prod-2',
            product: {
              categoryId: 'cat-1',
              heatLevel: 'MEDIUM',
            },
          },
        ],
      },
      {
        id: 'order-2',
        userId: 'user-1',
        paymentStatus: 'PAID',
        createdAt: new Date(),
        items: [
          {
            productId: 'prod-3',
            product: {
              categoryId: 'cat-1',
              heatLevel: 'HOT',
            },
          },
        ],
      },
    ]

    const recommendations = [
      {
        id: 'prod-4',
        name: 'New Product',
        slug: 'new-product',
        price: 12.99,
        featuredImage: '/images/new.jpg',
        heatLevel: 'MEDIUM',
        sku: 'NEW-001',
        inventory: 50,
        categoryId: 'cat-1',
      },
    ]

    vi.mocked(prisma.order.findMany).mockResolvedValue(userOrders as any)
    vi.mocked(prisma.product.findMany).mockResolvedValue(recommendations as any)

    const result = await getPersonalizedRecommendations('user-1', 8)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'prod-4',
      name: 'New Product',
      slug: 'new-product',
      price: 12.99,
      score: 0.8,
    })

    // Verify it excludes already purchased products
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { notIn: ['prod-1', 'prod-2', 'prod-3'] },
        }),
      })
    )
  })

  it('should prioritize most frequent category and heat level', async () => {
    const userOrders = [
      {
        id: 'order-1',
        userId: 'user-1',
        paymentStatus: 'PAID',
        createdAt: new Date(),
        items: [
          {
            productId: 'prod-1',
            product: { categoryId: 'cat-1', heatLevel: 'MEDIUM' },
          },
          {
            productId: 'prod-2',
            product: { categoryId: 'cat-1', heatLevel: 'MEDIUM' },
          },
          {
            productId: 'prod-3',
            product: { categoryId: 'cat-2', heatLevel: 'HOT' },
          },
        ],
      },
    ]

    vi.mocked(prisma.order.findMany).mockResolvedValue(userOrders as any)
    vi.mocked(prisma.product.findMany).mockResolvedValue([])

    await getPersonalizedRecommendations('user-1', 8)

    // Should query for cat-1 (appears twice) and MEDIUM (appears twice)
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { categoryId: { in: ['cat-1'] } },
            { heatLevel: { in: ['MEDIUM'] } },
          ],
        }),
      })
    )
  })

  it('should handle users with no order history', async () => {
    vi.mocked(prisma.order.findMany).mockResolvedValue([])
    vi.mocked(prisma.product.findMany).mockResolvedValue([])

    const result = await getPersonalizedRecommendations('user-1', 8)

    expect(result).toEqual([])
  })

  it('should handle null categoryId and heatLevel', async () => {
    const userOrders = [
      {
        id: 'order-1',
        userId: 'user-1',
        paymentStatus: 'PAID',
        createdAt: new Date(),
        items: [
          {
            productId: 'prod-1',
            product: {
              categoryId: null,
              heatLevel: null,
            },
          },
        ],
      },
    ]

    vi.mocked(prisma.order.findMany).mockResolvedValue(userOrders as any)
    vi.mocked(prisma.product.findMany).mockResolvedValue([])

    const result = await getPersonalizedRecommendations('user-1', 8)

    expect(result).toEqual([])
  })

  it('should convert Decimal prices to numbers', async () => {
    const userOrders = [
      {
        id: 'order-1',
        userId: 'user-1',
        paymentStatus: 'PAID',
        createdAt: new Date(),
        items: [
          {
            productId: 'prod-1',
            product: {
              categoryId: 'cat-1',
              heatLevel: 'MEDIUM',
            },
          },
        ],
      },
    ]

    const recommendations = [
      {
        id: 'prod-2',
        name: 'Product',
        slug: 'product',
        price: { toString: () => '12.99' }, // Prisma Decimal mock
        featuredImage: null,
        heatLevel: 'MEDIUM',
        sku: 'SKU-001',
        inventory: 50,
        categoryId: 'cat-1',
      },
    ]

    vi.mocked(prisma.order.findMany).mockResolvedValue(userOrders as any)
    vi.mocked(prisma.product.findMany).mockResolvedValue(recommendations as any)

    const result = await getPersonalizedRecommendations('user-1', 8)

    expect(result).toHaveLength(1)
    expect(typeof result[0].price).toBe('number')
    expect(result[0].price).toBe(12.99)
  })

  it('should respect the limit parameter', async () => {
    const userOrders = [
      {
        id: 'order-1',
        userId: 'user-1',
        paymentStatus: 'PAID',
        createdAt: new Date(),
        items: [
          {
            productId: 'prod-1',
            product: { categoryId: 'cat-1', heatLevel: 'MEDIUM' },
          },
        ],
      },
    ]

    vi.mocked(prisma.order.findMany).mockResolvedValue(userOrders as any)
    vi.mocked(prisma.product.findMany).mockResolvedValue([])

    await getPersonalizedRecommendations('user-1', 5)

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
      })
    )
  })

  it('should only consider PAID orders', async () => {
    const userOrders = [
      {
        id: 'order-1',
        userId: 'user-1',
        paymentStatus: 'PAID',
        createdAt: new Date(),
        items: [
          {
            productId: 'prod-1',
            product: { categoryId: 'cat-1', heatLevel: 'MEDIUM' },
          },
        ],
      },
    ]

    vi.mocked(prisma.order.findMany).mockResolvedValue(userOrders as any)
    vi.mocked(prisma.product.findMany).mockResolvedValue([])

    await getPersonalizedRecommendations('user-1', 8)

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          paymentStatus: 'PAID',
        }),
      })
    )
  })

  it('should return empty array on error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(prisma.order.findMany).mockRejectedValue(new Error('Database error'))

    const result = await getPersonalizedRecommendations('user-1', 8)

    expect(result).toEqual([])
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error getting personalized recommendations:',
      expect.any(Error)
    )
    consoleErrorSpy.mockRestore()
  })
})

describe('getComplementaryRecommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.product.findMany).mockReset()
  })

  it('should return complementary products with different heat levels and same categories', async () => {
    const purchasedProducts = [
      {
        id: 'prod-1',
        categoryId: 'cat-salsa',
        heatLevel: 'MEDIUM',
      },
      {
        id: 'prod-2',
        categoryId: 'cat-salsa',
        heatLevel: 'MEDIUM',
      },
    ]

    const complementaryProducts = [
      {
        id: 'prod-3',
        name: 'Hot Salsa',
        slug: 'hot-salsa',
        price: 10.99,
        featuredImage: '/images/hot.jpg',
        heatLevel: 'HOT', // Different heat level
        sku: 'HOT-001',
        inventory: 50,
        categoryId: 'cat-salsa', // Same category
      },
      {
        id: 'prod-4',
        name: 'Mild Salsa',
        slug: 'mild-salsa',
        price: 9.99,
        featuredImage: '/images/mild.jpg',
        heatLevel: 'MILD', // Different heat level
        sku: 'MILD-001',
        inventory: 40,
        categoryId: 'cat-salsa', // Same category
      },
      {
        id: 'prod-5',
        name: 'Hot Sauce',
        slug: 'hot-sauce',
        price: 11.99,
        featuredImage: '/images/hot-sauce.jpg',
        heatLevel: 'HOT', // Different heat level
        sku: 'HOT-002',
        inventory: 30,
        categoryId: 'cat-sauce', // Different category
      },
    ]

    vi.mocked(prisma.product.findMany)
      .mockResolvedValueOnce(purchasedProducts as any)
      .mockResolvedValueOnce(complementaryProducts as any)

    const result = await getComplementaryRecommendations(['prod-1', 'prod-2'], 4)

    expect(result).toHaveLength(3)

    // Products with same category AND different heat level should score highest (1.0)
    expect(result[0].id).toBe('prod-3')
    expect(result[0].score).toBe(1.0)
    expect(result[1].id).toBe('prod-4')
    expect(result[1].score).toBe(1.0)

    // Products with different heat level but different category should score lower (0.5)
    expect(result[2].id).toBe('prod-5')
    expect(result[2].score).toBe(0.5)
  })

  it('should exclude already purchased products', async () => {
    const purchasedProducts = [
      {
        id: 'prod-1',
        categoryId: 'cat-salsa',
        heatLevel: 'MEDIUM',
      },
    ]

    const complementaryProducts = [
      {
        id: 'prod-2',
        name: 'Hot Salsa',
        slug: 'hot-salsa',
        price: 10.99,
        featuredImage: '/images/hot.jpg',
        heatLevel: 'HOT',
        sku: 'HOT-001',
        inventory: 50,
        categoryId: 'cat-salsa',
      },
    ]

    vi.mocked(prisma.product.findMany)
      .mockResolvedValueOnce(purchasedProducts as any)
      .mockResolvedValueOnce(complementaryProducts as any)

    await getComplementaryRecommendations(['prod-1'], 4)

    // Verify that purchased product IDs are excluded
    expect(prisma.product.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { notIn: ['prod-1'] },
        }),
      })
    )
  })

  it('should handle empty purchased products array', async () => {
    const result = await getComplementaryRecommendations([], 4)

    expect(result).toEqual([])
    expect(prisma.product.findMany).not.toHaveBeenCalled()
  })

  it('should handle products with null categoryId and heatLevel', async () => {
    const purchasedProducts = [
      {
        id: 'prod-1',
        categoryId: null,
        heatLevel: null,
      },
    ]

    vi.mocked(prisma.product.findMany)
      .mockResolvedValueOnce(purchasedProducts as any)
      .mockResolvedValueOnce([])

    const result = await getComplementaryRecommendations(['prod-1'], 4)

    expect(result).toEqual([])
  })

  it('should convert Decimal prices to numbers', async () => {
    const purchasedProducts = [
      {
        id: 'prod-1',
        categoryId: 'cat-salsa',
        heatLevel: 'MEDIUM',
      },
    ]

    const complementaryProducts = [
      {
        id: 'prod-2',
        name: 'Hot Salsa',
        slug: 'hot-salsa',
        price: 10.99,
        featuredImage: '/images/hot.jpg',
        heatLevel: 'HOT',
        sku: 'HOT-001',
        inventory: 50,
        categoryId: 'cat-salsa',
      },
    ]

    vi.mocked(prisma.product.findMany)
      .mockResolvedValueOnce(purchasedProducts as any)
      .mockResolvedValueOnce(complementaryProducts as any)

    const result = await getComplementaryRecommendations(['prod-1'], 4)

    expect(result).toHaveLength(1)
    expect(typeof result[0].price).toBe('number')
    expect(result[0].price).toBe(10.99)
  })

  it('should respect the limit parameter', async () => {
    const purchasedProducts = [
      {
        id: 'prod-1',
        categoryId: 'cat-salsa',
        heatLevel: 'MEDIUM',
      },
    ]

    const manyProducts = Array.from({ length: 20 }, (_, i) => ({
      id: `prod-${i + 2}`,
      name: `Product ${i + 2}`,
      slug: `product-${i + 2}`,
      price: 10.0,
      featuredImage: null,
      heatLevel: 'HOT',
      sku: `SKU-${i + 2}`,
      inventory: 50,
      categoryId: 'cat-salsa',
    }))

    vi.mocked(prisma.product.findMany)
      .mockResolvedValueOnce(purchasedProducts as any)
      .mockResolvedValueOnce(manyProducts as any)

    const result = await getComplementaryRecommendations(['prod-1'], 3)

    expect(result).toHaveLength(3)
  })

  it('should only recommend products with different heat levels', async () => {
    const purchasedProducts = [
      {
        id: 'prod-1',
        categoryId: 'cat-salsa',
        heatLevel: 'MEDIUM',
      },
    ]

    const complementaryProducts = [
      {
        id: 'prod-2',
        name: 'Hot Salsa',
        slug: 'hot-salsa',
        price: 10.99,
        featuredImage: '/images/hot.jpg',
        heatLevel: 'HOT', // Different
        sku: 'HOT-001',
        inventory: 50,
        categoryId: 'cat-salsa',
      },
      {
        id: 'prod-3',
        name: 'Another Medium Salsa',
        slug: 'medium-salsa',
        price: 9.99,
        featuredImage: '/images/medium.jpg',
        heatLevel: 'MEDIUM', // Same - should be filtered out
        sku: 'MED-001',
        inventory: 40,
        categoryId: 'cat-salsa',
      },
    ]

    vi.mocked(prisma.product.findMany)
      .mockResolvedValueOnce(purchasedProducts as any)
      .mockResolvedValueOnce(complementaryProducts as any)

    const result = await getComplementaryRecommendations(['prod-1'], 4)

    // Should only include prod-2 (HOT), not prod-3 (MEDIUM - same as purchased)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('prod-2')
  })

  it('should prioritize same category over different category', async () => {
    const purchasedProducts = [
      {
        id: 'prod-1',
        categoryId: 'cat-salsa',
        heatLevel: 'MEDIUM',
      },
    ]

    const complementaryProducts = [
      {
        id: 'prod-2',
        name: 'Hot Sauce',
        slug: 'hot-sauce',
        price: 11.99,
        featuredImage: '/images/hot-sauce.jpg',
        heatLevel: 'HOT',
        sku: 'HOT-002',
        inventory: 30,
        categoryId: 'cat-sauce', // Different category
      },
      {
        id: 'prod-3',
        name: 'Hot Salsa',
        slug: 'hot-salsa',
        price: 10.99,
        featuredImage: '/images/hot.jpg',
        heatLevel: 'HOT',
        sku: 'HOT-001',
        inventory: 50,
        categoryId: 'cat-salsa', // Same category
      },
    ]

    vi.mocked(prisma.product.findMany)
      .mockResolvedValueOnce(purchasedProducts as any)
      .mockResolvedValueOnce(complementaryProducts as any)

    const result = await getComplementaryRecommendations(['prod-1'], 4)

    // Same category should come first
    expect(result[0].id).toBe('prod-3')
    expect(result[0].score).toBe(1.0)
    expect(result[1].id).toBe('prod-2')
    expect(result[1].score).toBe(0.5)
  })

  it('should return empty array on error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(prisma.product.findMany).mockRejectedValue(new Error('Database error'))

    const result = await getComplementaryRecommendations(['prod-1'], 4)

    expect(result).toEqual([])
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error getting complementary recommendations:',
      expect.any(Error)
    )
    consoleErrorSpy.mockRestore()
  })
})
