import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Import Prisma
    const { default: prisma } = await import('@/lib/prisma')

    // Check if Prisma is properly initialized
    if (!prisma) {
      console.error('[API Salsas] Prisma client not initialized')
      return NextResponse.json(
        { error: 'Database connection not available' },
        { status: 503 }
      )
    }

    // Test database connection
    try {
      await prisma.$connect()
    } catch (dbError) {
      console.error('[API Salsas] Database connection failed:', dbError)
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 503 }
      )
    }

    // Get search params
    const { searchParams } = new URL(request.url)
    const heatLevel = searchParams.get('heatLevel')
    const search = searchParams.get('search')
    const featured = searchParams.get('featured')

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

    const salsas = await prisma.product.findMany({
      where,
      orderBy: [
        { isFeatured: 'desc' },
        { sortOrder: 'asc' },
        { name: 'asc' }
      ],
    })

    // Convert Decimal prices to numbers and format response
    const parsedSalsas = salsas.map(salsa => ({
      id: salsa.id,
      name: salsa.name,
      slug: salsa.slug,
      description: salsa.description,
      price: parseFloat(String(salsa.price)),
      compareAtPrice: salsa.compareAtPrice ? parseFloat(String(salsa.compareAtPrice)) : undefined,
      featuredImage: salsa.featuredImage,
      images: salsa.images || [],
      heatLevel: salsa.heatLevel,
      sku: salsa.sku,
      inventory: salsa.inventory,
      isFeatured: salsa.isFeatured,
      ingredients: salsa.ingredients || [],
      searchKeywords: salsa.searchKeywords || [],
    }))

    return NextResponse.json(parsedSalsas)
  } catch (error) {
    console.error('Error fetching salsas:', error)
    return NextResponse.json(
      { error: 'Failed to fetch salsas' },
      { status: 500 }
    )
  }
}
