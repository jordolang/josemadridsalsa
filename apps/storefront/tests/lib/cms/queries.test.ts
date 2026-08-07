import { describe, expect, it } from 'vitest'
import { isLive, matchesPath } from '@/lib/cms/queries'

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
