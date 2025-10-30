'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Navigation } from '@/components/store/navigation'
import { Footer } from '@/components/store/footer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Clock, Users, ChefHat } from 'lucide-react'
import type { Recipe } from '@/types/recipe'
import { recipeData } from '@/lib/data/recipes'

type RecipesClientProps = {
  initialRecipes: Recipe[]
}

const fallbackRecipes = recipeData as Recipe[]

const categories = [
  { value: 'all', label: 'All Recipes' },
  { value: 'Main Course', label: 'Main Course' },
  { value: 'Seafood', label: 'Seafood' },
  { value: 'Side Dish', label: 'Side Dishes' },
  { value: 'Appetizer', label: 'Appetizers' },
  { value: 'Salad', label: 'Salads' },
]

const difficulties = [
  { value: 'all', label: 'All Levels' },
  { value: 'Easy', label: 'Easy' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Hard', label: 'Hard' },
]

export function RecipesClient({ initialRecipes }: RecipesClientProps) {
  const recipes = initialRecipes.length > 0 ? initialRecipes : fallbackRecipes
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedDifficulty, setSelectedDifficulty] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  const filteredRecipes = useMemo(() => {
    return recipes.filter((recipe) => {
      const matchesSearch =
        recipe.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        recipe.description.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory = selectedCategory === 'all' || recipe.category === selectedCategory
      const matchesDifficulty =
        selectedDifficulty === 'all' || recipe.difficulty === selectedDifficulty
      return matchesSearch && matchesCategory && matchesDifficulty
    })
  }, [recipes, searchTerm, selectedCategory, selectedDifficulty])

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy':
        return 'bg-green-100 text-green-800'
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'Hard':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const baseRecipesCount = recipes.length

  const calculateTotalMinutes = (prepTime: string, cookTime: string) => {
    const prepMinutes = parseInt(prepTime, 10)
    const cookMinutes = parseInt(cookTime, 10)

    if (Number.isNaN(prepMinutes) || Number.isNaN(cookMinutes)) {
      return null
    }

    return prepMinutes + cookMinutes
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <Navigation />

      <section className="bg-white py-16 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <ChefHat className="w-16 h-16 mx-auto mb-6 text-salsa-500" />
            <h1 className="text-4xl font-bold font-serif text-gray-900 mb-4">
              Delicious <span className="text-gradient">Recipes</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Discover amazing recipes featuring Jose Madrid Salsa. From quick weeknight dinners to
              impressive weekend meals, our salsas make everything taste better.
            </p>
          </div>
        </div>
      </section>

      {baseRecipesCount > 0 && (
        <section className="bg-gradient-to-r from-salsa-500 to-chile-500 py-12 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-center mb-8">Featured Recipes</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {recipes
                .filter((recipe) => recipe.featured)
                .slice(0, 3)
                .map((recipe) => (
                  <div key={recipe.id} className="bg-white/10 backdrop-blur rounded-lg p-6">
                    <h3 className="text-xl font-semibold mb-2">{recipe.title}</h3>
                    <p className="text-white/90 mb-4">{recipe.description}</p>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {(() => {
                          const totalMinutes = calculateTotalMinutes(
                            recipe.prepTime,
                            recipe.cookTime
                          )
                          return totalMinutes !== null
                            ? `${totalMinutes} min`
                            : `${recipe.prepTime} + ${recipe.cookTime}`
                        })()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {recipe.servings} servings
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </section>
      )}

      <section className="bg-white py-6 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="flex-1 max-w-md">
              <Input
                type="search"
                placeholder="Search recipes..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="focus:ring-salsa-500 focus:border-salsa-500"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <Button
                  key={category.value}
                  variant={selectedCategory === category.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category.value)}
                  className={
                    selectedCategory === category.value ? 'bg-salsa-500 hover:bg-salsa-600' : ''
                  }
                >
                  {category.label}
                </Button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {difficulties.map((difficulty) => (
                <Button
                  key={difficulty.value}
                  variant={selectedDifficulty === difficulty.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedDifficulty(difficulty.value)}
                  className={
                    selectedDifficulty === difficulty.value ? 'bg-salsa-500 hover:bg-salsa-600' : ''
                  }
                >
                  {difficulty.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-600">
            Showing {filteredRecipes.length} of {baseRecipesCount} recipes
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {filteredRecipes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No recipes found matching your criteria.</p>
              <Button
                onClick={() => {
                  setSearchTerm('')
                  setSelectedCategory('all')
                  setSelectedDifficulty('all')
                }}
                className="mt-4 bg-salsa-500 hover:bg-salsa-600"
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredRecipes.map((recipe) => (
                <div
                  key={recipe.id}
                  className="group bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden"
                >
                  <Link href={`/recipes/${recipe.slug}`}>
                    <div className="relative h-48 bg-gray-100">
                      <Image
                        src={recipe.featuredImage}
                        alt={recipe.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />

                      <div className="absolute top-3 left-3">
                        <Badge className="bg-salsa-500 text-white">{recipe.category}</Badge>
                      </div>

                      <div className="absolute top-3 right-3">
                        <Badge className={getDifficultyColor(recipe.difficulty)}>
                          {recipe.difficulty}
                        </Badge>
                      </div>
                    </div>
                  </Link>

                  <div className="p-6">
                    <Link href={`/recipes/${recipe.slug}`}>
                      <h3 className="font-semibold text-xl text-gray-900 hover:text-salsa-600 transition-colors line-clamp-2 mb-3">
                        {recipe.title}
                      </h3>
                    </Link>

                    <p className="text-gray-600 line-clamp-3 mb-4">{recipe.description}</p>

                    <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {(() => {
                          const totalMinutes = calculateTotalMinutes(
                            recipe.prepTime,
                            recipe.cookTime
                          )
                          return totalMinutes !== null
                            ? `${totalMinutes} min total`
                            : `${recipe.prepTime} + ${recipe.cookTime}`
                        })()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        Serves {recipe.servings}
                      </span>
                    </div>

                    <Button asChild className="w-full bg-salsa-500 hover:bg-salsa-600">
                      <Link href={`/recipes/${recipe.slug}`}>View Recipe</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </main>
  )
}
