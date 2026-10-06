import { describe, expect, it } from 'vitest'
import { MAX_SEO_KEYWORDS, normalizeSeoKeywords } from '@/lib/fundraising/seo-keywords'

describe('normalizeSeoKeywords', () => {
  it('trims, collapses spaces and drops blanks and case-insensitive repeats', () => {
    expect(normalizeSeoKeywords(['  salsa ', 'Salsa', '', 'band   fundraiser', 'SALSA'])).toEqual(['salsa', 'band fundraiser'])
  })

  it('caps the count and each keyword’s length', () => {
    const many = Array.from({ length: 40 }, (_, i) => `keyword ${i}`)
    expect(normalizeSeoKeywords(many)).toHaveLength(MAX_SEO_KEYWORDS)
    expect(normalizeSeoKeywords(['x'.repeat(200)])[0]).toHaveLength(60)
  })

  it('treats missing keywords as none', () => {
    expect(normalizeSeoKeywords(null)).toEqual([])
  })
})
