import { describe, expect, it } from 'vitest'
import {
  FUNDRAISING_BLOG_POSTS,
  formatFundraisingBlogDate,
  getFundraisingBlogPost,
  getFundraisingBlogPosts,
} from '@/lib/fundraising-site/blog-posts'
import { FUNDRAISING_STATIC_PAGES } from '@/lib/fundraising-site/pages'

describe('fundraising blog posts', () => {
  it('has unique slugs', () => {
    const slugs = FUNDRAISING_BLOG_POSTS.map((post) => post.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('uses kebab-case slugs', () => {
    for (const post of FUNDRAISING_BLOG_POSTS) {
      expect(post.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    }
  })

  it('gives every post a title, a valid date and a body', () => {
    for (const post of FUNDRAISING_BLOG_POSTS) {
      expect(post.title.trim()).not.toBe('')
      expect(post.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(Number.isNaN(Date.parse(post.date))).toBe(false)
      expect(post.body.length).toBeGreaterThan(0)
    }
  })

  it('lists posts newest first and looks them up by slug', () => {
    const dates = getFundraisingBlogPosts().map((post) => post.date)
    expect(dates).toEqual([...dates].sort().reverse())
    expect(getFundraisingBlogPost('my-first-blog-post')?.author).toBe('Matt')
    expect(getFundraisingBlogPost('missing')).toBeUndefined()
  })

  it('formats dates without a timezone shift', () => {
    expect(formatFundraisingBlogDate('2020-05-05')).toBe('May 5, 2020')
  })

  it('registers every post in the static page list', () => {
    for (const post of FUNDRAISING_BLOG_POSTS) {
      expect(FUNDRAISING_STATIC_PAGES).toContain(`/blog/${post.slug}`)
    }
  })
})
