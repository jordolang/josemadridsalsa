import { unstable_cache } from 'next/cache'

import prisma from '@/lib/prisma'
import { Prisma, HeatLevel } from '@prisma/client'
import { getErrorMessage } from '@/lib/errors'
import { applyBigCommercePricing } from '@/lib/bigcommerce/storefront'

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
 * Type guard to check if a string is a valid HeatLevel
 */
function isValidHeatLevel(value: string): value is HeatLevel {
  return Object.values(HeatLevel).includes(value as HeatLevel)
}

/**
 * Get products with filtering, pagination, and search
 */
const getProductsCached = unstable_cache(
  async (filters: ProductFilters = {}) => {
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

    if (heatLevel && heatLevel !== 'all' && isValidHeatLevel(heatLevel)) {
      where.heatLevel = heatLevel
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
      }))
    } catch (error: unknown) {
      console.error('Error fetching products:', error)
      throw new Error(`Failed to fetch products: ${getErrorMessage(error)}`)
    }
  },
  ['products'],
  {
    revalidate: 1800, // 30 minutes in seconds
    tags: ['products'],
  }
)

/**
 * Get products with filtering, pagination, and search, priced by BigCommerce
 * once the storefront is switched to it. The price filters and sort still
 * read the database price.
 */
export async function getProducts(filters: ProductFilters = {}) {
  return applyBigCommercePricing(await getProductsCached(filters))
}

/**
 * Get a single product by slug with all relations
 */
const getProductBySlugCached = unstable_cache(
  async (slug: string) => {
    try {
      const product = await prisma.product.findUnique({
        where: { slug },
        include: {
          category: true,
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
      }
    } catch (error: unknown) {
      console.error('Error fetching product by slug:', error)
      throw new Error(`Failed to fetch product: ${getErrorMessage(error)}`)
    }
  },
  ['product-by-slug'],
  {
    revalidate: 1800, // 30 minutes in seconds
    tags: ['products'],
  }
)

/**
 * Get a single product by slug with all relations, priced by BigCommerce once
 * the storefront is switched to it.
 */
export async function getProductBySlug(slug: string) {
  const product = await getProductBySlugCached(slug)
  return product ? (await applyBigCommercePricing([product]))[0] : null
}

/**
 * Get all active categories with product counts
 */
export const getCategories = unstable_cache(
  async () => {
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
    } catch (error: unknown) {
      console.error('Error fetching categories:', error)
      throw new Error(`Failed to fetch categories: ${getErrorMessage(error)}`)
    }
  },
  ['categories'],
  {
    revalidate: 3600, // 1 hour in seconds
    tags: ['categories'],
  }
)

/**
 * Get an active category by slug (name, description, image and SEO fields), or null when it does
 * not exist or is inactive. Products are fetched separately with `getProducts({ category })`.
 */
export const getCategoryBySlug = unstable_cache(
  async (slug: string) => prisma.category.findFirst({ where: { slug, isActive: true } }),
  ['category-by-slug'],
  {
    revalidate: 3600,
    tags: ['categories'],
  }
)

/**
 * Get an active collection by slug with its active products, in the curated order.
 *
 * Mirrors the product mapping used by `getProducts` (Decimals → numbers) so the result drops
 * straight into the same `ProductCard`. Returns null when the collection does not exist or is
 * inactive. Inactive products in the collection are filtered out rather than shown.
 */
const getCollectionBySlugCached = unstable_cache(
  async (slug: string) => {
    try {
      const collection = await prisma.collection.findFirst({
        where: { slug, isActive: true },
        include: {
          products: {
            where: { product: { isActive: true } },
            orderBy: { sortOrder: 'asc' },
            include: {
              product: {
                include: {
                  category: true,
                  productTags: { include: { tag: true } },
                },
              },
            },
          },
        },
      })

      if (!collection) return null

      const products = collection.products.map(({ product }) => ({
        ...product,
        price: parseFloat(String(product.price)),
        compareAtPrice: product.compareAtPrice ? parseFloat(String(product.compareAtPrice)) : null,
        costPrice: product.costPrice ? parseFloat(String(product.costPrice)) : null,
        weight: product.weight ? parseFloat(String(product.weight)) : null,
      }))

      return { collection, products }
    } catch (error: unknown) {
      console.error('Error fetching collection:', error)
      throw new Error(`Failed to fetch collection: ${getErrorMessage(error)}`)
    }
  },
  ['collection-by-slug'],
  {
    revalidate: 1800, // 30 minutes in seconds
    tags: ['products'],
  }
)

/** `getCollectionBySlug` with BigCommerce pricing once the storefront is switched to it. */
export async function getCollectionBySlug(slug: string) {
  const result = await getCollectionBySlugCached(slug)
  return result ? { ...result, products: await applyBigCommercePricing(result.products) } : null
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

  if (heatLevel && heatLevel !== 'all' && isValidHeatLevel(heatLevel)) {
    where.heatLevel = heatLevel
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
  } catch (error: unknown) {
    console.error('Error counting products:', error)
    throw new Error(`Failed to count products: ${getErrorMessage(error)}`)
  }
}
