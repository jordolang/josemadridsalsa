import { RecipesClient } from './recipes-client'
import prisma from '@/lib/prisma'
import type { Recipe } from '@/types/recipe'

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
    console.error('Error loading recipes:', error)
  }

  return <RecipesClient initialRecipes={recipes} />
}
