import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SALSADOCS_URL,
  helpQuerySchema,
  searchHelpArticles,
  toHelpResults,
  type DocsSearchHit,
} from '@/lib/help/search'

const hit = (type: DocsSearchHit['type'], url: string, content: string): DocsSearchHit => ({
  id: `${url}-${content}`,
  type,
  url,
  content,
})

describe('toHelpResults', () => {
  it('drops internal docs and look-alike paths', () => {
    const results = toHelpResults([
      hit('page', '/docs/configuration/environment-variables', 'Environment variables'),
      hit('page', '/docs/helpers/thing', 'Helpers'),
      hit('page', '/docs/help/returns-and-refunds', 'Returns and refunds'),
    ])

    expect(results).toEqual([
      { title: 'Returns and refunds', url: `${SALSADOCS_URL}/docs/help/returns-and-refunds` },
    ])
  })

  it('keeps the help index page itself', () => {
    expect(toHelpResults([hit('page', '/docs/help', 'Customer Help')])).toHaveLength(1)
  })

  it('groups a page with its first matching section as the snippet and anchor', () => {
    const results = toHelpResults([
      hit('page', '/docs/help/returns-and-refunds', 'Returns and refunds'),
      hit('heading', '/docs/help/returns-and-refunds#who-pays-return-shipping', 'Who pays return shipping?'),
      hit('text', '/docs/help/returns-and-refunds#when-do-i-get-my-refund', 'Once we receive…'),
    ])

    expect(results).toEqual([
      {
        title: 'Returns and refunds',
        url: `${SALSADOCS_URL}/docs/help/returns-and-refunds#who-pays-return-shipping`,
        snippet: 'Who pays return shipping?',
      },
    ])
  })

  it('caps the list at 8 articles', () => {
    const hits = Array.from({ length: 12 }, (_, i) => hit('page', `/docs/help/a-${i}`, `A ${i}`))
    expect(toHelpResults(hits)).toHaveLength(8)
  })
})

describe('helpQuerySchema', () => {
  it('rejects blank and overlong queries', () => {
    expect(helpQuerySchema.safeParse('   ').success).toBe(false)
    expect(helpQuerySchema.safeParse('x'.repeat(101)).success).toBe(false)
    expect(helpQuerySchema.parse('  shipping ')).toBe('shipping')
  })
})

describe('searchHelpArticles', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns null when salsadocs is unreachable or errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await searchHelpArticles('shipping')).toBeNull()

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 500 })))
    expect(await searchHelpArticles('shipping')).toBeNull()
  })

  it('encodes the query and filters the response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json([
        hit('page', '/docs/help/shipping-and-tracking', 'Shipping and tracking'),
        hit('page', '/docs/api/orders', 'Orders API'),
      ]),
    )
    vi.stubGlobal('fetch', fetchMock)

    const results = await searchHelpArticles('track & ship')

    expect(fetchMock.mock.calls[0][0]).toBe(`${SALSADOCS_URL}/api/search?query=track%20%26%20ship`)
    expect(results).toEqual([
      { title: 'Shipping and tracking', url: `${SALSADOCS_URL}/docs/help/shipping-and-tracking` },
    ])
  })
})
