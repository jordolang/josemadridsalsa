import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Import Prisma
    const { prisma } = await import('@/lib/prisma')
    
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
    
    const products = await prisma.product.findMany({
      where,
      orderBy: [
        { isFeatured: 'desc' },
        { sortOrder: 'asc' },
        { name: 'asc' }
      ],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        price: true,
        compareAtPrice: true,
        featuredImage: true,
        images: true,
        heatLevel: true,
        sku: true,
        inventory: true,
        isFeatured: true,
        ingredients: true,
        searchKeywords: true,
        productType: true,
        packSize: true,
      },
    })
    
    // Parse JSON fields for SQLite compatibility
    const parsedProducts = products.map(product => ({
      ...product,
      images: JSON.parse(product.images || '[]'),
      ingredients: JSON.parse(product.ingredients || '[]'),
      searchKeywords: JSON.parse(product.searchKeywords || '[]'),
    }))

    return NextResponse.json(parsedProducts)
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}