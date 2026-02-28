import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.josemadrid.net'
  let seoConfig = null
  let priorities: Record<string, number> = {}

  try {
    seoConfig = await prisma.seoConfiguration.findFirst()
    priorities = (seoConfig?.sitemapPriorities as Record<string, number>) || {}
  } catch (error) {
    console.error('Failed to fetch SEO config for sitemap, using defaults:', error)
  }

  const urls: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: priorities.home || 1,
    },
    {
      url: `${baseUrl}/merchandise`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: priorities.products || 0.9,
    },
    {
      url: `${baseUrl}/recipes`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: priorities.recipes || 0.8,
    },
    {
      url: `${baseUrl}/find-us`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: priorities.locations || 0.7,
    },
    {
      url: `${baseUrl}/our-story`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ]

  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
    })

    products.forEach((product) => {
      urls.push({
        url: `${baseUrl}/products/${product.slug}`,
        lastModified: product.updatedAt,
        changeFrequency: 'weekly',
        priority: priorities.product || 0.8,
      })
    })
  } catch (error) {
    console.error('Failed to fetch products for sitemap:', error)
  }

  try {
    const recipes = await prisma.recipe.findMany({
      select: { slug: true, updatedAt: true },
    })

    recipes.forEach((recipe) => {
      urls.push({
        url: `${baseUrl}/recipes/${recipe.slug}`,
        lastModified: recipe.updatedAt,
        changeFrequency: 'monthly',
        priority: priorities.recipe || 0.6,
      })
    })
  } catch (error) {
    console.error('Failed to fetch recipes for sitemap:', error)
  }

  try {
    const locations = await prisma.retailLocation.findMany({
      where: { isActive: true },
      select: { id: true, updatedAt: true },
    })

    locations.forEach((location) => {
      urls.push({
        url: `${baseUrl}/find-us/${location.id}`,
        lastModified: location.updatedAt,
        changeFrequency: 'monthly',
        priority: priorities.location || 0.5,
      })
    })
  } catch (error) {
    console.error('Failed to fetch locations for sitemap:', error)
  }

  return urls
}
