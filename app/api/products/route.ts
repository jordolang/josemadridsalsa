import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// Fallback data to keep the homepage stable even if the database is down
const mockProducts = [
  {
    id: '1',
    name: 'Original Mild',
    slug: 'original-mild',
    description: 'Our signature mild salsa made with fresh tomatoes and spices.',
    price: 8.99,
    compareAtPrice: 10.99,
    featuredImage: '/images/products/mild-salsa-1.jpg',
    images: ['/images/products/mild-salsa-1.jpg'],
    heatLevel: 'MILD',
    sku: 'JMS-MILD-001',
    inventory: 150,
    isFeatured: true,
    ingredients: [],
    searchKeywords: [],
  },
  {
    id: '2',
    name: 'Garden Fresh Cilantro',
    slug: 'garden-fresh-cilantro',
    description: 'Bright cilantro meets a balanced, medium heat finish.',
    price: 8.99,
    compareAtPrice: 10.99,
    featuredImage: '/images/products/medium-salsa-1.jpg',
    images: ['/images/products/medium-salsa-1.jpg'],
    heatLevel: 'MEDIUM',
    sku: 'JMS-MEDIUM-001',
    inventory: 200,
    isFeatured: true,
    ingredients: [],
    searchKeywords: [],
  },
  {
    id: '3',
    name: 'Ghost of Clovis',
    slug: 'ghost-of-clovis',
    description: 'Smoky ghost peppers for heat lovers who want a serious kick.',
    price: 9.49,
    compareAtPrice: 11.49,
    featuredImage: '/images/products/hot-salsa-1.jpg',
    images: ['/images/products/hot-salsa-1.jpg'],
    heatLevel: 'HOT',
    sku: 'JMS-HOT-001',
    inventory: 80,
    isFeatured: true,
    ingredients: [],
    searchKeywords: [],
  },
]

export async function GET(request: NextRequest) {
  // Normalize query params coming from the storefront filters
  const { searchParams } = new URL(request.url)
  const heatLevel = searchParams.get('heatLevel')
  const search = searchParams.get('search')
  const featured = searchParams.get('featured')

  const rawTake = Number(searchParams.get('take'))
  const take = Number.isFinite(rawTake) && rawTake > 0 ? rawTake : undefined

  const rawSkip = Number(searchParams.get('skip'))
  const skip = Number.isFinite(rawSkip) && rawSkip >= 0 ? rawSkip : 0

  const sortOrder = searchParams.get('sortOrder') === 'desc' ? 'desc' : 'asc'
  const inStock = searchParams.get('inStock')
  const categories = (searchParams.get('categories') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  const tagSlugs = (searchParams.get('tags') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  try {
    // Build where clause
    const where: any = {
      isActive: true,
    }

    if (heatLevel && heatLevel !== 'all') {
      where.heatLevel = heatLevel
    }

    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          description: {
            contains: search,
            mode: 'insensitive'
          }
        }
      ]
    }

    if (featured === 'true') {
      where.isFeatured = true
    }

    if (categories.length) {
      where.category = {
        slug: { in: categories },
      }
    }

    if (tagSlugs.length) {
      where.productTags = {
        some: {
          tag: {
            slug: { in: tagSlugs },
          },
        },
      }
    }

    if (inStock === '1' || inStock === 'true') {
      where.inventory = { gt: 0 }
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: [
        { isFeatured: 'desc' },
        { sortOrder },
        { name: 'asc' }
      ],
      skip,
      take,
      include: {
        productTags: {
          include: {
            tag: true,
          },
        },
      },
    })

    // Convert Decimal prices to numbers and format response
    const parsedProducts = products.map(product => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: parseFloat(String(product.price)),
      compareAtPrice: product.compareAtPrice ? parseFloat(String(product.compareAtPrice)) : undefined,
      featuredImage: product.featuredImage,
      images: product.images || [],
      heatLevel: product.heatLevel,
      sku: product.sku,
      inventory: product.inventory,
      isFeatured: product.isFeatured,
      ingredients: product.ingredients || [],
      searchKeywords: product.searchKeywords || [],
      tags: product.productTags?.map(({ tag }) => tag.slug) || [],
    }))

    return NextResponse.json(parsedProducts)
  } catch (error) {
    console.warn('Database unavailable, returning mock products:', error)

    // Provide a graceful fallback so the homepage widgets still load
    return NextResponse.json(mockProducts)
  }
}
