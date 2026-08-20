import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isLive, matchesPath, getSitemapLandingPages } from '@/lib/cms/queries'
import prisma from '@/lib/prisma'

vi.mock('@/lib/prisma', () => ({
  default: { page: { findMany: vi.fn() } },
  prisma: { page: { findMany: vi.fn() } },
}))

const findMany = vi.mocked(prisma.page.findMany)

describe('isLive', () => {
  const hour = 60 * 60 * 1000
  const past = new Date(Date.now() - hour)
  const future = new Date(Date.now() + hour)

  it('shows published content with no schedule', () => {
    expect(isLive({ status: 'PUBLISHED' })).toBe(true)
  })

  it('hides drafts and archived content', () => {
    expect(isLive({ status: 'DRAFT' })).toBe(false)
    expect(isLive({ status: 'ARCHIVED' })).toBe(false)
  })

  it('holds scheduled content until its publish time', () => {
    expect(isLive({ status: 'SCHEDULED', publishedAt: future })).toBe(false)
    expect(isLive({ status: 'SCHEDULED', publishedAt: past })).toBe(true)
  })

  it('hides scheduled content with no publish time set', () => {
    expect(isLive({ status: 'SCHEDULED', publishedAt: null })).toBe(false)
  })

  it('respects the start of a scheduling window', () => {
    expect(isLive({ status: 'PUBLISHED', startsAt: future })).toBe(false)
    expect(isLive({ status: 'PUBLISHED', startsAt: past })).toBe(true)
  })

  it('respects the end of a scheduling window', () => {
    expect(isLive({ status: 'PUBLISHED', endsAt: past })).toBe(false)
    expect(isLive({ status: 'PUBLISHED', endsAt: future })).toBe(true)
  })

  it('requires both ends of the window to pass', () => {
    expect(isLive({ status: 'PUBLISHED', startsAt: past, endsAt: future })).toBe(true)
    expect(isLive({ status: 'PUBLISHED', startsAt: past, endsAt: past })).toBe(false)
  })
})

describe('matchesPath', () => {
  it('treats an empty target list as site-wide', () => {
    expect(matchesPath([], '/anything')).toBe(true)
    expect(matchesPath([], '/')).toBe(true)
  })

  it('matches an exact path', () => {
    expect(matchesPath(['/products'], '/products')).toBe(true)
  })

  it('matches descendants of a target path', () => {
    expect(matchesPath(['/products'], '/products/salsa-verde')).toBe(true)
  })

  it('does not match a path that merely shares a prefix', () => {
    expect(matchesPath(['/products'], '/products-archive')).toBe(false)
  })

  it('scopes a bare slash to the homepage only', () => {
    expect(matchesPath(['/'], '/')).toBe(true)
    expect(matchesPath(['/'], '/products')).toBe(false)
  })

  it('matches when any one target matches', () => {
    expect(matchesPath(['/fundraising', '/products'], '/products')).toBe(true)
    expect(matchesPath(['/fundraising', '/wholesale'], '/products')).toBe(false)
  })

  it('ignores blank entries', () => {
    expect(matchesPath(['  '], '/products')).toBe(false)
  })
})

describe('getSitemapLandingPages', () => {
  const hour = 60 * 60 * 1000
  const updatedAt = new Date('2026-08-01T00:00:00.000Z')

  beforeEach(() => {
    findMany.mockReset()
  })

  it('asks the database only for indexable landing pages', async () => {
    findMany.mockResolvedValue([])

    await getSitemapLandingPages()

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          kind: 'LANDING',
          status: { in: ['PUBLISHED', 'SCHEDULED'] },
          noIndex: false,
        },
      })
    )
  })

  it('returns the slug and last-modified date of a live page', async () => {
    findMany.mockResolvedValue([
      { slug: 'summer-sale', status: 'PUBLISHED', publishedAt: null, updatedAt },
    ] as never)

    await expect(getSitemapLandingPages()).resolves.toEqual([
      { slug: 'summer-sale', updatedAt },
    ])
  })

  it('withholds a scheduled page until its publish time', async () => {
    findMany.mockResolvedValue([
      {
        slug: 'not-yet',
        status: 'SCHEDULED',
        publishedAt: new Date(Date.now() + hour),
        updatedAt,
      },
      {
        slug: 'already-out',
        status: 'SCHEDULED',
        publishedAt: new Date(Date.now() - hour),
        updatedAt,
      },
    ] as never)

    const pages = await getSitemapLandingPages()

    expect(pages.map((page) => page.slug)).toEqual(['already-out'])
  })

  it('degrades to an empty list when the CMS tables are missing', async () => {
    findMany.mockRejectedValue(
      Object.assign(new Error('table does not exist'), { code: 'P2021' })
    )

    await expect(getSitemapLandingPages()).resolves.toEqual([])
  })
})
