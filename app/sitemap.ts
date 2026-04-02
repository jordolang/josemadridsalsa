import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.josemadridsalsa.com'
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
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/salsas`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: priorities.products || 0.9,
    },
    {
      url: `${baseUrl}/products`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: priorities.products || 0.9,
    },
    {
      url: `${baseUrl}/products/search`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/fundraising`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/gift-certificates/purchase`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/gift-certificates/balance`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${baseUrl}/forms`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/battles`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/bundles`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/wholesale`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/where-is-jose`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/shipping`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${baseUrl}/developer`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/developer/blog`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.4,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${baseUrl}/cookies`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${baseUrl}/accessibility`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.2,
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
    const blogPosts = await prisma.developerBlogPost.findMany({
      where: { published: true },
      select: { slug: true, updatedAt: true },
    })

    blogPosts.forEach((post) => {
      urls.push({
        url: `${baseUrl}/developer/blog/${post.slug}`,
        lastModified: post.updatedAt,
        changeFrequency: 'monthly',
        priority: 0.4,
      })
    })
  } catch (error) {
    console.error('Failed to fetch developer blog posts for sitemap:', error)
  }

  try {
    const salsas = await prisma.product.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
    })

    salsas.forEach((salsa) => {
      urls.push({
        url: `${baseUrl}/salsas/${salsa.slug}`,
        lastModified: salsa.updatedAt,
        changeFrequency: 'weekly',
        priority: priorities.product || 0.8,
      })
    })
  } catch (error) {
    console.error('Failed to fetch salsas for sitemap:', error)
  }

  try {
    const fundraisers = await prisma.fundraiser.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
    })

    fundraisers.forEach((fundraiser) => {
      urls.push({
        url: `${baseUrl}/fundraisers/${fundraiser.slug}`,
        lastModified: fundraiser.updatedAt,
        changeFrequency: 'weekly',
        priority: 0.6,
      })
    })
  } catch (error) {
    console.error('Failed to fetch fundraisers for sitemap:', error)
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
