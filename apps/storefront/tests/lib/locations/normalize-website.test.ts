import { describe, expect, it } from 'vitest'
import { normalizeWebsiteUrl } from '@/lib/locations/shared'

describe('normalizeWebsiteUrl', () => {
  it('trims the stray spaces that made store links relative', () => {
    expect(normalizeWebsiteUrl(' https://www.kirwenssupermarket.com/   ')).toBe('https://www.kirwenssupermarket.com/')
  })

  it('adds a scheme when one is missing', () => {
    expect(normalizeWebsiteUrl('heinis.com')).toBe('https://heinis.com/')
  })

  it('returns null for empty or unusable values', () => {
    expect(normalizeWebsiteUrl(null)).toBeNull()
    expect(normalizeWebsiteUrl('   ')).toBeNull()
    expect(normalizeWebsiteUrl('n/a')).toBeNull()
  })
})
