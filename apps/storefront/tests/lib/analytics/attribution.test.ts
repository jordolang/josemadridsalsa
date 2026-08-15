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

  it('truncates an over-long value by code point without splitting a surrogate pair', () => {
    // 300 emoji (each a surrogate pair) — a naive slice(0, 256) would cut one in half and leave a
    // lone surrogate. Code-point truncation keeps every kept character whole.
    const long = '😀'.repeat(300)
    const result = buildAttribution({
      params: new URLSearchParams(`utm_source=${encodeURIComponent(long)}`),
      referrer: null,
      landingPage: null,
      selfHost: 'josemadrid.net',
    })
    expect(result.utmSource).not.toBeNull()
    // 256 whole code points, no unpaired surrogate → round-trips through JSON/UTF-8 cleanly.
    expect([...(result.utmSource as string)]).toHaveLength(256)
    expect(result.utmSource).toBe('😀'.repeat(256))
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
  it('requires a real marketing signal (utm or external referrer)', () => {
    expect(hasAttribution(fields())).toBe(false)
    expect(hasAttribution(fields({ referrer: 'google.com' }))).toBe(true)
    expect(hasAttribution(fields({ utmSource: 'x' }))).toBe(true)
  })

  it('does not count landingPage as a signal', () => {
    // A direct visit still has a landing path; if that counted, its cookie would lock out a later
    // campaign click as the first touch.
    expect(hasAttribution(fields({ landingPage: '/products' }))).toBe(false)
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

  it('parses an already-decoded value (as Next RequestCookies delivers it)', () => {
    // No URL-encoding: JSON.parse succeeds directly, so the value is never decoded a second time.
    const raw = JSON.stringify({ utmSource: 'newsletter' })
    expect(parseAttributionCookie(raw)).toEqual(fields({ utmSource: 'newsletter' }))
  })

  it('does not double-decode a value containing a literal percent sign', () => {
    // "50%off" would break a second decodeURIComponent; the parser must read it as-is.
    const raw = JSON.stringify({ utmCampaign: '50%off' })
    expect(parseAttributionCookie(raw)).toEqual(fields({ utmCampaign: '50%off' }))
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
