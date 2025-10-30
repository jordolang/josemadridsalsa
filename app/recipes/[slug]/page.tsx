import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import type { Recipe } from '@/types/recipe'
import { recipeData } from '@/lib/data/recipes'
import { Badge } from '@/components/ui/badge'
import { Clock, Users, ChefHat } from 'lucide-react'

type RecipePageProps = {
  params: { slug: string }
}

const textFallbacks = {
  category: 'Chef Special',
  difficulty: 'Easy',
}

const imageFallback = '/images/salsa-bowl.png'

const difficultyColors: Record<string, string> = {
  Easy: 'bg-green-100 text-green-800',
  Medium: 'bg-yellow-100 text-yellow-800',
  Hard: 'bg-red-100 text-red-800',
}

const loadRecipe = async (slug: string): Promise<Recipe | null> => {
  try {
    const recipe = await prisma.recipe.findUnique({
      where: { slug },
    })

    if (recipe) {
      return recipe
    }
  } catch (error) {
    console.error('Failed to load recipe from database:', error)
  }

  const fallbackRecipe = recipeData.find((item) => item.slug === slug)
  return fallbackRecipe ?? null
}

const getTotalMinutes = (prepTime: string, cookTime: string) => {
  const prep = parseInt(prepTime, 10)
  const cook = parseInt(cookTime, 10)

  if (Number.isNaN(prep) || Number.isNaN(cook)) {
    return null
  }

  return prep + cook
}

export const revalidate = 0

export async function generateStaticParams() {
  try {
    const recipes = await prisma.recipe.findMany({
      select: { slug: true },
    })

    if (recipes.length > 0) {
      return recipes.map(({ slug }) => ({ slug }))
    }
  } catch (error) {
    console.warn('Falling back to static recipe params due to Prisma error:', error)
  }

  return recipeData.map((recipe) => ({ slug: recipe.slug }))
}

export async function generateMetadata({
  params,
}: RecipePageProps): Promise<Metadata> {
  const recipe = await loadRecipe(params.slug)

  if (!recipe) {
    return {
      title: 'Recipe Not Found',
    }
  }

  const title = `${recipe.title} | Jose Madrid Salsa Recipes`
  const description =
    recipe.description ||
    'Explore delicious recipes made with Jose Madrid Salsa.'

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [
        {
          url: recipe.featuredImage || imageFallback,
        },
      ],
    },
  }
}

export default async function RecipePage({ params }: RecipePageProps) {
  const recipe = await loadRecipe(params.slug)

  if (!recipe) {
    notFound()
  }

  const difficultyClass =
    difficultyColors[recipe.difficulty] ?? difficultyColors[textFallbacks.difficulty]
  const totalMinutes = getTotalMinutes(recipe.prepTime, recipe.cookTime)

  return (
    <div className="bg-gray-50 pb-16">
      <section className="bg-gradient-to-r from-salsa-500 to-chile-500 text-white py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col-reverse lg:flex-row items-center gap-10">
            <div className="flex-1 space-y-6">
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur px-4 py-2 rounded-full text-sm">
                <ChefHat className="w-4 h-4" />
                {recipe.category || textFallbacks.category}
              </div>
              <h1 className="text-4xl lg:text-5xl font-serif font-bold leading-tight">
                {recipe.title}
              </h1>
              <p className="text-lg text-white/90 leading-relaxed">
                {recipe.description}
              </p>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span className="inline-flex items-center gap-2 bg-white/10 px-3 py-2 rounded-full">
                  <Clock className="w-4 h-4" />
                  {recipe.prepTime} prep
                  <span className="text-white/60">•</span>
                  {recipe.cookTime} cook
                  {totalMinutes !== null && (
                    <>
                      <span className="text-white/60">•</span>
                      {totalMinutes} min total
                    </>
                  )}
                </span>
                <span className="inline-flex items-center gap-2 bg-white/10 px-3 py-2 rounded-full">
                  <Users className="w-4 h-4" />
                  Serves {recipe.servings}
                </span>
                <Badge className={difficultyClass}>{recipe.difficulty}</Badge>
              </div>
            </div>
            <div className="flex-1 w-full">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl shadow-2xl border border-white/10">
                <Image
                  src={recipe.featuredImage || imageFallback}
                  alt={recipe.title}
                  fill
                  priority
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="bg-white shadow-lg rounded-2xl p-8 space-y-6">
          <h2 className="text-2xl font-semibold text-gray-900">Instructions</h2>
          <ol className="space-y-4 list-decimal list-inside text-gray-700 leading-relaxed">
            {recipe.instructions.map((step, index) => (
              <li key={`instruction-${index}`} className="pl-2">
                {step}
              </li>
            ))}
          </ol>
        </section>

        <aside className="space-y-6">
          <div className="bg-white shadow-lg rounded-2xl p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Ingredients
            </h2>
            <ul className="space-y-3 text-gray-700">
              {recipe.ingredients.map((ingredient, index) => (
                <li key={`ingredient-${index}`} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-salsa-500" />
                  <span>{ingredient}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white shadow-lg rounded-2xl p-6 border border-dashed border-salsa-200 text-sm text-gray-600">
            <p>
              Looking for more recipes featuring Jose Madrid Salsa? Explore the full
              collection for inspiration across every meal of the day.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
