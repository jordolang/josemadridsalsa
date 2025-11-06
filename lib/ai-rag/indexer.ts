// Content indexer for RAG (Retrieval Augmented Generation)
// Extracts and indexes knowledge from the repository

import { prisma } from '@/lib/prisma'
import fs from 'fs/promises'
import path from 'path'

export type IndexedContent = {
  id: string
  type: 'product' | 'recipe' | 'page' | 'location' | 'general'
  title: string
  content: string
  metadata?: Record<string, any>
}

/**
 * Index all products from database
 */
export async function indexProducts(): Promise<IndexedContent[]> {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { category: true },
    orderBy: { name: 'asc' },
  })

  return products.map((product) => ({
    id: `product-${product.id}`,
    type: 'product' as const,
    title: product.name,
    content: [
      `Product: ${product.name}`,
      product.description || '',
      `Heat Level: ${product.heatLevel}`,
      `Price: $${product.price.toString()}`,
      product.ingredients.length > 0 ? `Ingredients: ${product.ingredients.join(', ')}` : '',
      product.category ? `Category: ${product.category.name}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    metadata: {
      slug: product.slug,
      heatLevel: product.heatLevel,
      price: product.price.toString(),
      ingredients: product.ingredients,
      category: product.category?.name,
    },
  }))
}

/**
 * Index all recipes from database
 */
export async function indexRecipes(): Promise<IndexedContent[]> {
  const recipes = await prisma.recipe.findMany({
    orderBy: { title: 'asc' },
  })

  return recipes.map((recipe) => ({
    id: `recipe-${recipe.id}`,
    type: 'recipe' as const,
    title: recipe.title,
    content: [
      `Recipe: ${recipe.title}`,
      recipe.description,
      `Category: ${recipe.category}`,
      `Difficulty: ${recipe.difficulty}`,
      `Prep Time: ${recipe.prepTime}`,
      `Cook Time: ${recipe.cookTime}`,
      `Servings: ${recipe.servings}`,
      recipe.ingredients.length > 0 ? `Ingredients: ${recipe.ingredients.join(', ')}` : '',
      recipe.instructions.length > 0 ? `Instructions: ${recipe.instructions.join('\n')}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    metadata: {
      slug: recipe.slug,
      category: recipe.category,
      difficulty: recipe.difficulty,
    },
  }))
}

/**
 * Index retail locations
 */
export async function indexLocations(): Promise<IndexedContent[]> {
  const locations = await prisma.retailLocation.findMany({
    where: { isActive: true },
    orderBy: [{ state: 'asc' }, { city: 'asc' }],
  })

  return locations.map((loc) => ({
    id: `location-${loc.id}`,
    type: 'location' as const,
    title: loc.businessName,
    content: [
      `Store: ${loc.businessName}`,
      `Address: ${loc.address}`,
      `City: ${loc.city}`,
      `State: ${loc.state}`,
      loc.zipCode ? `Zip: ${loc.zipCode}` : '',
      loc.phone ? `Phone: ${loc.phone}` : '',
      loc.website ? `Website: ${loc.website}` : '',
      loc.county ? `County: ${loc.county}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    metadata: {
      city: loc.city,
      state: loc.state,
      phone: loc.phone,
      website: loc.website,
    },
  }))
}

/**
 * Index static page content from markdown files
 */
export async function indexPages(): Promise<IndexedContent[]> {
  const pages: IndexedContent[] = []

  // Index About page content
  try {
    const aboutPath = path.join(process.cwd(), 'app', 'about', 'page.tsx')
    const aboutContent = await fs.readFile(aboutPath, 'utf-8')
    // Extract text content (simplified - in production, use a proper markdown parser)
    pages.push({
      id: 'page-about',
      type: 'page' as const,
      title: 'About Jose Madrid Salsa',
      content: 'About Jose Madrid Salsa: Premium gourmet salsas made with authentic recipes and the finest ingredients. Learn about our story, mission, and commitment to quality.',
      metadata: { path: '/about' },
    })
  } catch {
    // File doesn't exist or can't be read
  }

  // Add general knowledge
  pages.push({
    id: 'general-fundraising',
    type: 'general' as const,
    title: 'Fundraising Program',
    content: `Fundraising Program: Jose Madrid Salsa offers a fundraising program perfect for schools, churches, and organizations. High-profit margins and products people actually want. Visit /fundraising to learn more and start your fundraiser.`,
    metadata: { path: '/fundraising' },
  })

  pages.push({
    id: 'general-wholesale',
    type: 'general' as const,
    title: 'Wholesale Options',
    content: `Wholesale Program: Stock our premium salsas in your store. Competitive pricing with excellent support. Visit /wholesale to learn more about wholesale partnerships.`,
    metadata: { path: '/wholesale' },
  })

  pages.push({
    id: 'general-shipping',
    type: 'general' as const,
    title: 'Shipping Information',
    content: `Shipping: We offer nationwide shipping. Orders are typically processed within 1-2 business days. Shipping costs are calculated at checkout based on your location.`,
    metadata: {},
  })

  pages.push({
    id: 'general-contact',
    type: 'general' as const,
    title: 'Contact Information',
    content: `Contact: You can reach us through this chat, email, or find us at local stores throughout Ohio. Visit /find-us to find a store near you.`,
    metadata: { path: '/find-us' },
  })

  return pages
}

/**
 * Index all content from the repository
 */
export async function indexAllContent(): Promise<IndexedContent[]> {
  const [products, recipes, locations, pages] = await Promise.all([
    indexProducts(),
    indexRecipes(),
    indexLocations(),
    indexPages(),
  ])

  return [...products, ...recipes, ...locations, ...pages]
}

