import { describe, expect, it, vi, beforeEach } from 'vitest'

const { prismaMock, publishToAccountMock } = vi.hoisted(() => ({
  prismaMock: {
    blogPost: { findUnique: vi.fn() },
    socialAccount: { findMany: vi.fn() },
    socialMediaPost: { upsert: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  },
  publishToAccountMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock, default: prismaMock }))
vi.mock('@/lib/social/publisher', () => ({ publishToAccount: publishToAccountMock }))

import {
  markdownToPlainText,
  blogPostToSocialText,
  buildTwitterText,
  blogPostUrl,
  crosspostBlogPost,
  getBlogCrosspostStatus,
  CROSSPOST_PLATFORMS,
} from '@/lib/social/blog-crosspost'

describe('markdownToPlainText', () => {
  it('strips heading markers but keeps the text', () => {
    expect(markdownToPlainText('## The Y-Bridge Tasting')).toBe('The Y-Bridge Tasting')
  })

  it('strips bold, italic, and inline code markers', () => {
    expect(markdownToPlainText('This is **bold**, *italic*, and `code`.')).toBe(
      'This is bold, italic, and code.',
    )
  })

  it('converts unordered lists to bullets', () => {
    const md = '- Raspberry Chipotle\n- Black Bean & Corn'
    expect(markdownToPlainText(md)).toBe('• Raspberry Chipotle\n• Black Bean & Corn')
  })

  it('keeps ordered list numbers', () => {
    expect(markdownToPlainText('1. First\n2. Second')).toBe('1. First\n2. Second')
  })

  it('renders links as "text (url)"', () => {
    expect(markdownToPlainText('Try our [salsa](https://josemadrid.net/shop).')).toBe(
      'Try our salsa (https://josemadrid.net/shop).',
    )
  })

  it('drops inline images (the link card carries the cover image)', () => {
    expect(markdownToPlainText('Before ![a jar of salsa](https://cdn/x.jpg) after')).toBe(
      'Before  after',
    )
  })

  it('converts youtube/vimeo/video embeds to plain URLs', () => {
    expect(markdownToPlainText('[[youtube:abc123]]')).toBe('https://youtu.be/abc123')
    expect(markdownToPlainText('[[vimeo:987654]]')).toBe('https://vimeo.com/987654')
    expect(markdownToPlainText('[[video:https://cdn/clip.mp4]]')).toBe('https://cdn/clip.mp4')
  })

  it('strips blockquote markers', () => {
    expect(markdownToPlainText('> A wise word about heat.')).toBe('A wise word about heat.')
  })

  it('removes horizontal rules', () => {
    expect(markdownToPlainText('Above\n\n---\n\nBelow')).toBe('Above\n\nBelow')
  })

  it('preserves paragraph breaks and collapses extra blank lines', () => {
    const md = 'First paragraph.\n\n\n\nSecond paragraph.'
    expect(markdownToPlainText(md)).toBe('First paragraph.\n\nSecond paragraph.')
  })

  it('keeps fenced code content without the fences', () => {
    const md = '```js\nconst heat = 10\n```'
    expect(markdownToPlainText(md)).toBe('const heat = 10')
  })
})

describe('blogPostToSocialText', () => {
  it('leads with title and subtitle, then the body', () => {
    const out = blogPostToSocialText({
      title: 'The Y-Bridge Tasting',
      subtitle: 'A short one-liner',
      content: '## Heat\n\nThe salsa was **excellent**.',
    })
    expect(out).toBe('The Y-Bridge Tasting\n\nA short one-liner\n\nHeat\n\nThe salsa was excellent.')
  })

  it('omits the subtitle when absent', () => {
    const out = blogPostToSocialText({
      title: 'Title Only',
      subtitle: null,
      content: 'Body text here.',
    })
    expect(out).toBe('Title Only\n\nBody text here.')
  })
})

describe('buildTwitterText', () => {
  const url = 'https://www.josemadrid.net/heat-index/y-bridge'

  it('includes title, excerpt, and link when within the limit', () => {
    const out = buildTwitterText({ title: 'Y-Bridge', excerpt: 'A tasting note.' }, url)
    expect(out).toBe(`Y-Bridge — A tasting note. ${url}`)
  })

  it('never exceeds the character limit and always keeps the link', () => {
    const out = buildTwitterText(
      { title: 'A'.repeat(300), excerpt: 'B'.repeat(300) },
      url,
    )
    expect(out.length).toBeLessThanOrEqual(280)
    expect(out.endsWith(url)).toBe(true)
    expect(out).toContain('…')
  })
})

describe('blogPostUrl', () => {
  it('builds the canonical heat-index URL', () => {
    expect(blogPostUrl('y-bridge')).toBe(
      `${process.env.NEXTAUTH_URL ?? 'https://www.josemadrid.net'}/heat-index/y-bridge`,
    )
  })
})

describe('CROSSPOST_PLATFORMS', () => {
  it('offers text-capable networks and excludes media-only ones', () => {
    expect(CROSSPOST_PLATFORMS).toEqual(['FACEBOOK', 'TWITTER', 'GOOGLE_MY_BUSINESS'])
    expect(CROSSPOST_PLATFORMS).not.toContain('INSTAGRAM')
    expect(CROSSPOST_PLATFORMS).not.toContain('TIKTOK')
  })
})

const samplePost = {
  id: 'p1',
  slug: 'y-bridge',
  title: 'The Y-Bridge Tasting',
  subtitle: null,
  content: 'A body long enough to matter.',
  tags: ['salsa', 'zanesville'],
}

describe('crosspostBlogPost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.blogPost.findUnique.mockResolvedValue(samplePost)
    prismaMock.socialMediaPost.upsert.mockResolvedValue({ id: 's1', publishedAt: null })
    prismaMock.socialMediaPost.update.mockResolvedValue({})
  })

  it('throws when the blog post does not exist', async () => {
    prismaMock.blogPost.findUnique.mockResolvedValueOnce(null)
    await expect(crosspostBlogPost('missing', ['a1'])).rejects.toThrow('Blog post not found')
  })

  it('returns no results and publishes nothing when no accounts are selected', async () => {
    const { results } = await crosspostBlogPost('p1', [])
    expect(results).toEqual([])
    expect(publishToAccountMock).not.toHaveBeenCalled()
    expect(prismaMock.socialMediaPost.upsert).not.toHaveBeenCalled()
  })

  it('skips ineligible platforms (e.g. Instagram) without publishing', async () => {
    prismaMock.socialAccount.findMany.mockResolvedValueOnce([
      { id: 'ig', platform: 'INSTAGRAM', accountName: 'insta' },
    ])
    const { results } = await crosspostBlogPost('p1', ['ig'])
    expect(results).toEqual([])
    expect(publishToAccountMock).not.toHaveBeenCalled()
    expect(prismaMock.socialMediaPost.upsert).not.toHaveBeenCalled()
  })

  it('publishes to eligible accounts and marks the post published on success', async () => {
    prismaMock.socialAccount.findMany.mockResolvedValueOnce([
      { id: 'a1', platform: 'FACEBOOK', accountName: 'josemadridsalsainc' },
    ])
    publishToAccountMock.mockResolvedValueOnce({
      success: true,
      externalUrl: 'https://facebook.com/1',
    })

    const { results } = await crosspostBlogPost('p1', ['a1', 'a1'])

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      platform: 'FACEBOOK',
      accountId: 'a1',
      accountName: 'josemadridsalsainc',
      success: true,
      externalUrl: 'https://facebook.com/1',
    })

    const upsertArg = prismaMock.socialMediaPost.upsert.mock.calls[0][0]
    expect(upsertArg.where).toEqual({ blogPostId: 'p1' })
    expect(upsertArg.create.platforms).toEqual(['FACEBOOK'])
    expect(upsertArg.create.linkUrl).toContain('/heat-index/y-bridge')
    expect(upsertArg.create.hashtags).toEqual(['salsa', 'zanesville'])

    expect(publishToAccountMock).toHaveBeenCalledWith('s1', 'a1')
    expect(prismaMock.socialMediaPost.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { status: 'PUBLISHED', publishedAt: expect.any(Date) },
    })
  })

  it('marks the post failed when every account fails', async () => {
    prismaMock.socialAccount.findMany.mockResolvedValueOnce([
      { id: 'a1', platform: 'FACEBOOK', accountName: 'fb' },
    ])
    publishToAccountMock.mockResolvedValueOnce({ success: false, error: 'token expired' })

    const { results } = await crosspostBlogPost('p1', ['a1'])

    expect(results[0]).toMatchObject({ success: false, error: 'token expired' })
    expect(prismaMock.socialMediaPost.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { status: 'FAILED', publishedAt: null },
    })
  })
})

describe('getBlogCrosspostStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns an empty status when the article was never cross-posted', async () => {
    prismaMock.socialMediaPost.findUnique.mockResolvedValueOnce(null)
    expect(await getBlogCrosspostStatus('p1')).toEqual({ socialPostId: null, publishes: [] })
  })

  it('maps each publish record with its account name', async () => {
    const now = new Date()
    prismaMock.socialMediaPost.findUnique.mockResolvedValueOnce({
      id: 's1',
      publishes: [
        {
          accountId: 'a1',
          account: { accountName: 'josemadridsalsainc' },
          platform: 'FACEBOOK',
          status: 'PUBLISHED',
          externalUrl: 'https://facebook.com/1',
          publishedAt: now,
          errorMessage: null,
        },
      ],
    })

    const status = await getBlogCrosspostStatus('p1')
    expect(status.socialPostId).toBe('s1')
    expect(status.publishes).toHaveLength(1)
    expect(status.publishes[0]).toEqual({
      accountId: 'a1',
      accountName: 'josemadridsalsainc',
      platform: 'FACEBOOK',
      status: 'PUBLISHED',
      externalUrl: 'https://facebook.com/1',
      publishedAt: now,
      error: null,
    })
  })
})
