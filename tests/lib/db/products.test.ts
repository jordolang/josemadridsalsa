import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getProducts, getProductBySlug, getCategories, getProductsCount } from '@/lib/db/products'
import prisma from '@/lib/prisma'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  default: {
    product: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
    },
  },
}))

describe('getProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should filter by category correctly', async () => {
    const mockProducts = [
      {
        id: '1',
        name: 'Test Product',
        slug: 'test-product',
        price: 9.99,
        compareAtPrice: null,
        costPrice: null,
        weight: null,
        variants: [],
        nutritionalInfo: null,
        category: { slug: 'mild-salsas' },
        productTags: [],
      },
    ]

    vi.mocked(prisma.product.findMany).mockResolvedValue(mockProducts as any)

    const result = await getProducts({ category: 'mild-salsas' })

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          category: {
            slug: 'mild-salsas',
          },
        }),
      })
    )
    expect(result).toHaveLength(1)
    expect(result[0].category.slug).toBe('mild-salsas')
  })

  it('should filter by heatLevel correctly', async () => {
    const mockProducts = [
      {
        id: '1',
        name: 'Hot Salsa',
        heatLevel: 'HOT',
        price: 9.99,
        compareAtPrice: null,
        costPrice: null,
        weight: null,
        variants: [],
      },
    ]

    vi.mocked(prisma.product.findMany).mockResolvedValue(mockProducts as any)

    await getProducts({ heatLevel: 'HOT' })

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          heatLevel: 'HOT',
        }),
      })
    )
  })

  it('should search across name, description, keywords, and SKU', async () => {
    const mockProducts = [
      {
        id: '1',
        name: 'Spicy Salsa',
        description: 'Very spicy',
        sku: 'SPICY-001',
        price: 9.99,
        compareAtPrice: null,
        costPrice: null,
        weight: null,
        variants: [],
      },
    ]

    vi.mocked(prisma.product.findMany).mockResolvedValue(mockProducts as any)

    await getProducts({ search: 'spicy' })

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { name: { contains: 'spicy', mode: 'insensitive' } },
            { description: { contains: 'spicy', mode: 'insensitive' } },
            { searchKeywords: { hasSome: ['spicy'] } },
            { sku: { contains: 'spicy', mode: 'insensitive' } },
          ]),
        }),
      })
    )
  })

  it('should filter by price range (minPrice and maxPrice)', async () => {
    const mockProducts = [
      {
        id: '1',
        name: 'Mid-range Salsa',
        price: 12.99,
        compareAtPrice: null,
        costPrice: null,
        weight: null,
        variants: [],
      },
    ]

    vi.mocked(prisma.product.findMany).mockResolvedValue(mockProducts as any)

    await getProducts({ minPrice: 10, maxPrice: 15 })

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          price: {
            gte: 10,
            lte: 15,
          },
        }),
      })
    )
  })

  it('should include variants and nutritionalInfo relations', async () => {
    const mockProducts = [
      {
        id: '1',
        name: 'Complete Product',
        price: 9.99,
        compareAtPrice: null,
        costPrice: null,
        weight: null,
        variants: [
          { id: 'v1', name: '16 oz', type: 'size', price: 12.99, inStock: true },
        ],
        nutritionalInfo: {
          id: 'n1',
          servingSize: '2 tbsp',
          calories: 10,
        },
        productTags: [],
      },
    ]

    vi.mocked(prisma.product.findMany).mockResolvedValue(mockProducts as any)

    const result = await getProducts()

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          variants: true,
          nutritionalInfo: true,
        }),
      })
    )
    expect(result[0].variants).toHaveLength(1)
    expect(result[0].nutritionalInfo).toBeDefined()
  })

  it('should handle empty results gracefully', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([])

    const result = await getProducts({ search: 'nonexistent' })

    expect(result).toEqual([])
    expect(result).toHaveLength(0)
  })

  it('should convert Decimal prices to numbers', async () => {
    // Mock Prisma Decimal objects that stringify correctly
    const mockDecimal = (value: number) => ({
      toString: () => String(value),
      valueOf: () => value,
    })

    const mockProducts = [
      {
        id: '1',
        name: 'Decimal Price Product',
        price: mockDecimal(9.99),
        compareAtPrice: mockDecimal(12.99),
        costPrice: mockDecimal(5.0),
        weight: mockDecimal(16.0),
        variants: [
          {
            id: 'v1',
            name: 'Large',
            price: mockDecimal(14.99),
          },
        ],
      },
    ]

    vi.mocked(prisma.product.findMany).mockResolvedValue(mockProducts as any)

    const result = await getProducts()

    // Verify price conversion
    expect(typeof result[0].price).toBe('number')
    expect(result[0].price).toBe(9.99)
    expect(typeof result[0].compareAtPrice).toBe('number')
    expect(result[0].compareAtPrice).toBe(12.99)
    expect(typeof result[0].costPrice).toBe('number')
    expect(result[0].costPrice).toBe(5.0)
    expect(typeof result[0].weight).toBe('number')
    expect(result[0].weight).toBe(16.0)
    expect(typeof result[0].variants[0].price).toBe('number')
    expect(result[0].variants[0].price).toBe(14.99)
  })

  it('should filter by inStock status', async () => {
    const mockProducts = [
      {
        id: '1',
        name: 'In Stock Product',
        inventory: 10,
        price: 9.99,
        compareAtPrice: null,
        costPrice: null,
        weight: null,
        variants: [],
      },
    ]

    vi.mocked(prisma.product.findMany).mockResolvedValue(mockProducts as any)

    await getProducts({ inStock: true })

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          inventory: { gt: 0 },
        }),
      })
    )
  })

  it('should filter by tags', async () => {
    const mockProducts = [
      {
        id: '1',
        name: 'Tagged Product',
        price: 9.99,
        compareAtPrice: null,
        costPrice: null,
        weight: null,
        variants: [],
        productTags: [{ tag: { slug: 'organic' } }],
      },
    ]

    vi.mocked(prisma.product.findMany).mockResolvedValue(mockProducts as any)

    await getProducts({ tags: ['organic', 'gluten-free'] })

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          productTags: {
            some: {
              tag: {
                slug: { in: ['organic', 'gluten-free'] },
              },
            },
          },
        }),
      })
    )
  })

  it('should handle pagination with take and skip', async () => {
    const mockProducts = [
      {
        id: '2',
        name: 'Second Page Product',
        price: 9.99,
        compareAtPrice: null,
        costPrice: null,
        weight: null,
        variants: [],
      },
    ]

    vi.mocked(prisma.product.findMany).mockResolvedValue(mockProducts as any)

    await getProducts({ take: 10, skip: 10 })

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        skip: 10,
      })
    )
  })
})

