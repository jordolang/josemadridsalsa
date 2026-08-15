import { describe, expect, it } from 'vitest'

import {
  buildAttribution,
  hasAttribution,
  parseAttributionCookie,
  referrerHost,
  serialiseAttribution,
  type AttributionFields,
} from '@/lib/analytics/attribution'

const fields = (over: Partial<AttributionFields> = {}): AttributionFields => ({
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmTerm: null,
  utmContent: null,
  referrer: null,
  landingPage: null,
  ...over,
})

describe('referrerHost', () => {
  it('returns the host of an external referrer', () => {
    expect(referrerHost('https://www.google.com/search?q=salsa', 'josemadrid.net')).toBe(
      'www.google.com'
    )
  })

  it('treats the site itself as no referrer', () => {
    expect(referrerHost('https://josemadrid.net/products', 'josemadrid.net')).toBeNull()
  })

  it('is null for empty or unparseable input', () => {
    expect(referrerHost('', 'josemadrid.net')).toBeNull()
    expect(referrerHost(null, 'josemadrid.net')).toBeNull()
    expect(referrerHost('not a url', 'josemadrid.net')).toBeNull()
  })
})

describe('buildAttribution', () => {
  it('reads utm params, the referrer host, and the landing path', () => {
    const result = buildAttribution({
      params: new URLSearchParams(
        'utm_source=facebook&utm_medium=cpc&utm_campaign=summer&utm_term=hot&utm_content=ad1'
      ),
      referrer: 'https://l.facebook.com/',
      landingPage: '/products/mango',
      selfHost: 'josemadrid.net',
    })
    expect(result).toEqual({
      utmSource: 'facebook',
      utmMedium: 'cpc',
      utmCampaign: 'summer',
      utmTerm: 'hot',
      utmContent: 'ad1',
      referrer: 'l.facebook.com',
      landingPage: '/products/mango',
    })
  })

  it('leaves missing params null and trims blanks', () => {
    const result = buildAttribution({
      params: new URLSearchParams('utm_source=%20%20&utm_campaign=spring'),
      referrer: null,
      landingPage: null,
      selfHost: 'josemadrid.net',
    })
    expect(result.utmSource).toBeNull() // whitespace-only → null
    expect(result.utmCampaign).toBe('spring')
    expect(result.utmMedium).toBeNull()
    expect(result.referrer).toBeNull()
    expect(result.landingPage).toBeNull()
  })
})

describe('hasAttribution', () => {
  it('is false only when every field is null', () => {
    expect(hasAttribution(fields())).toBe(false)
    expect(hasAttribution(fields({ referrer: 'google.com' }))).toBe(true)
    expect(hasAttribution(fields({ utmSource: 'x' }))).toBe(true)
  })
})

describe('serialise / parse round-trip', () => {
  it('serialises only the present keys and parses them back', () => {
    const original = fields({ utmSource: 'newsletter', utmCampaign: 'launch' })
    const cookie = serialiseAttribution(original)
    // Only non-null keys are stored, keeping the cookie small.
    expect(JSON.parse(cookie)).toEqual({ utmSource: 'newsletter', utmCampaign: 'launch' })

    const parsed = parseAttributionCookie(encodeURIComponent(cookie))
    expect(parsed).toEqual(original)
  })

  it('parses a URL-encoded cookie value', () => {
    const raw = encodeURIComponent(JSON.stringify({ utmSource: 'google', utmMedium: 'organic' }))
    expect(parseAttributionCookie(raw)).toEqual(
      fields({ utmSource: 'google', utmMedium: 'organic' })
    )
  })
})

describe('parseAttributionCookie — defensive', () => {
  it('returns null for absent, malformed, or empty cookies (never throws)', () => {
    expect(parseAttributionCookie(undefined)).toBeNull()
    expect(parseAttributionCookie('')).toBeNull()
    expect(parseAttributionCookie('not json')).toBeNull()
    expect(parseAttributionCookie(encodeURIComponent('{}'))).toBeNull()
    expect(parseAttributionCookie(encodeURIComponent(JSON.stringify({ utmSource: '   ' })))).toBeNull()
  })

  it('ignores unknown keys and keeps only known fields', () => {
    const raw = encodeURIComponent(
      JSON.stringify({ utmSource: 'x', evil: 'ignore-me', nested: { a: 1 } })
    )
    expect(parseAttributionCookie(raw)).toEqual(fields({ utmSource: 'x' }))
  })
})
