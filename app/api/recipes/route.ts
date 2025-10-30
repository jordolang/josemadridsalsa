import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { prisma } = await import('@/lib/prisma')
    
    const { searchParams } = new URL(request.url)
    const featured = searchParams.get('featured')
    const category = searchParams.get('category')
    
    const where: any = {}
    
    if (featured === 'true') {
      where.featured = true
    }
    
    if (category && category !== 'all') {
      where.category = category
    }
    
    const recipes = await prisma.recipe.findMany({
      where,
      orderBy: [
        { featured: 'desc' },
        { title: 'asc' }
      ],
    })
    
    return NextResponse.json(recipes)
  } catch (error) {
    console.error('Error fetching recipes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recipes' },
      { status: 500 }
    )
  }
}
