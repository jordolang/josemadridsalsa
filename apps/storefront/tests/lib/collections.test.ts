import { describe, expect, it } from 'vitest'

import { collectionProductRows, slugify } from '@/lib/collections'

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
