import { ChefHat } from 'lucide-react'
import RecipeForm from '@/components/admin/RecipeForm'

export default function NewRecipePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ChefHat className="h-8 w-8 text-orange-600" />
        <h1 className="text-3xl font-bold">Create Recipe</h1>
      </div>
      <RecipeForm />
    </div>
  )
}
