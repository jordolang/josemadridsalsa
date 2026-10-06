import { describe, expect, it, vi } from 'vitest'
import { resolveLegacyFundraisingPath } from '@/lib/fundraising-site/legacy-redirects'
import { groupSlug, withSlugs } from '@/lib/fundraising-site/groups'

vi.mock('server-only', () => ({}))

const products = ['original-mild-salsa', 'pumpkin']

describe('resolveLegacyFundraisingPath', () => {
  it('maps the old content pages', () => {
    expect(resolveLegacyFundraisingPath(['start-your-fundraiser'], products)).toBe('/start')
    expect(resolveLegacyFundraisingPath(['shop-1'], products)).toBe('/shop')
    expect(resolveLegacyFundraisingPath(['shipping-returns'], products)).toBe('/shipping')
    expect(resolveLegacyFundraisingPath(['cart.php'], products)).toBe('/cart')
  })

  it('moves product pages under /shop, hidden flavors included', () => {
    expect(resolveLegacyFundraisingPath(['original-mild-salsa'], products)).toBe('/shop/original-mild-salsa')
    expect(resolveLegacyFundraisingPath(['Pumpkin'], products)).toBe('/shop/pumpkin')
  })

  it('returns null for anything else', () => {
    expect(resolveLegacyFundraisingPath(['nothing-here'], products)).toBeNull()
    expect(resolveLegacyFundraisingPath(['blog', 'x', 'y'], products)).toBeNull()
  })
})

describe('group slugs', () => {
  it('builds readable slugs', () => {
    expect(groupSlug('4Star Horsemanship 4-H Spring 2026')).toBe('4star-horsemanship-4-h-spring-2026')
    expect(groupSlug('Chelsea Children’s Co-op & Friends')).toBe('chelsea-childrens-co-op-and-friends')
  })

  it('keeps slugs unique', () => {
    const slugs = withSlugs([
      { value: '0', label: 'Band Boosters' },
      { value: '1', label: 'Band  Boosters!' },
    ]).map((group) => group.slug)
    expect(slugs).toEqual(['band-boosters', 'band-boosters-2'])
  })
})
