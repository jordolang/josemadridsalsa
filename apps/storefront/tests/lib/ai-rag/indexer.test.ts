// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

const { findManyBlogPosts, developerVisibility } = vi.hoisted(() => ({
  findManyBlogPosts: vi.fn(),
  developerVisibility: { isPublic: true },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: { developerBlogPost: { findMany: findManyBlogPosts } },
}))

vi.mock('@/lib/developer/visibility', () => ({
  get DEVELOPER_BLOG_PUBLIC() {
    return developerVisibility.isPublic
  },
}))

const { indexDeveloperBlogPosts, indexDocumentation, indexHelpArticles, mdxToMarkdown } = await import(
  '@/lib/ai-rag/indexer'
)
const { searchContent } = await import('@/lib/ai-rag/retriever')

describe('mdxToMarkdown', () => {
  it('reads the frontmatter and drops component tags but keeps their text', () => {
    const { title, description, body } = mdxToMarkdown(
      [
        '---',
        'title: Gift Certificates',
        'description: "Sell and redeem gift certificates."',
        '---',
        '',
        '<Callout type="warn">',
        'Balances never expire.',
        '</Callout>',
        '<PageInlineTOC />',
      ].join('\n'),
    )

    expect(title).toBe('Gift Certificates')
    expect(description).toBe('Sell and redeem gift certificates.')
    expect(body).toContain('Balances never expire.')
    expect(body).not.toMatch(/<Callout|<\/Callout>|<PageInlineTOC/)
  })
})

describe('indexDocumentation', () => {
  it('indexes the docs site, one entry per section, from the repository', async () => {
    const entries = await indexDocumentation()

    expect(entries.length).toBeGreaterThan(100)
    expect(entries.every((entry) => entry.type === 'documentation')).toBe(true)
    expect(entries.some((entry) => entry.metadata?.source === 'docs/features/gift-certificates')).toBe(true)
    expect(entries.some((entry) => entry.metadata?.source === 'docs/api/rest-api')).toBe(true)
    expect(entries.every((entry) => !entry.content.startsWith('---'))).toBe(true)
  })

  it('lets a how-to question retrieve the matching docs section', async () => {
    const entries = await indexDocumentation()

    const [top] = searchContent('How do gift certificates work?', entries, 1)

    expect(top.metadata?.category).toBe('Gift Certificates')
  })
})

describe('indexHelpArticles', () => {
  it('indexes the customer Help Center articles as store pages linked to /help', async () => {
    const entries = await indexHelpArticles()

    expect(entries.every((entry) => entry.type === 'page')).toBe(true)
    expect(entries.some((entry) => entry.metadata?.path === '/help/shipping')).toBe(true)
    expect(entries.some((entry) => entry.metadata?.path === '/help/fundraising')).toBe(true)
    expect(entries.every((entry) => !/<Callout|<\/Callout>/.test(entry.content))).toBe(true)
  })

  it('lets a customer question retrieve the matching help section', async () => {
    const entries = await indexHelpArticles()

    const [top] = searchContent('Is there free shipping?', entries, 1)

    expect(top.metadata?.path).toBe('/help/shipping')
  })
})

describe('indexDeveloperBlogPosts', () => {
  it('indexes nothing while the developer blog is taken off the site', async () => {
    developerVisibility.isPublic = false
    findManyBlogPosts.mockClear()

    try {
      expect(await indexDeveloperBlogPosts()).toEqual([])
      expect(findManyBlogPosts).not.toHaveBeenCalled()
    } finally {
      developerVisibility.isPublic = true
    }
  })

  it('indexes only published developer blog posts', async () => {
    findManyBlogPosts.mockResolvedValueOnce([
      {
        id: 'p1',
        slug: 'new-checkout',
        title: 'The new checkout',
        excerpt: 'Why we rebuilt checkout.',
        content: 'We moved to **Stripe** Checkout.',
        tags: ['checkout'],
      },
    ])

    const entries = await indexDeveloperBlogPosts()

    expect(findManyBlogPosts).toHaveBeenCalledWith(expect.objectContaining({ where: { published: true } }))
    expect(entries).toEqual([
      expect.objectContaining({
        id: 'developer-blog-p1',
        type: 'documentation',
        title: 'The new checkout',
        content: expect.stringContaining('We moved to **Stripe** Checkout.'),
        metadata: { path: '/developer/blog/new-checkout', tags: ['checkout'] },
      }),
    ])
  })
})
