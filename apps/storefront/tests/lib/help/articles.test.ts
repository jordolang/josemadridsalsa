import { describe, expect, it } from 'vitest'
import { getHelpArticles, helpArticleTitle } from '@/lib/help/articles'

// The root layout's title template appends this to every page title.
const withTemplate = (title: string) => `${title} | Jose Madrid Salsa`

describe('helpArticleTitle', () => {
  it('keeps the Help Center label when the full title fits', () => {
    expect(helpArticleTitle('Shipping & Tracking')).toBe('Shipping & Tracking - Help Center')
  })

  it('drops the label rather than run past 60 characters', () => {
    expect(helpArticleTitle('Broken Jars, Returns & Refunds')).toBe('Broken Jars, Returns & Refunds')
  })

  it('gives every help article a 30-60 character title and a description of 160 or fewer', async () => {
    const articles = (await getHelpArticles()).filter((article) => article.slug !== 'index')
    expect(articles.length).toBeGreaterThan(0)
    for (const article of articles) {
      const title = withTemplate(helpArticleTitle(article.title))
      expect(title.length, title).toBeGreaterThanOrEqual(30)
      expect(title.length, title).toBeLessThanOrEqual(60)
      expect(article.description.length, article.slug).toBeLessThanOrEqual(160)
    }
  })
})
