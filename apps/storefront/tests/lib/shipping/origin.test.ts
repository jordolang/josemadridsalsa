import { describe, expect, it } from 'vitest'

import { describeMissingOrigin, resolveOriginFrom } from '@/lib/shipping/origin'

/**
 * The warehouse address had three sources of truth under two environment variable prefixes, and
 * the rate-quoting one defaulted to `123 Main St, San Francisco, CA 94111`. These pin the rule
 * that replaced it: a complete address or nothing, never a plausible-looking placeholder.
 */

const complete = {
  name: 'Jose Madrid Salsa',
  street: '321 Market St',
  city: 'Zanesville',
  state: 'OH',
  zipCode: '43701',
  country: 'US',
}

describe('resolveOriginFrom', () => {
  it('shapes a complete address', () => {
    const result = resolveOriginFrom(complete)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.origin).toMatchObject({
      street1: '321 Market St',
      city: 'Zanesville',
      state: 'OH',
      zip: '43701',
      country: 'US',
    })
  })

  it('refuses an incomplete address instead of inventing one', () => {
    // The bug this replaced: a missing street became "123 Main St" and every quote came from
    // San Francisco, looking entirely normal.
    const result = resolveOriginFrom({ ...complete, street: undefined })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.missing).toEqual(['street'])
  })

  it('names every missing part, so one round trip fixes the config', () => {
    const result = resolveOriginFrom({ name: 'X' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.missing).toEqual(['street', 'city', 'state', 'postal code'])
  })

  it('treats whitespace as absent', () => {
    const result = resolveOriginFrom({ ...complete, city: '   ' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.missing).toEqual(['city'])
  })

  it('defaults only the two fields that are safe to default', () => {
    // A name and a country can be assumed; a street cannot.
    const result = resolveOriginFrom({ ...complete, name: null, country: null })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.origin.name).toBe('Jose Madrid Salsa')
    expect(result.origin.country).toBe('US')
  })
})

describe('describeMissingOrigin', () => {
  it('tells staff what is missing and where to set it', () => {
    const message = describeMissingOrigin(['street', 'city'])
    expect(message).toContain('street, city')
    expect(message).toContain('Settings')
  })
})
