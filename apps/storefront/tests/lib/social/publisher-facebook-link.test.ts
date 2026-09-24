import { describe, afterEach, beforeEach, expect, it, vi } from 'vitest'

const { prismaMock, getValidAccessTokenMock } = vi.hoisted(() => ({
  prismaMock: {
    socialAccount: { findUnique: vi.fn() },
    socialMediaPost: { findUnique: vi.fn() },
    socialPostPublish: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
  },
  getValidAccessTokenMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock, default: prismaMock }))
vi.mock('@/lib/social/platforms', () => ({ getValidAccessToken: getValidAccessTokenMock }))

import { publishToAccount } from '@/lib/social/publisher'

const ARTICLE_URL = 'https://www.josemadrid.net/heat-index/big-e-2026'

/** A Facebook page account and an article cross-post that links back to it. */
function arrangeLinkPost(mediaUrls: string[] = []) {
  prismaMock.socialAccount.findUnique.mockResolvedValue({
    id: 'acct-1',
    accountId: 'page-1',
    platform: 'FACEBOOK',
    isActive: true,
  })
  prismaMock.socialMediaPost.findUnique.mockResolvedValue({
    id: 'post-1',
    content: 'Jose Madrid Salsa Is at The Big E!',
    facebookContent: 'Jose Madrid Salsa Is at The Big E!',
    linkUrl: ARTICLE_URL,
    hashtags: [],
    media: mediaUrls.map((url, i) => ({ order: i, media: { url } })),
  })
  prismaMock.socialPostPublish.findUnique.mockResolvedValue(null)
  prismaMock.socialPostPublish.upsert.mockResolvedValue({})
  prismaMock.socialPostPublish.update.mockResolvedValue({})
  getValidAccessTokenMock.mockResolvedValue('page-token')
}

/** Graph API replies: a scrape acknowledgement, then the created post. */
function mockGraphResponses(...payloads: unknown[]) {
  const fetchMock = vi.fn()
  for (const payload of payloads) {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => payload })
  }
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** The request bodies sent to graph.facebook.com, parsed, in call order. */
function bodies(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string))
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('publishToAccount — Facebook link posts', () => {
  it("re-scrapes the link before posting so the card uses the page's current og:image", async () => {
    arrangeLinkPost()
    const fetchMock = mockGraphResponses({ id: ARTICLE_URL }, { id: 'page-1_99' })

    const result = await publishToAccount('post-1', 'acct-1')

    expect(result.success).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    // The scrape has to come first: Facebook builds the preview card from its
    // cached Open Graph data at the moment the post is created.
    const [scrapeUrl] = fetchMock.mock.calls[0]
    const [feedUrl] = fetchMock.mock.calls[1]
    expect(scrapeUrl).toBe('https://graph.facebook.com/v21.0/')
    expect(feedUrl).toBe('https://graph.facebook.com/v21.0/page-1/feed')

    const [scrapeBody, feedBody] = bodies(fetchMock)
    expect(scrapeBody).toMatchObject({ id: ARTICLE_URL, scrape: 'true', access_token: 'page-token' })
    expect(feedBody).toMatchObject({ link: ARTICLE_URL, access_token: 'page-token' })
  })

  it('still publishes when the re-scrape fails, rather than losing the post', async () => {
    arrangeLinkPost()
    const fetchMock = vi.fn()
    fetchMock.mockRejectedValueOnce(new Error('graph unreachable'))
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'page-1_99' }) })
    vi.stubGlobal('fetch', fetchMock)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await publishToAccount('post-1', 'acct-1')

    expect(result.success).toBe(true)
    expect(result.externalPostId).toBe('page-1_99')
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('reports a Graph error on the scrape without failing the post', async () => {
    arrangeLinkPost()
    const fetchMock = mockGraphResponses(
      { error: { message: 'Unsupported post request' } },
      { id: 'page-1_99' },
    )
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await publishToAccount('post-1', 'acct-1')

    expect(result.success).toBe(true)
    expect(warn.mock.calls[0][0]).toContain('Unsupported post request')
    warn.mockRestore()
  })

  it('does not scrape for a photo post, which carries no link to preview', async () => {
    arrangeLinkPost()
    prismaMock.socialMediaPost.findUnique.mockResolvedValue({
      id: 'post-1',
      content: 'Fresh batch',
      facebookContent: 'Fresh batch',
      linkUrl: null,
      hashtags: [],
      media: [{ order: 0, media: { url: 'https://cdn.example.com/jar.jpg' } }],
    })
    const fetchMock = mockGraphResponses({ id: 'page-1_photo' })

    const result = await publishToAccount('post-1', 'acct-1')

    expect(result.success).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('https://graph.facebook.com/v21.0/page-1/photos')
  })
})
