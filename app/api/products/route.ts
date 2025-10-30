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