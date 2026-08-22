import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { getSitemapLandingPages } from '@/lib/cms/queries'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let baseUrl = 'https://www.josemadrid.net'
  let seoConfig = null
  let priorities: Record<string, number> = {}

  try {
    seoConfig = await prisma.seoConfiguration.findFirst()
    priorities = (seoConfig?.sitemapPriorities as Record<string, number>) || {}
    if (seoConfig?.siteUrl) {
      baseUrl = seoConfig.siteUrl.replace(/\/+$/, '')
    }
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
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/laperla`,
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
      url: `${baseUrl}/polls`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
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
      url: `${baseUrl}/live`,
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
      url: `${baseUrl}/returns`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${baseUrl}/refunds`,
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
      url: `${baseUrl}/heat-index`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.85,
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
    const bundles = await prisma.bundle.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
    })

    bundles.forEach((bundle) => {
      urls.push({
        url: `${baseUrl}/bundles/${bundle.slug}`,
        lastModified: bundle.updatedAt,
        changeFrequency: 'weekly',
        priority: priorities.bundle || 0.7,
      })
    })
  } catch (error) {
    console.error('Failed to fetch bundles for sitemap:', error)
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
    const heatIndexPosts = await prisma.blogPost.findMany({
      where: { status: 'PUBLISHED' },
      select: { slug: true, updatedAt: true },
    })
    heatIndexPosts.forEach((post) => {
      urls.push({
        url: `${baseUrl}/heat-index/${post.slug}`,
        lastModified: post.updatedAt,
        changeFrequency: 'weekly',
        priority: 0.7,
      })
    })
  } catch (error) {
    console.error('Failed to fetch heat-index posts for sitemap:', error)
  }

  try {
    const polls = await prisma.poll.findMany({
      // Invite-only polls stay out of the sitemap: the access code in the share
      // link is their only protection, and a crawled URL would not carry it.
      where: {
        visibility: 'PUBLIC',
        noIndex: false,
        OR: [{ status: 'PUBLISHED' }, { status: 'SCHEDULED', publishedAt: { lte: new Date() } }],
      },
      select: { slug: true, updatedAt: true },
    })
    polls.forEach((poll) => {
      urls.push({
        url: `${baseUrl}/polls/${poll.slug}`,
        lastModified: poll.updatedAt,
        changeFrequency: 'weekly',
        priority: 0.5,
      })
    })
  } catch (error) {
    console.error('Failed to fetch polls for sitemap:', error)
  }

  try {
    const series = await prisma.blogSeries.findMany({
      select: { slug: true, updatedAt: true },
    })
    series.forEach((s) => {
      urls.push({
        url: `${baseUrl}/heat-index/series/${s.slug}`,
        lastModified: s.updatedAt,
        changeFrequency: 'weekly',
        priority: 0.6,
      })
    })
  } catch (error) {
    console.error('Failed to fetch heat-index series for sitemap:', error)
  }

  try {
    const categories = await prisma.blogCategory.findMany({
      select: { slug: true, updatedAt: true },
    })
    categories.forEach((c) => {
      urls.push({
        url: `${baseUrl}/heat-index/category/${c.slug}`,
        lastModified: c.updatedAt,
        changeFrequency: 'weekly',
        priority: 0.5,
      })
    })
  } catch (error) {
    console.error('Failed to fetch heat-index categories for sitemap:', error)
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
    const landingPages = await getSitemapLandingPages()

    landingPages.forEach((page) => {
      urls.push({
        url: `${baseUrl}/${page.slug}`,
        lastModified: page.updatedAt,
        changeFrequency: 'weekly',
        priority: priorities.landingPage || 0.6,
      })
    })
  } catch (error) {
    console.error('Failed to fetch CMS landing pages for sitemap:', error)
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
