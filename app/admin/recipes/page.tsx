import { redirect } from 'next/navigation'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, ChefHat, Clock, Users } from 'lucide-react'
import Link from 'next/link'
import RecipeActions from '@/components/admin/RecipeActions'

export const metadata = {
  title: 'Recipes | Admin',
  description: 'Manage recipes and cooking content',
}

type SearchParams = {
  search?: string
  category?: string
  difficulty?: string
  featured?: string
  page?: string
}

async function getRecipes(searchParams: SearchParams) {
  const page = Number(searchParams.page) || 1
  const limit = 20
  const skip = (page - 1) * limit

  const where: any = {}

  // Search filter
  if (searchParams.search) {
    where.OR = [
      { title: { contains: searchParams.search, mode: 'insensitive' } },
      { description: { contains: searchParams.search, mode: 'insensitive' } },
      { category: { contains: searchParams.search, mode: 'insensitive' } },
    ]
  }

  // Category filter
  if (searchParams.category && searchParams.category !== 'all') {
    where.category = searchParams.category
  }

  // Difficulty filter
  if (searchParams.difficulty && searchParams.difficulty !== 'all') {
    where.difficulty = searchParams.difficulty
  }

  // Featured filter
  if (searchParams.featured === 'true') {
    where.featured = true
  }

  const [recipes, total, categories] = await Promise.all([
    prisma.recipe.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            recipeTags: true,
          },
        },
      },
    }),
    prisma.recipe.count({ where }),
    // Get unique categories
    prisma.recipe.findMany({
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    }),
  ])

  return {
    recipes,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    categories: categories.map((c) => c.category),
  }
}

const difficultyColors = {
  Easy: 'bg-green-100 text-green-800',
  Medium: 'bg-yellow-100 text-yellow-800',
  Hard: 'bg-red-100 text-red-800',
}

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'content:write'))) {
    redirect('/admin')
  }

  const { recipes, total, page, totalPages, categories } = await getRecipes(searchParams)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Recipes</h1>
          <p className="text-slate-600">
            Manage cooking recipes and content
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/recipes/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Recipe
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="search"
              placeholder="Search recipes..."
              defaultValue={searchParams.search}
              className="pl-9"
            />
          </div>
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            defaultValue={searchParams.category || 'all'}
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            defaultValue={searchParams.difficulty || 'all'}
          >
            <option value="all">All Difficulties</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            defaultValue={searchParams.featured || 'all'}
          >
            <option value="all">All Recipes</option>
            <option value="true">Featured Only</option>
          </select>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <ChefHat className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm text-slate-600">Total Recipes</p>
              <p className="text-2xl font-bold">{total}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-slate-600">Featured</p>
              <p className="text-2xl font-bold">
                {recipes.filter((r) => r.featured).length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Recipes Grid */}
      {recipes.length === 0 ? (
        <Card className="p-12">
          <div className="text-center text-slate-500">
            <ChefHat className="mx-auto mb-4 h-12 w-12 text-slate-300" />
            <p className="text-lg font-medium">No recipes found</p>
            <p className="mt-1 text-sm">
              {searchParams.search
                ? 'Try a different search term'
                : 'Create your first recipe to get started'}
            </p>
            <Button className="mt-4" asChild>
              <Link href="/admin/recipes/new">
                <Plus className="mr-2 h-4 w-4" />
                Add Recipe
              </Link>
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {recipes.map((recipe) => (
              <Card key={recipe.id} className="overflow-hidden">
                {/* Image */}
                <div className="aspect-video bg-slate-100">
                  <img
                    src={recipe.featuredImage}
                    alt={recipe.title}
                    className="h-full w-full object-cover"
                  />
                </div>

                {/* Content */}
                <div className="p-4">
                  <div className="mb-2 flex items-start justify-between">
                    <h3 className="font-semibold">{recipe.title}</h3>
                    {recipe.featured && (
                      <Badge className="bg-yellow-100 text-yellow-800">
                        Featured
                      </Badge>
                    )}
                  </div>

                  <p className="mb-3 line-clamp-2 text-sm text-slate-600">
                    {recipe.description}
                  </p>

                  <div className="mb-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {recipe.prepTime} + {recipe.cookTime}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {recipe.servings} servings
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <Badge variant="secondary">{recipe.category}</Badge>
                      <Badge
                        className={
                          difficultyColors[recipe.difficulty as keyof typeof difficultyColors] ||
                          'bg-slate-100 text-slate-800'
                        }
                      >
                        {recipe.difficulty}
                      </Badge>
                    </div>
                    <RecipeActions recipeId={recipe.id} recipeTitle={recipe.title} />
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                disabled={page === 1}
                asChild={page > 1}
              >
                {page > 1 ? (
                  <Link href={`/admin/recipes?page=${page - 1}`}>Previous</Link>
                ) : (
                  <span>Previous</span>
                )}
              </Button>
              <span className="text-sm text-slate-600">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                disabled={page === totalPages}
                asChild={page < totalPages}
              >
                {page < totalPages ? (
                  <Link href={`/admin/recipes?page=${page + 1}`}>Next</Link>
                ) : (
                  <span>Next</span>
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
