// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { findMany, findUnique, count } = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  count: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: { developerBlogPost: { findMany, findUnique, count } },
  prisma: { developerBlogPost: { findMany, findUnique, count } },
}))

const { GET: listPosts } = await import('@/app/api/developer/blog/route')
const { GET: getPost } = await import('@/app/api/developer/blog/[slug]/route')

describe('public developer blog API while the blog is off the site', () => {
  it('answers 404 for the post list without reading the database', async () => {
    const res = await listPosts(new NextRequest('https://www.josemadridsalsa.com/api/developer/blog'))

    expect(res.status).toBe(404)
    expect(findMany).not.toHaveBeenCalled()
  })

  it('answers 404 for a published post without reading the database', async () => {
    const res = await getPost(
      new NextRequest('https://www.josemadridsalsa.com/api/developer/blog/the-real-cost-of-building-this-platform'),
      { params: Promise.resolve({ slug: 'the-real-cost-of-building-this-platform' }) },
    )

    expect(res.status).toBe(404)
    expect(findUnique).not.toHaveBeenCalled()
  })
})
