import { describe, it, expect } from 'vitest'

import { normalizeBlobPrefix } from '@/lib/developer/blob-explorer'

describe('normalizeBlobPrefix', () => {
  it('returns an empty string for the root', () => {
    expect(normalizeBlobPrefix('')).toBe('')
    expect(normalizeBlobPrefix('/')).toBe('')
  })

  it('appends a trailing slash to directory prefixes', () => {
    expect(normalizeBlobPrefix('products')).toBe('products/')
    expect(normalizeBlobPrefix('products/images')).toBe('products/images/')
  })

  it('strips empty, dot, and parent segments', () => {
    expect(normalizeBlobPrefix('//a//b/')).toBe('a/b/')
    expect(normalizeBlobPrefix('a/../b')).toBe('a/b/')
    expect(normalizeBlobPrefix('./a/.')).toBe('a/')
  })
})
