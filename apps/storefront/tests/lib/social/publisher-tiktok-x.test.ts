// @vitest-environment node
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

function post(media: Array<{ url: string; mimeType: string }>) {
  return {
    blogPostId: null, content: 'Fresh salsa', tiktokContent: null, twitterContent: null,
    hashtags: [], media: media.map((m) => ({ media: m })),
  }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
  prismaMock.socialPostPublish.findUnique.mockResolvedValue(null)
})
afterEach(() => vi.unstubAllGlobals())

describe('TikTok publishing', () => {
  beforeEach(() => {
    prismaMock.socialAccount.findUnique.mockResolvedValue({ isActive: true, platform: 'TIKTOK' })
  })

  it('treats error.code "ok" as success', async () => {
    prismaMock.socialMediaPost.findUnique.mockResolvedValue(post([{ url: 'https://cdn/v.mp4', mimeType: 'video/mp4' }]))
    fetchMock.mockResolvedValue(json({ data: { publish_id: 'v_pub_1' }, error: { code: 'ok', message: '' } }))

    const result = await publishToAccount('p', 'a')

    expect(result).toEqual({ success: true, externalPostId: 'v_pub_1', externalUrl: undefined })
    expect(fetchMock.mock.calls[0][0]).toBe('https://open.tiktokapis.com/v2/post/publish/video/init/')
  })

  it('sends image posts to the photo endpoint', async () => {
    prismaMock.socialMediaPost.findUnique.mockResolvedValue(post([
      { url: 'https://cdn/a.jpg', mimeType: 'image/jpeg' },
      { url: 'https://cdn/b.png', mimeType: 'image/png' },
    ]))
    fetchMock.mockResolvedValue(json({ data: { publish_id: 'p_pub_1' }, error: { code: 'ok', message: '' } }))

    const result = await publishToAccount('p', 'a')

    expect(result.success).toBe(true)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://open.tiktokapis.com/v2/post/publish/content/init/')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body).toMatchObject({
      media_type: 'PHOTO',
      post_mode: 'DIRECT_POST',
      source_info: { source: 'PULL_FROM_URL', photo_images: ['https://cdn/a.jpg', 'https://cdn/b.png'], photo_cover_index: 0 },
    })
  })

  it('reports a real TikTok error', async () => {
    prismaMock.socialMediaPost.findUnique.mockResolvedValue(post([{ url: 'https://cdn/a.jpg', mimeType: 'image/jpeg' }]))
    fetchMock.mockResolvedValue(json({ error: { code: 'url_ownership_unverified', message: 'Verify the domain' } }, 403))

    const result = await publishToAccount('p', 'a')

    expect(result.success).toBe(false)
    expect(result.error).toContain('Verify the domain')
  })
})

describe('X image upload', () => {
  beforeEach(() => {
    prismaMock.socialAccount.findUnique.mockResolvedValue({ isActive: true, platform: 'TWITTER' })
    prismaMock.socialMediaPost.findUnique.mockResolvedValue(post([{ url: 'https://cdn/a.jpg', mimeType: 'image/jpeg' }]))
  })

  it('uploads through the v2 media endpoint and attaches the id', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(new Blob(['img'])))
      .mockResolvedValueOnce(json({ data: { id: 'm1' } }))
      .mockResolvedValueOnce(json({ data: { id: 't1' } }, 201))

    const result = await publishToAccount('p', 'a')

    expect(result.success).toBe(true)
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.x.com/2/media/upload')
    expect(JSON.parse((fetchMock.mock.calls[2][1] as RequestInit).body as string)).toEqual({
      text: 'Fresh salsa', media: { media_ids: ['m1'] },
    })
  })

  it('fails the post instead of tweeting text-only when the upload fails', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(new Blob(['img'])))
      .mockResolvedValueOnce(json({ title: 'Forbidden', detail: 'Missing media.write' }, 403))

    const result = await publishToAccount('p', 'a')

    expect(result.success).toBe(false)
    expect(result.error).toContain('Missing media.write')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
