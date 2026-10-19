// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => {
  const empty = () => vi.fn(async () => [] as unknown[])
  return {
    prismaMock: {
      seoConfiguration: { findFirst: vi.fn(async () => ({ siteUrl: 'https://www.josemadridsalsa.com', sitemapPriorities: {} })) },
      product: { findMany: empty() },
      category: { findMany: empty() },
      recipe: { findMany: empty() },
      developerBlogPost: { findMany: vi.fn(async () => [{ slug: 'the-real-cost-of-building-this-platform', updatedAt: new Date() }]) },
      blogPost: { findMany: empty() },
      poll: { findMany: empty() },
      blogSeries: { findMany: empty() },
      blogCategory: { findMany: vi.fn(async () => [{ slug: 'road-notes', updatedAt: new Date() }]) },
      fundraiser: { findMany: vi.fn(async () => [{ slug: 'demo-harmony-choir', updatedAt: new Date() }]) },
      retailLocation: { findMany: empty() },
    },
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock, default: prismaMock }))
vi.mock('@/lib/cms/queries', () => ({ getSitemapLandingPages: vi.fn(async () => []) }))
vi.mock('@/lib/help/articles', () => ({ getHelpArticles: vi.fn(async () => []), helpArticleUrl: (slug: string) => `/help/${slug}` }))
vi.mock('@/lib/merchandise/catalog', () => ({ getMerchCatalog: vi.fn(async () => ({ status: 'unavailable' })) }))

const { default: sitemap } = await import('@/app/sitemap')

describe('storefront sitemap', () => {
  it('lists the developer page but not the developer blog or its posts', async () => {
    const urls = (await sitemap()).map((entry) => entry.url)

    expect(urls).toContain('https://www.josemadridsalsa.com/developer')
    expect(urls.some((url) => url.includes('/developer/blog'))).toBe(false)
    expect(prismaMock.developerBlogPost.findMany).not.toHaveBeenCalled()
  })

  it('lists the public rewards page', async () => {
    const urls = (await sitemap()).map((entry) => entry.url)

    expect(urls).toContain('https://www.josemadridsalsa.com/rewards')
  })

  it('lists no fundraiser pages, which redirect to the fundraising site', async () => {
    const urls = (await sitemap()).map((entry) => entry.url)

    expect(urls.some((url) => url.includes('/fundraisers/'))).toBe(false)
  })

  it('lists only heat-index categories that have a published post', async () => {
    const urls = (await sitemap()).map((entry) => entry.url)

    expect(prismaMock.blogCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { posts: { some: { status: 'PUBLISHED' } } } }),
    )
    expect(urls).toContain('https://www.josemadridsalsa.com/heat-index/category/road-notes')
  })
})
