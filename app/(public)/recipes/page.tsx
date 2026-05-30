import prisma from '@/lib/prisma'
import { RecipesClient } from './recipes-client'
import type { Recipe } from '@/types/recipe'

export const dynamic = 'force-dynamic'


export const revalidate = 300

export default async function RecipesPage() {
  let recipes: Recipe[] = []

  try {
    recipes = await prisma.recipe.findMany({
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
      orderBy: [
        { featured: 'desc' },
        { title: 'asc' },
      ],
    })
  } catch (error) {
    console.error('[Recipes Page] Error loading recipes:', error)
    // Return empty array on error - page will show "no recipes" message
    recipes = []
  }

  return <RecipesClient initialRecipes={recipes} />
}
