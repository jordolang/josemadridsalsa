import { describe, expect, it } from 'vitest'
import { getHelpArticles, getHelpNav } from '@/lib/help/articles'
import { helpQuerySchema, searchArticles, searchHelpArticles, toSections } from '@/lib/help/search'
import { slugify } from '@/lib/help/slugify'
import type { HelpArticle } from '@/lib/help/articles'

const article = (slug: string, title: string, body: string): HelpArticle => ({
  slug,
  title,
  description: '',
  body,
})

describe('slugify', () => {
  it('matches github-slugger anchors used by salsadocs links', () => {
    expect(slugify('Our Return & Refund Policy')).toBe('our-return--refund-policy')
    expect(slugify('Forgot your password?')).toBe('forgot-your-password')
  })
})

describe('toSections', () => {
  it('splits at headings and keeps accordion questions searchable', () => {
    const sections = toSections(
      'Intro text\n\n## Who pays return shipping?\n\n<Accordion title="Can I swap flavors?">\nYes, **gladly**.\n</Accordion>',
    )
    expect(sections).toEqual([
      { anchor: null, heading: null, text: 'Intro text' },
      {
        anchor: 'who-pays-return-shipping',
        heading: 'Who pays return shipping?',
        text: 'Can I swap flavors? Yes, gladly.',
      },
    ])
  })
})

describe('searchArticles', () => {
  const articles = [
    article('returns', 'Returns', '## Broken jars\n\nSend us a photo of the broken jar.\n\n## Refund timing\n\nRefunds take 5 days.'),
    article('shipping', 'Shipping & Tracking', '## Tracking\n\nUse the tracking link in your email.'),
  ]

  it('links to the best matching section with a snippet', () => {
    expect(searchArticles(articles, 'broken photo')).toEqual([
      { title: 'Returns', url: '/help/returns#broken-jars', snippet: 'Send us a photo of the broken jar.' },
    ])
  })

  it('requires every word and ranks title matches first', () => {
    expect(searchArticles(articles, 'refund nonsense')).toEqual([])
    expect(searchArticles(articles, 'tracking').map((r) => r.url)).toEqual(['/help/shipping#tracking'])
  })

  it('caps the list at 8 articles', () => {
    const many = Array.from({ length: 12 }, (_, i) => article(`a-${i}`, `Salsa ${i}`, 'salsa'))
    expect(searchArticles(many, 'salsa')).toHaveLength(8)
  })
})

describe('helpQuerySchema', () => {
  it('rejects blank and overlong queries', () => {
    expect(helpQuerySchema.safeParse('   ').success).toBe(false)
    expect(helpQuerySchema.safeParse('x'.repeat(101)).success).toBe(false)
    expect(helpQuerySchema.parse('  shipping ')).toBe('shipping')
  })
})

describe('content/help', () => {
  it('loads every article listed in meta.json into the sidebar', async () => {
    const [articles, nav] = await Promise.all([getHelpArticles(), getHelpNav()])
    expect(articles.map((a) => a.slug)).toContain('index')
    expect(nav.flatMap((s) => s.articles)).toHaveLength(articles.length - 1)
    expect(nav.map((s) => s.title)).toEqual(['Shopping', 'Fundraisers', 'Your Account'])
  })

  it('finds real articles', async () => {
    const [first] = await searchHelpArticles('broken jar')
    expect(first.url).toMatch(/^\/help\/returns/)
  })
})
