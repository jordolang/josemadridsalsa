/**
 * Admin archive list helper tests
 */

import { describe, it, expect } from 'vitest'
import {
  buildQuery,
  buildSearchFilter,
  DEFAULT_PAGE_SIZE,
  formatBytes,
  resolvePage,
  resolvePageSize,
  resolveSortColumn,
  resolveSortDirection,
  totalPages,
} from '@/lib/archive/archive-list'

describe('resolvePage', () => {
  it('defaults to 1', () => {
    expect(resolvePage(undefined)).toBe(1)
    expect(resolvePage('')).toBe(1)
    expect(resolvePage('nonsense')).toBe(1)
  })

  it('rejects zero and negatives', () => {
    expect(resolvePage('0')).toBe(1)
    expect(resolvePage('-4')).toBe(1)
  })

  it('accepts a positive page', () => {
    expect(resolvePage('7')).toBe(7)
  })
})

describe('resolvePageSize', () => {
  it('falls back for anything not offered', () => {
    expect(resolvePageSize(undefined)).toBe(DEFAULT_PAGE_SIZE)
    expect(resolvePageSize('10000')).toBe(DEFAULT_PAGE_SIZE)
    expect(resolvePageSize('37')).toBe(DEFAULT_PAGE_SIZE)
  })

  it('accepts an offered size', () => {
    expect(resolvePageSize('25')).toBe(25)
    expect(resolvePageSize('250')).toBe(250)
  })
})

describe('resolveSortDirection', () => {
  it('only desc flips the direction', () => {
    expect(resolveSortDirection('desc')).toBe('desc')
    expect(resolveSortDirection('asc')).toBe('asc')
    expect(resolveSortDirection(undefined)).toBe('asc')
    expect(resolveSortDirection('DESC')).toBe('asc')
  })
})

describe('resolveSortColumn', () => {
  const allowed = ['path', 'category', 'year'] as const

  it('accepts an allowed column', () => {
    expect(resolveSortColumn('category', allowed, 'path')).toBe('category')
  })

  it('rejects anything else, so a crafted URL cannot pick a column', () => {
    expect(resolveSortColumn('extractedText', allowed, 'path')).toBe('path')
    expect(resolveSortColumn('id; drop table', allowed, 'path')).toBe('path')
    expect(resolveSortColumn(undefined, allowed, 'path')).toBe('path')
  })
})

describe('totalPages', () => {
  it('rounds up', () => {
    expect(totalPages(101, 50)).toBe(3)
    expect(totalPages(100, 50)).toBe(2)
  })

  it('is never less than 1', () => {
    expect(totalPages(0, 50)).toBe(1)
  })
})

describe('buildQuery', () => {
  it('preserves existing params and applies changes', () => {
    expect(buildQuery({ search: 'salsa', page: '2' }, { page: 3 })).toBe(
      '?search=salsa&page=3'
    )
  })

  it('drops empty values', () => {
    expect(buildQuery({ search: '', category: undefined }, { page: 1 })).toBe('?page=1')
  })

  it('returns an empty string when nothing survives', () => {
    expect(buildQuery({}, {})).toBe('')
  })

  it('encodes values', () => {
    expect(buildQuery({}, { search: 'a b&c' })).toBe('?search=a+b%26c')
  })
})

describe('formatBytes', () => {
  it('renders a dash for unknown', () => {
    expect(formatBytes(null)).toBe('—')
    expect(formatBytes(undefined)).toBe('—')
  })

  it('renders bytes, KB, MB', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})

describe('buildSearchFilter', () => {
  it('returns undefined without a term', () => {
    expect(buildSearchFilter(undefined, ['path'])).toBeUndefined()
    expect(buildSearchFilter('   ', ['path'])).toBeUndefined()
  })

  it('builds a case-insensitive OR across the fields', () => {
    expect(buildSearchFilter('tax', ['path', 'filename'])).toEqual({
      OR: [
        { path: { contains: 'tax', mode: 'insensitive' } },
        { filename: { contains: 'tax', mode: 'insensitive' } },
      ],
    })
  })

  it('trims the term', () => {
    const filter = buildSearchFilter('  tax  ', ['path'])
    expect(filter?.OR[0]).toEqual({ path: { contains: 'tax', mode: 'insensitive' } })
  })
})
