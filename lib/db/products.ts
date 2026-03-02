import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export interface ProductFilters {
  category?: string
  search?: string
  heatLevel?: string
  featured?: boolean
  minPrice?: number
  maxPrice?: number
  inStock?: boolean
  tags?: string[]
  take?: number
  skip?: number
  sortOrder?: 'asc' | 'desc'
}

/**
 * Get products with filtering, pagination, and search
 */
export async function getProducts(filters: ProductFilters = {}) {
  const {
    category,
    search,
    heatLevel,
    featured,
    minPrice,
    maxPrice,
    inStock,
    tags = [],
    take,
    skip = 0,
    sortOrder = 'asc',
  } = filters

  // Build where clause
  const where: Prisma.ProductWhereInput = {
    isActive: true,
  }

  if (heatLevel && heatLevel !== 'all') {
    where.heatLevel = heatLevel as any
  }

  if (search) {
    where.OR = [
      {
        name: {
          contains: search,
          mode: 'insensitive',
        },
      },
      {
        description: {
          contains: search,
          mode: 'insensitive',
        },
      },
      {
        searchKeywords: {
          hasSome: [search.toLowerCase()],
        },
      },
      {
        sku: {
          contains: search,
          mode: 'insensitive',
        },
      },
    ]
  }

  if (featured !== undefined) {
    where.isFeatured = featured
  }

  if (category) {
    where.category = {
      slug: category,
    }
  }

  if (tags.length > 0) {
    where.productTags = {
      some: {
        tag: {
          slug: { in: tags },
        },
      },
    }
  }

  if (inStock) {
    where.inventory = { gt: 0 }
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    where.price = {}
    if (minPrice !== undefined) {
      where.price.gte = minPrice
    }
    if (maxPrice !== undefined) {
      where.price.lte = maxPrice
    }
  }

  try {
    const products = await prisma.product.findMany({
      where,
      orderBy: [{ isFeatured: 'desc' }, { sortOrder }, { name: 'asc' }],
      skip,
      take,
      include: {
        category: true,
        variants: true,
        nutritionalInfo: true,
        productIngredients: {
          include: { ingredient: true },
          orderBy: { sortOrder: 'asc' as const },
        },
        productTags: {
          include: {
            tag: true,
          },
        },
      },
    })

    // Convert Decimal prices to numbers
    return products.map((product) => ({
      ...product,
      price: parseFloat(String(product.price)),
      compareAtPrice: product.compareAtPrice
        ? parseFloat(String(product.compareAtPrice))
        : null,
      costPrice: product.costPrice ? parseFloat(String(product.costPrice)) : null,
      weight: product.weight ? parseFloat(String(product.weight)) : null,
      variants: product.variants.map((variant) => ({
        ...variant,
        price: variant.price ? parseFloat(String(variant.price)) : null,
      })),
    }))
  } catch (error: any) {
    console.error('Error fetching products:', error)
    throw new Error(`Failed to fetch products: ${error.message}`)
  }
}

/**
 * Get a single product by slug with all relations
 */
export async function getProductBySlug(slug: string) {
  try {
    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        category: true,
        variants: true,
        nutritionalInfo: true,
        productIngredients: {
          include: { ingredient: true },
          orderBy: { sortOrder: 'asc' as const },
        },
        productTags: {
          include: {
            tag: true,
          },
        },
      },
    })

    if (!product) {
      return null
    }

    // Convert Decimal prices to numbers
    return {
      ...product,
      price: parseFloat(String(product.price)),
      compareAtPrice: product.compareAtPrice
        ? parseFloat(String(product.compareAtPrice))
        : null,
      costPrice: product.costPrice ? parseFloat(String(product.costPrice)) : null,
      weight: product.weight ? parseFloat(String(product.weight)) : null,
      variants: product.variants.map((variant) => ({
        ...variant,
        price: variant.price ? parseFloat(String(variant.price)) : null,
      })),
    }
  } catch (error: any) {
    console.error('Error fetching product by slug:', error)
    throw new Error(`Failed to fetch product: ${error.message}`)
  }
}

/**
 * Get all active categories with product counts
 */
export async function getCategories() {
  try {
    const categories = await prisma.category.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        sortOrder: 'asc',
      },
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

    // Only return categories that have products
    return categories.filter((category) => category._count.products > 0)
  } catch (error: any) {
    console.error('Error fetching categories:', error)
    throw new Error(`Failed to fetch categories: ${error.message}`)
  }
}

/**
 * Get total count of products matching filters (for pagination)
 */
export async function getProductsCount(filters: Omit<ProductFilters, 'take' | 'skip' | 'sortOrder'> = {}) {
  const {
    category,
    search,
    heatLevel,
    featured,
    minPrice,
    maxPrice,
    inStock,
    tags = [],
  } = filters

  // Build where clause (same logic as getProducts)
  const where: Prisma.ProductWhereInput = {
    isActive: true,
  }

  if (heatLevel && heatLevel !== 'all') {
    where.heatLevel = heatLevel as any
  }

  if (search) {
    where.OR = [
      {
        name: {
          contains: search,
          mode: 'insensitive',
        },
      },
      {
        description: {
          contains: search,
          mode: 'insensitive',
        },
      },
      {
        searchKeywords: {
          hasSome: [search.toLowerCase()],
        },
      },
      {
        sku: {
          contains: search,
          mode: 'insensitive',
        },
      },
    ]
  }

  if (featured !== undefined) {
    where.isFeatured = featured
  }

  if (category) {
    where.category = {
      slug: category,
    }
  }

  if (tags.length > 0) {
    where.productTags = {
      some: {
        tag: {
          slug: { in: tags },
        },
      },
    }
  }

  if (inStock) {
    where.inventory = { gt: 0 }
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    where.price = {}
    if (minPrice !== undefined) {
      where.price.gte = minPrice
    }
    if (maxPrice !== undefined) {
      where.price.lte = maxPrice
    }
  }

  try {
    return await prisma.product.count({ where })
  } catch (error: any) {
    console.error('Error counting products:', error)
    throw new Error(`Failed to count products: ${error.message}`)
  }
}