describe('getProductBySlug', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return product with all relations', async () => {
    const mockProduct = {
      id: '1',
      slug: 'test-salsa',
      name: 'Test Salsa',
      price: 9.99,
      compareAtPrice: null,
      costPrice: null,
      weight: null,
      category: { id: 'c1', name: 'Mild Salsas', slug: 'mild-salsas' },
      variants: [
        { id: 'v1', name: '16 oz', type: 'size', price: 12.99, inStock: true },
      ],
      nutritionalInfo: {
        id: 'n1',
        servingSize: '2 tbsp',
        calories: 10,
      },
      productTags: [],
    }

    vi.mocked(prisma.product.findUnique).mockResolvedValue(mockProduct as any)

    const result = await getProductBySlug('test-salsa')

    expect(prisma.product.findUnique).toHaveBeenCalledWith({
      where: { slug: 'test-salsa' },
      include: {
        category: true,
        variants: true,
        nutritionalInfo: true,
        productTags: {
          include: {
            tag: true,
          },
        },
      },
    })
    expect(result).toBeDefined()
    expect(result?.category).toBeDefined()
    expect(result?.variants).toHaveLength(1)
    expect(result?.nutritionalInfo).toBeDefined()
  })

  it('should return null for non-existent slug', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue(null)

    const result = await getProductBySlug('nonexistent-slug')

    expect(result).toBeNull()
  })

  it('should convert Decimal prices to numbers', async () => {
    // Mock Prisma Decimal objects that stringify correctly
    const mockDecimal = (value: number) => ({
      toString: () => String(value),
      valueOf: () => value,
    })

    const mockProduct = {
      id: '1',
      slug: 'decimal-product',
      name: 'Decimal Product',
      price: mockDecimal(9.99),
      compareAtPrice: mockDecimal(12.99),
      costPrice: mockDecimal(5.0),
      weight: mockDecimal(16.0),
      variants: [
        {
          id: 'v1',
          name: 'Large',
          price: mockDecimal(14.99),
        },
      ],
    }

    vi.mocked(prisma.product.findUnique).mockResolvedValue(mockProduct as any)

    const result = await getProductBySlug('decimal-product')

    expect(result).toBeDefined()
    expect(typeof result?.price).toBe('number')
    expect(result?.price).toBe(9.99)
    expect(typeof result?.variants[0].price).toBe('number')
    expect(result?.variants[0].price).toBe(14.99)
  })
})

