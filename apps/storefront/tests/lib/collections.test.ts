import { describe, expect, it } from 'vitest'

import { collectionProductRows, slugify, slugSchema } from '@/lib/collections'

describe('slugify', () => {
  it('lowercases, trims, and hyphenates', () => {
    expect(slugify('  Gift Sets  ')).toBe('gift-sets')
    expect(slugify('Staff Picks 2026!')).toBe('staff-picks-2026')
    expect(slugify('Mild & Medium')).toBe('mild-medium')
  })

  it('collapses runs of separators and strips leading/trailing ones', () => {
    expect(slugify('--Hot---Sauces--')).toBe('hot-sauces')
    expect(slugify('a   b')).toBe('a-b')
  })
})

describe('collectionProductRows', () => {
  it('assigns sortOrder by position', () => {
    expect(collectionProductRows(['a', 'b', 'c'])).toEqual([
      { productId: 'a', sortOrder: 0 },
      { productId: 'b', sortOrder: 1 },
      { productId: 'c', sortOrder: 2 },
    ])
  })

  it('drops duplicates keeping the first occurrence, and re-numbers densely', () => {
    expect(collectionProductRows(['a', 'b', 'a', 'c'])).toEqual([
      { productId: 'a', sortOrder: 0 },
      { productId: 'b', sortOrder: 1 },
      { productId: 'c', sortOrder: 2 },
    ])
  })

  it('ignores blank ids', () => {
    expect(collectionProductRows(['a', '  ', '', 'b'])).toEqual([
      { productId: 'a', sortOrder: 0 },
      { productId: 'b', sortOrder: 1 },
    ])
  })

  it('is empty for no ids', () => {
    expect(collectionProductRows([])).toEqual([])
  })
})

describe('slugSchema', () => {
  it('accepts a single URL-safe segment', () => {
    expect(slugSchema.safeParse('gift-sets').success).toBe(true)
    expect(slugSchema.safeParse('staff-picks-2026').success).toBe(true)
    expect(slugSchema.safeParse('a').success).toBe(true)
    // every slugify output is valid by construction
    expect(slugSchema.safeParse(slugify('Mild & Medium!')).success).toBe(true)
  })

  it('rejects values that break /collections/[slug] as one segment', () => {
    expect(slugSchema.safeParse('gift/sets').success).toBe(false) // extra path segment
    expect(slugSchema.safeParse('gift sets').success).toBe(false) // space
    expect(slugSchema.safeParse('gift?sets').success).toBe(false) // query char
    expect(slugSchema.safeParse('Gift-Sets').success).toBe(false) // uppercase
    expect(slugSchema.safeParse('-gift').success).toBe(false) // leading hyphen
    expect(slugSchema.safeParse('gift--sets').success).toBe(false) // double hyphen
    expect(slugSchema.safeParse('').success).toBe(false) // empty
  })
})
