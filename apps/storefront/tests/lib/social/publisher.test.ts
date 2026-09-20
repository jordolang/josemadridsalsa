import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock, fetchMock } = vi.hoisted(() => ({
  prismaMock: {
    socialAccount: { findUnique: vi.fn() },
    socialMediaPost: { findUnique: vi.fn() },
    socialPostPublish: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
  },
  fetchMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/social/platforms', () => ({ getValidAccessToken: vi.fn().mockResolvedValue('test-token') }))

import { publishToAccount } from '@/lib/social/publisher'

describe('Twitter blog publishing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
    prismaMock.socialAccount.findUnique.mockResolvedValue({ isActive: true, platform: 'TWITTER' })
    prismaMock.socialMediaPost.findUnique.mockResolvedValue({
      blogPostId: 'blog-1', content: 'Article', twitterContent: 'Hook https://example.com/article',
      hashtags: [], media: [{ media: { url: 'https://example.com/cover.jpg' } }],
    })
    prismaMock.socialPostPublish.findUnique.mockResolvedValue(null)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('posts the article link without uploading the Google Business cover', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { id: '123' } }), { status: 201 }))
    expect(await publishToAccount('post-1', 'account-1')).toEqual({
      success: true, externalPostId: '123', externalUrl: 'https://x.com/i/status/123',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('https://api.x.com/2/tweets', expect.objectContaining({
      body: JSON.stringify({ text: 'Hook https://example.com/article' }),
    }))
  })

  it.each([
    [403, '', 'HTTP 403'],
    [502, '<html>Bad gateway</html>', 'HTTP 502'],
    [201, '', 'Empty or invalid API response'],
    [201, '{}', 'Empty or invalid API response'],
    [403, '{"title":"Forbidden","detail":"Missing permission"}', 'Missing permission'],
    [429, '{"errors":[{"message":"Rate limit exceeded"}]}', 'Rate limit exceeded'],
  ])('records a useful failure for HTTP %s with body %s', async (status, body, message) => {
    fetchMock.mockResolvedValue(new Response(body, { status }))
    const result = await publishToAccount('post-1', 'account-1')
    expect(result.success).toBe(false)
    expect(result.error).toContain(message)
    expect(result.error).not.toContain('Unexpected end of JSON input')
    expect(prismaMock.socialPostPublish.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'FAILED', externalUrl: null, errorMessage: result.error }),
    }))
  })
})
