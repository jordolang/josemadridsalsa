import { NextResponse } from 'next/server'

// Mock data for when database is not available
const mockFeaturedProducts = [
  {
    id: '1',
    name: 'Jose Madrid Mild Salsa',
    slug: 'jose-madrid-mild-salsa',
    description: 'Our signature mild salsa made with fresh tomatoes, onions, and a perfect blend of spices.',
    price: 8.99,
    compareAtPrice: 10.99,
    featuredImage: '/images/products/mild-salsa-1.jpg',
    heatLevel: 'MILD',
    sku: 'JMS-MILD-001',
    inventory: 150,
    isFeatured: true,
  },
  {
    id: '2',
    name: 'Jose Madrid Medium Salsa',
    slug: 'jose-madrid-medium-salsa',
    description: 'Our most popular salsa! The perfect balance of flavor and heat.',
    price: 8.99,
    compareAtPrice: 10.99,
    featuredImage: '/images/products/medium-salsa-1.jpg',
    heatLevel: 'MEDIUM',
    sku: 'JMS-MED-001',
    inventory: 200,
    isFeatured: true,
  },
  {
    id: '3',
    name: 'Jose Madrid Hot Salsa',
    slug: 'jose-madrid-hot-salsa',
    description: 'For heat lovers! This bold salsa packs serious flavor with a kick.',
    price: 9.49,
    compareAtPrice: 11.49,
    featuredImage: '/images/products/hot-salsa-1.jpg',
    heatLevel: 'HOT',
    sku: 'JMS-HOT-001',
    inventory: 80,
    isFeatured: true,
  },
]

export async function GET() {
  try {
    // Try to import and use Prisma
    const { prisma } = await import('@/lib/prisma')
    
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        isFeatured: true,
      },
      take: 6,
      orderBy: {
        sortOrder: 'asc',
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        price: true,
        compareAtPrice: true,
        featuredImage: true,
        heatLevel: true,
        sku: true,
        inventory: true,
        isFeatured: true,
      },
    })

    return NextResponse.json(products)
  } catch (error) {
    console.warn('Database not available, using mock data:', error)
    // Return mock data when database is not available
    return NextResponse.json(mockFeaturedProducts)
  }
}