describe('getCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should only return categories with active products', async () => {
    const mockCategories = [
      {
        id: 'c1',
        name: 'Mild Salsas',
        slug: 'mild-salsas',
        isActive: true,
        _count: { products: 5 },
      },
      {
        id: 'c2',
        name: 'Hot Sauces',
        slug: 'hot-sauces',
        isActive: true,
        _count: { products: 3 },
      },
      {
        id: 'c3',
        name: 'Empty Category',
        slug: 'empty',
        isActive: true,
        _count: { products: 0 },
      },
    ]

    vi.mocked(prisma.category.findMany).mockResolvedValue(mockCategories as any)

    const result = await getCategories()

    // Should filter out categories with 0 products
    expect(result).toHaveLength(2)
    expect(result[0]._count.products).toBeGreaterThan(0)
    expect(result[1]._count.products).toBeGreaterThan(0)
    expect(result.find((c) => c.slug === 'empty')).toBeUndefined()
  })

  it('should include product count', async () => {
    const mockCategories = [
      {
        id: 'c1',
        name: 'Mild Salsas',
        slug: 'mild-salsas',
        isActive: true,
        _count: { products: 5 },
      },
    ]

    vi.mocked(prisma.category.findMany).mockResolvedValue(mockCategories as any)

    const result = await getCategories()

    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          _count: {
            select: {
              products: {
                where: {
                  isActive: true,
                },
              },
            },
          },
        },
      })
    )
    expect(result[0]._count.products).toBe(5)
  })

  it('should only return active categories', async () => {
    const mockCategories = [
      {
        id: 'c1',
        name: 'Active Category',
        isActive: true,
        _count: { products: 5 },
      },
    ]

    vi.mocked(prisma.category.findMany).mockResolvedValue(mockCategories as any)

    await getCategories()

    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
        },
      })
    )
  })

  it('should return empty array when no categories have products', async () => {
    const mockCategories = [
      {
        id: 'c1',
        name: 'Empty Category',
        isActive: true,
        _count: { products: 0 },
      },
    ]

    vi.mocked(prisma.category.findMany).mockResolvedValue(mockCategories as any)

    const result = await getCategories()

    expect(result).toEqual([])
  })
})

describe('getProductsCount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should count products matching filters', async () => {
    vi.mocked(prisma.product.count).mockResolvedValue(15)

    const count = await getProductsCount({ category: 'mild-salsas', heatLevel: 'MILD' })

    expect(prisma.product.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        isActive: true,
        heatLevel: 'MILD',
        category: {
          slug: 'mild-salsas',
        },
      }),
    })
    expect(count).toBe(15)
  })

  it('should count with search filter', async () => {
    vi.mocked(prisma.product.count).mockResolvedValue(3)

    const count = await getProductsCount({ search: 'spicy' })

    expect(prisma.product.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          { name: { contains: 'spicy', mode: 'insensitive' } },
          { description: { contains: 'spicy', mode: 'insensitive' } },
          { searchKeywords: { hasSome: ['spicy'] } },
          { sku: { contains: 'spicy', mode: 'insensitive' } },
        ]),
      }),
    })
    expect(count).toBe(3)
  })

  it('should count with price range filter', async () => {
    vi.mocked(prisma.product.count).mockResolvedValue(8)

    const count = await getProductsCount({ minPrice: 10, maxPrice: 20 })

    expect(prisma.product.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        price: {
          gte: 10,
          lte: 20,
        },
      }),
    })
    expect(count).toBe(8)
  })

  it('should return 0 for no matches', async () => {
    vi.mocked(prisma.product.count).mockResolvedValue(0)

    const count = await getProductsCount({ search: 'nonexistent' })

    expect(count).toBe(0)
  })

  it('should count with inStock filter', async () => {
    vi.mocked(prisma.product.count).mockResolvedValue(12)

    const count = await getProductsCount({ inStock: true })

    expect(prisma.product.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        inventory: { gt: 0 },
      }),
    })
    expect(count).toBe(12)
  })

  it('should count with tags filter', async () => {
    vi.mocked(prisma.product.count).mockResolvedValue(6)

    const count = await getProductsCount({ tags: ['organic'] })

    expect(prisma.product.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        productTags: {
          some: {
            tag: {
              slug: { in: ['organic'] },
            },
          },
        },
      }),
    })
    expect(count).toBe(6)
  })
})
