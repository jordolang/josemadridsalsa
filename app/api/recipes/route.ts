import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const featured = searchParams.get('featured')
    const category = searchParams.get('category')

    const where: Prisma.RecipeWhereInput = {}

    if (featured === 'true') {
      where.featured = true
    }

    if (category && category !== 'all') {
      where.category = category
    }

    const recipes = await prisma.recipe.findMany({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        category: true,
        difficulty: true,
        prepTime: true,
        cookTime: true,
        servings: true,
        featured: true,
        featuredImage: true,
        ingredients: true,
        instructions: true,
      },
      orderBy: [{ featured: 'desc' }, { title: 'asc' }],
    })

    return NextResponse.json(recipes)
  } catch (error) {
    console.error('Error fetching recipes:', error)
    return NextResponse.json({ error: 'Failed to fetch recipes' }, { status: 500 })
  }
}
