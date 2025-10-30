'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Navigation } from '@/components/store/navigation'
import { Footer } from '@/components/store/footer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Clock, Users, ChefHat } from 'lucide-react'

// Mock recipe data
const recipes = [
  {
    id: '1',
    title: 'Classic Salsa Chicken Tacos',
    slug: 'classic-salsa-chicken-tacos',
    description: 'Tender chicken cooked with our mild salsa, served in soft tortillas with fresh toppings.',
    category: 'Main Course',
    difficulty: 'Easy',
    prepTime: '15 min',
    cookTime: '25 min',
    servings: 4,
    featuredImage: '/images/salsa-bowl.png',
    ingredients: [
      '2 lbs chicken breast, diced',
      '1 jar Jose Madrid Mild Salsa',
      '8 soft flour tortillas',
      '1 cup shredded cheese',
      '1/2 cup diced onion',
      'Fresh cilantro',
      'Lime wedges'
    ],
    instructions: [
      'Cook diced chicken in a large skillet over medium heat until no longer pink.',
      'Add Jose Madrid Mild Salsa and simmer for 10 minutes.',
      'Warm tortillas and fill with chicken mixture.',
      'Top with cheese, onion, and cilantro. Serve with lime wedges.'
    ],
    featured: true,
  },
  {
    id: '2',
    title: 'Spicy Salsa Verde Enchiladas',
    slug: 'spicy-salsa-verde-enchiladas',
    description: 'Rolled corn tortillas filled with cheese and topped with our hot salsa verde.',
    category: 'Main Course',
    difficulty: 'Medium',
    prepTime: '30 min',
    cookTime: '35 min',
    servings: 6,
    featuredImage: '/images/salsa-bowl.png',
    ingredients: [
      '12 corn tortillas',
      '2 cups shredded Monterey Jack cheese',
      '1 jar Jose Madrid Hot Salsa',
      '1/2 cup diced onion',
      '1/4 cup fresh cilantro',
      '1 cup sour cream'
    ],
    instructions: [
      'Preheat oven to 375°F.',
      'Fill tortillas with cheese and onion, then roll tightly.',
      'Place in baking dish and top with hot salsa.',
      'Bake for 25-30 minutes until bubbly.',
      'Garnish with cilantro and serve with sour cream.'
    ],
    featured: false,
  },
  {
    id: '3',
    title: 'Mango Salsa Fish Tacos',
    slug: 'mango-salsa-fish-tacos',
    description: 'Grilled white fish topped with our tropical mango habanero salsa.',
    category: 'Seafood',
    difficulty: 'Medium',
    prepTime: '20 min',
    cookTime: '15 min',
    servings: 4,
    featuredImage: '/images/salsa-bowl.png',
    ingredients: [
      '1.5 lbs white fish fillets',
      '1 jar Jose Madrid Mango Habanero Salsa',
      '8 corn tortillas',
      '2 cups coleslaw mix',
      '1/4 cup mayonnaise',
      '2 limes, juiced',
      'Salt and pepper'
    ],
    instructions: [
      'Season fish with salt, pepper, and lime juice.',
      'Grill fish for 3-4 minutes per side until flaky.',
      'Mix coleslaw with mayo and lime juice.',
      'Warm tortillas and fill with fish, coleslaw, and mango salsa.',
      'Serve immediately with extra lime wedges.'
    ],
    featured: true,
  },
  {
    id: '4',
    title: 'Salsa Stuffed Bell Peppers',
    slug: 'salsa-stuffed-bell-peppers',
    description: 'Bell peppers stuffed with ground beef, rice, and our medium salsa.',
    category: 'Main Course',
    difficulty: 'Easy',
    prepTime: '25 min',
    cookTime: '45 min',
    servings: 4,
    featuredImage: '/images/salsa-bowl.png',
    ingredients: [
      '4 large bell peppers, tops cut and seeds removed',
      '1 lb ground beef',
      '1 cup cooked rice',
      '1 jar Jose Madrid Medium Salsa',
      '1 cup shredded cheddar cheese',
      '1/2 cup diced onion'
    ],
    instructions: [
      'Preheat oven to 350°F.',
      'Brown ground beef with onion, drain fat.',
      'Mix beef with rice, half the salsa, and half the cheese.',
      'Stuff peppers with mixture and top with remaining cheese.',
      'Bake for 35-40 minutes until peppers are tender.'
    ],
    featured: false,
  },
  {
    id: '5',
    title: 'Salsa Verde Chicken Soup',
    slug: 'salsa-verde-chicken-soup',
    description: 'Hearty chicken soup with white beans and our signature salsa verde.',
    category: 'Soup',
    difficulty: 'Easy',
    prepTime: '15 min',
    cookTime: '30 min',
    servings: 6,
    featuredImage: '/images/salsa-bowl.png',
    ingredients: [
      '2 lbs chicken thighs, boneless',
      '1 jar Jose Madrid Medium Salsa',
      '2 cans white beans, drained',
      '4 cups chicken broth',
      '1 cup corn kernels',
      '1/2 cup heavy cream',
      'Fresh lime juice'
    ],
    instructions: [
      'Cook chicken in a large pot until done, then shred.',
      'Add salsa, beans, broth, and corn to pot.',
      'Simmer for 20 minutes.',
      'Stir in cream and lime juice.',
      'Serve hot with fresh cilantro and lime wedges.'
    ],
    featured: false,
  },
  {
    id: '6',
    title: 'Peach Salsa Pork Tenderloin',
    slug: 'peach-salsa-pork-tenderloin',
    description: 'Grilled pork tenderloin glazed with our sweet peach mild salsa.',
    category: 'Main Course',
    difficulty: 'Medium',
    prepTime: '10 min',
    cookTime: '25 min',
    servings: 4,
    featuredImage: '/images/salsa-bowl.png',
    ingredients: [
      '2 pork tenderloins (about 1 lb each)',
      '1 jar Jose Madrid Peach Mild Salsa',
      '2 tbsp olive oil',
      '1 tsp garlic powder',
      '1 tsp smoked paprika',
      'Salt and pepper'
    ],
    instructions: [
      'Preheat grill to medium-high heat.',
      'Season pork with oil, garlic powder, paprika, salt, and pepper.',
      'Grill for 15-20 minutes, turning occasionally.',
      'Brush with peach salsa during last 5 minutes of cooking.',
      'Let rest 5 minutes before slicing and serving with extra salsa.'
    ],
    featured: true,
  },
]

