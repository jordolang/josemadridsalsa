// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

const { findMany, findUnique } = vi.hoisted(() => ({ findMany: vi.fn(), findUnique: vi.fn() }))

vi.mock('@/lib/prisma', () => ({
  default: { developerBlogPost: { findMany, findUnique } },
  prisma: { developerBlogPost: { findMany, findUnique } },
}))

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
}))

const { default: BlogListPage } = await import('@/app/(public)/developer/blog/page')
const { default: BlogPostPage } = await import('@/app/(public)/developer/blog/[slug]/page')

describe('developer blog pages while the blog is off the site', () => {
  it('404s the blog list without reading any posts', async () => {
    await expect(BlogListPage()).rejects.toThrow('NEXT_NOT_FOUND')
    expect(findMany).not.toHaveBeenCalled()
  })

  it('404s a published post', async () => {
    findUnique.mockResolvedValue({ slug: 'the-real-cost-of-building-this-platform', published: true })

    await expect(
      BlogPostPage({ params: Promise.resolve({ slug: 'the-real-cost-of-building-this-platform' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
