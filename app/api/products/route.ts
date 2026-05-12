import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rateLimit'

export async function GET(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(`products:${ip}`, 60, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    )
  }
  // Normalize query params coming from the storefront filters
  const { searchParams } = new URL(request.url)
  const heatLevel = searchParams.get('heatLevel')
  const search = searchParams.get('search')
  const featured = searchParams.get('featured')

  // Support both page/limit and skip/take for pagination
  const rawPage = Number(searchParams.get('page'))
  const rawLimit = Number(searchParams.get('limit'))
  const rawTake = Number(searchParams.get('take'))
  const rawSkip = Number(searchParams.get('skip'))

  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? rawLimit
      : Number.isFinite(rawTake) && rawTake > 0
        ? rawTake
        : 10
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1
  const skip = Number.isFinite(rawSkip) && rawSkip >= 0 ? rawSkip : (page - 1) * limit

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
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: search,
            mode: 'insensitive',
          },
        },
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

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: [{ isFeatured: 'desc' }, { sortOrder }, { name: 'asc' }],
        skip,
        take: limit,
        include: {
          productTags: {
            include: {
              tag: true,
            },
          },
          nutritionalInfo: true,
          productIngredients: {
            include: {
              ingredient: true,
            },
            orderBy: {
              sortOrder: 'asc',
            },
          },
        },
      }),
      prisma.product.count({ where }),
    ])

    // Convert Decimal prices to numbers and format response
    const parsedProducts = products.map((product) => ({
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
      nutritionalInfo: product.nutritionalInfo || null,
      productIngredients: product.productIngredients || [],
    }))

    return NextResponse.json(parsedProducts)
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 },
    )
  }
}
