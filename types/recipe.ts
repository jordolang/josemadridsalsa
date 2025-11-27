export type Recipe = {
  id: string
  title: string
  slug: string
  description: string
  category: string
  difficulty: string
  prepTime: string
  cookTime: string
  servings: number
  featured: boolean
  featuredImage: string
  ingredients: string[]
  instructions: string[]
}