const categories = [
  { value: 'all', label: 'All Recipes' },
  { value: 'Main Course', label: 'Main Course' },
  { value: 'Seafood', label: 'Seafood' },
  { value: 'Soup', label: 'Soups' },
  { value: 'Appetizer', label: 'Appetizers' },
]

const difficulties = [
  { value: 'all', label: 'All Levels' },
  { value: 'Easy', label: 'Easy' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Hard', label: 'Hard' },
]

export default function RecipesPage() {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedDifficulty, setSelectedDifficulty] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Filter recipes
  const filteredRecipes = recipes.filter((recipe) => {
    const matchesSearch = recipe.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         recipe.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || recipe.category === selectedCategory
    const matchesDifficulty = selectedDifficulty === 'all' || recipe.difficulty === selectedDifficulty
    return matchesSearch && matchesCategory && matchesDifficulty
  })

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy': return 'bg-green-100 text-green-800'
      case 'Medium': return 'bg-yellow-100 text-yellow-800'
      case 'Hard': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <Navigation />
      
      {/* Header */}
      <section className="bg-white py-16 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <ChefHat className="w-16 h-16 mx-auto mb-6 text-salsa-500" />
            <h1 className="text-4xl font-bold font-serif text-gray-900 mb-4">
              Delicious <span className="text-gradient">Recipes</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Discover amazing recipes featuring Jose Madrid Salsa. From quick weeknight dinners to impressive weekend meals, 
              our salsas make everything taste better.
            </p>
          </div>
        </div>
      </section>

      {/* Featured Recipes Hero */}
      <section className="bg-gradient-to-r from-salsa-500 to-chile-500 py-12 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-8">Featured Recipes</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {recipes.filter(r => r.featured).slice(0, 3).map((recipe) => (
              <div key={recipe.id} className="bg-white/10 backdrop-blur rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-2">{recipe.title}</h3>
                <p className="text-white/90 mb-4">{recipe.description}</p>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {parseInt(recipe.prepTime) + parseInt(recipe.cookTime)} min
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

      {/* Filters */}
      <section className="bg-white py-6 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            {/* Search */}
            <div className="flex-1 max-w-md">
              <Input
                type="search"
                placeholder="Search recipes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="focus:ring-salsa-500 focus:border-salsa-500"
              />
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <Button
                  key={category.value}
                  variant={selectedCategory === category.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category.value)}
                  className={selectedCategory === category.value ? 'bg-salsa-500 hover:bg-salsa-600' : ''}
                >
                  {category.label}
                </Button>
              ))}
            </div>

            {/* Difficulty Filter */}
            <div className="flex flex-wrap gap-2">
              {difficulties.map((difficulty) => (
                <Button
                  key={difficulty.value}
                  variant={selectedDifficulty === difficulty.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedDifficulty(difficulty.value)}
                  className={selectedDifficulty === difficulty.value ? 'bg-salsa-500 hover:bg-salsa-600' : ''}
                >
                  {difficulty.label}
                </Button>
              ))}
            </div>
          </div>
          
          <div className="mt-4 text-sm text-gray-600">
            Showing {filteredRecipes.length} of {recipes.length} recipes
          </div>
        </div>
      </section>

      {/* Recipes Grid */}
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
                      
                      {/* Category Badge */}
                      <div className="absolute top-3 left-3">
                        <Badge className="bg-salsa-500 text-white">
                          {recipe.category}
                        </Badge>
                      </div>

                      {/* Difficulty Badge */}
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
                    
                    <p className="text-gray-600 line-clamp-3 mb-4">
                      {recipe.description}
                    </p>

                    <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {parseInt(recipe.prepTime) + parseInt(recipe.cookTime)} min total
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        Serves {recipe.servings}
                      </span>
                    </div>

                    <Button asChild className="w-full bg-salsa-500 hover:bg-salsa-600">
                      <Link href={`/recipes/${recipe.slug}`}>
                        View Recipe
                      </Link>
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