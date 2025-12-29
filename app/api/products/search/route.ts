import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'

// Validation schema for search params
const searchParamsSchema = z.object({
  q: z.string().min(1).optional(),
  heatLevel: z.enum(['MILD', 'MEDIUM', 'HOT', 'EXTRA_HOT', 'FRUIT']).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  inStock: z.enum(['true', 'false']).optional(),
  featured: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  sortBy: z.enum(['relevance', 'price-asc', 'price-desc', 'name']).default('relevance'),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Parse and validate query parameters
    const params = searchParamsSchema.safeParse({
      q: searchParams.get('q') || undefined,
      heatLevel: searchParams.get('heatLevel') || undefined,
      minPrice: searchParams.get('minPrice') || undefined,
      maxPrice: searchParams.get('maxPrice') || undefined,
      inStock: searchParams.get('inStock') || undefined,
      featured: searchParams.get('featured') || undefined,
      limit: searchParams.get('limit') || '20',
      offset: searchParams.get('offset') || '0',
      sortBy: searchParams.get('sortBy') || 'relevance',
    })

    if (!params.success) {
      return NextResponse.json(
        { error: 'Invalid search parameters', details: params.error.errors },
        { status: 400 }
      )
    }

    const {
      q,
      heatLevel,
      minPrice,
      maxPrice,
      inStock,
      featured,
      limit,
      offset,
      sortBy,
    } = params.data

    // Build where clause for search
    const where: any = {
      isActive: true,
    }

    // Enhanced search: fuzzy matching across multiple fields
    if (q) {
      where.OR = [
        {
          name: {
            contains: q,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: q,
            mode: 'insensitive',
          },
        },
        {
          searchKeywords: {
            hasSome: [q.toLowerCase()],
          },
        },
        {
          sku: {
            contains: q,
            mode: 'insensitive',
          },
        },
      ]
    }

    // Apply filters
    if (heatLevel) {
      where.heatLevel = heatLevel
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

    if (inStock === 'true') {
      where.inventory = { gt: 0 }
    }

    if (featured === 'true') {
      where.isFeatured = true
    }

    // Determine sort order
    let orderBy: any
    switch (sortBy) {
      case 'price-asc':
        orderBy = { price: 'asc' }
        break
      case 'price-desc':
        orderBy = { price: 'desc' }
        break
      case 'name':
        orderBy = { name: 'asc' }
        break
      case 'relevance':
      default:
        orderBy = [
          { isFeatured: 'desc' },
          { sortOrder: 'asc' },
          { name: 'asc' },
        ]
        break
    }

    // Execute search query
    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
        include: {
          productTags: {
            include: {
              tag: true,
            },
          },
          category: true,
        },
      }),
      prisma.product.count({ where }),
    ])

    // Format response
    const formattedProducts = products.map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: parseFloat(String(product.price)),
      compareAtPrice: product.compareAtPrice
        ? parseFloat(String(product.compareAtPrice))
        : undefined,
      featuredImage: product.featuredImage,
      images: product.images || [],
      heatLevel: product.heatLevel,
      sku: product.sku,
      inventory: product.inventory,
      isFeatured: product.isFeatured,
      ingredients: product.ingredients || [],
      searchKeywords: product.searchKeywords || [],
      tags: product.productTags?.map(({ tag }) => tag.slug) || [],
      category: product.category
        ? {
            id: product.category.id,
            name: product.category.name,
            slug: product.category.slug,
          }
        : null,
    }))

    // Return results with pagination info
    return NextResponse.json({
      products: formattedProducts,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
      query: {
        q,
        filters: {
          heatLevel,
          minPrice,
          maxPrice,
          inStock,
          featured,
        },
        sortBy,
      },
    })
  } catch (error: any) {
    console.error('Error searching products:', error)
    return NextResponse.json(
      {
        error: 'Failed to search products',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

// Autocomplete endpoint for search suggestions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query } = body

    if (!query || query.length < 2) {
      return NextResponse.json({ suggestions: [] })
    }

    // Get product name suggestions
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        OR: [
          {
            name: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            searchKeywords: {
              hasSome: [query.toLowerCase()],
            },
          },
        ],
      },
      select: {
        name: true,
        slug: true,
        featuredImage: true,
        price: true,
        heatLevel: true,
      },
      take: 10,
    })

    const suggestions = products.map((product) => ({
      name: product.name,
      slug: product.slug,
      image: product.featuredImage,
      price: parseFloat(String(product.price)),
      heatLevel: product.heatLevel,
    }))

    return NextResponse.json({ suggestions })
  } catch (error: any) {
    console.error('Error getting autocomplete suggestions:', error)
    return NextResponse.json(
      {
        error: 'Failed to get suggestions',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
