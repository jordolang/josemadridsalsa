// Content indexer for RAG (Retrieval Augmented Generation)
// Extracts and indexes knowledge from the repository

import { prisma } from '@/lib/prisma'
import { parseFindUsMarkdown, readFindUsMarkdownAbsolute } from '@/lib/find-us-parser'
import fs from 'fs/promises'
import path from 'path'

export type IndexedContent = {
  id: string
  type: 'product' | 'recipe' | 'page' | 'location' | 'general'
  title: string
  content: string
  metadata?: Record<string, any>
}

type MarkdownSource = {
  idPrefix: string
  title: string
  type: IndexedContent['type']
  relativePath: string[]
  chunk?: boolean
}

const PUBLIC_MARKDOWN_SOURCES: MarkdownSource[] = [
  {
    idPrefix: 'public-about',
    title: 'About Jose Madrid Salsa',
    type: 'page',
    relativePath: ['public', 'About Jose.md'],
  },
  {
    idPrefix: 'public-fundraising-overview',
    title: 'Fundraise With Jose Madrid Salsa',
    type: 'general',
    relativePath: ['public', 'Fundraise With Jose!.md'],
    chunk: true,
  },
  {
    idPrefix: 'public-fundraising-testimonials',
    title: 'Fundraiser Testimonials',
    type: 'general',
    relativePath: ['public', 'Fundraiser Testimonials.md'],
    chunk: true,
  },
  {
    idPrefix: 'public-recipes',
    title: 'Jose Madrid Recipes',
    type: 'recipe',
    relativePath: ['public', 'Recipes.md'],
    chunk: true,
  },
  {
    idPrefix: 'public-salsas',
    title: 'Salsa Catalog',
    type: 'product',
    relativePath: ['public', 'Salsas.md'],
    chunk: true,
  },
  {
    idPrefix: 'public-wholesale',
    title: 'Wholesale Program',
    type: 'general',
    relativePath: ['public', 'Wholesale.md'],
  },
  {
    idPrefix: 'public-contact',
    title: 'Contact Jose Madrid Salsa',
    type: 'general',
    relativePath: ['public', 'Contact.md'],
  },
]

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'section'
}

function normalizeMarkdownContent(markdown: string): string {
  return markdown
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/gi, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .trim()
}

type MarkdownSection = { heading: string; body: string }

function splitMarkdownSections(markdown: string): MarkdownSection[] {
  const lines = markdown.split(/\n/)
  const sections: MarkdownSection[] = []
  let currentHeading: string | null = null
  let buffer: string[] = []

  const pushSection = () => {
    const body = buffer.join('\n').trim()
    if (!currentHeading && body.length === 0) {
      buffer = []
      return
    }
    sections.push({ heading: currentHeading ?? 'Overview', body })
    buffer = []
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/)
    if (headingMatch) {
      if (buffer.length > 0 || currentHeading) {
        pushSection()
      }
      currentHeading = headingMatch[2].trim()
      buffer = []
    } else {
      buffer.push(line)
    }
  }

  if (buffer.length > 0 || currentHeading) {
    pushSection()
  }

  return sections.filter((section) => section.body.trim().length > 0)
}

function getLocationKey(item: IndexedContent): string {
  const metadata = item.metadata ?? {}
  const address = typeof metadata.address === 'string' ? metadata.address : ''
  const city = typeof metadata.city === 'string' ? metadata.city : ''
  const state = typeof metadata.state === 'string' ? metadata.state : ''

  return [item.title, address, city, state]
    .map((part) => part.toLowerCase().trim())
    .join('|')
}

async function safeIndex<T>(label: string, fn: () => Promise<T>, fallback: () => T): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    console.error(`[AI_RAG] Failed to ${label}`, error)
    return fallback()
  }
}

async function indexPublicMarkdownContent(): Promise<IndexedContent[]> {
  const entries: IndexedContent[] = []

  for (const source of PUBLIC_MARKDOWN_SOURCES) {
    const absolutePath = path.join(process.cwd(), ...source.relativePath)
    let raw: string
    try {
      raw = await fs.readFile(absolutePath, 'utf-8')
    } catch {
      continue
    }

    const normalized = normalizeMarkdownContent(raw)
    const sections = source.chunk ? splitMarkdownSections(normalized) : []

    if (source.chunk && sections.length > 0) {
      sections.forEach((section, index) => {
        const cleanBody = normalizeMarkdownContent(section.body)
        const chunkTitle = section.heading.trim()
        entries.push({
          id: `${source.idPrefix}-${slugify(chunkTitle)}-${index}`,
          type: source.type,
          title: `${source.title} — ${chunkTitle}`,
          content: [chunkTitle, cleanBody].filter(Boolean).join('\n').trim(),
          metadata: {
            source: `/${source.relativePath.join('/')}`,
            category: source.title,
          },
        })
      })
      continue
    }

    entries.push({
      id: source.idPrefix,
      type: source.type,
      title: source.title,
      content: `${source.title}\n${normalized}`.trim(),
      metadata: {
        source: `/${source.relativePath.join('/')}`,
      },
    })
  }

  return entries
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
      address: loc.address,
      city: loc.city,
      state: loc.state,
      phone: loc.phone,
      website: loc.website,
    },
  }))
}

async function indexMarkdownLocations(): Promise<IndexedContent[]> {
  try {
    const mdPath = await readFindUsMarkdownAbsolute()
    const markdownLocations = await parseFindUsMarkdown(mdPath)

    return markdownLocations.map((loc) => ({
      id: `markdown-location-${loc.id}`,
      type: 'location' as const,
      title: loc.businessName,
      content: [
        `Store: ${loc.businessName}`,
        loc.address ? `Address: ${loc.address}` : '',
        `City: ${loc.city}`,
        `State: ${loc.state}`,
        loc.zipCode ? `Zip: ${loc.zipCode}` : '',
        loc.phone ? `Phone: ${loc.phone}` : '',
        loc.website ? `Website: ${loc.website}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      metadata: {
        address: loc.address,
        city: loc.city,
        state: loc.state,
        phone: loc.phone,
        website: loc.website,
      },
    }))
  } catch (error) {
    console.error('[AI_RAG] Failed to index markdown locations', error)
    return []
  }
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
  const [products, recipes, pages, markdownPages, markdownLocations] = await Promise.all([
    safeIndex('index products', indexProducts, () => [] as IndexedContent[]),
    safeIndex('index recipes', indexRecipes, () => [] as IndexedContent[]),
    safeIndex('index static pages', indexPages, () => [] as IndexedContent[]),
    safeIndex('index public markdown content', indexPublicMarkdownContent, () => [] as IndexedContent[]),
    safeIndex('index markdown locations', indexMarkdownLocations, () => [] as IndexedContent[]),
  ])

  let locations = await safeIndex('index database locations', indexLocations, () => [] as IndexedContent[])

  if (locations.length === 0) {
    locations = markdownLocations
  } else if (markdownLocations.length > 0) {
    const existingKeys = new Set(locations.map((loc) => getLocationKey(loc)))
    for (const markdownLocation of markdownLocations) {
      const key = getLocationKey(markdownLocation)
      if (!existingKeys.has(key)) {
        existingKeys.add(key)
        locations.push(markdownLocation)
      }
    }
  }

  return [...products, ...recipes, ...locations, ...pages, ...markdownPages]
}
