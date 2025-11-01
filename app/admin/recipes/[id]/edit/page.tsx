import { ChefHat } from 'lucide-react'
import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import RecipeForm from '@/components/admin/RecipeForm'

export default async function EditRecipePage({ params }: { params: { id: string } }) {
  const recipe = await prisma.recipe.findUnique({ where: { id: params.id } })
  if (!recipe) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ChefHat className="h-8 w-8 text-orange-600" />
        <h1 className="text-3xl font-bold">Edit Recipe</h1>
      </div>
      <RecipeForm recipe={recipe} />
    </div>
  )
}
