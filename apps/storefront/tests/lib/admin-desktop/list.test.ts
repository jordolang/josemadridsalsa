import { describe, it, expect } from 'vitest'
import {
  filterRows,
  listSearch,
  MAX_LIST_LIMIT,
  parseListQuery,
  ROW_LIMIT,
} from '@/lib/admin-desktop/list'
import type { Row } from '@/lib/admin-desktop/types'

function row(id: string, search: string, buckets = [0]): Row {
  return { id, search, buckets, cells: [], inspector: { title: id, groups: [] } }
}

describe('parseListQuery', () => {
  it('defaults to the first window with no search', () => {
    expect(parseListQuery(new URLSearchParams())).toEqual({ q: '', limit: ROW_LIMIT })
  })

  it('trims the search and keeps a sane limit', () => {
    expect(parseListQuery(new URLSearchParams('q=%20vera%20&limit=500'))).toEqual({ q: 'vera', limit: 500 })
  })

  it('clamps a large window and falls back from a junk one', () => {
    expect(parseListQuery(new URLSearchParams(`limit=${MAX_LIST_LIMIT + 1}`)).limit).toBe(MAX_LIST_LIMIT)
    expect(parseListQuery(new URLSearchParams('limit=abc')).limit).toBe(ROW_LIMIT)
    expect(parseListQuery(new URLSearchParams('limit=0')).limit).toBe(ROW_LIMIT)
    // Cut, not refused: a refused search never matched what the shell sent, so it asked again forever.
    expect(parseListQuery(new URLSearchParams(`q=${'x'.repeat(250)}`)).q).toBe('x'.repeat(200))
  })

  it('lets the export ask for more than a window', () => {
    expect(parseListQuery(new URLSearchParams('limit=20000'), 25000).limit).toBe(20000)
  })
})

describe('listSearch', () => {
  it('leaves defaults out of the URL', () => {
    expect(listSearch({ q: ' ', limit: ROW_LIMIT })).toBe('')
    expect(listSearch({ q: 'vera', limit: 500 })).toBe('q=vera&limit=500')
  })
})

describe('filterRows', () => {
  const rows = [row('a', 'Vera Smith Zanesville', [0, 1]), row('b', 'Karen Wolfe Granville', [0, 2])]

  it('applies the chip and then the filter box', () => {
    expect(filterRows(rows, { query: '', filter: 2 }).map((r) => r.id)).toEqual(['b'])
    expect(filterRows(rows, { query: 'vera', filter: 0 }).map((r) => r.id)).toEqual(['a'])
    expect(filterRows(rows, { query: 'vera', filter: 2 })).toEqual([])
  })

  it('trusts the server for the text it already searched', () => {
    // The database matched "karen@" on an email the row's search text lacks.
    const hits = [row('c', 'Karen Wolfe')]
    expect(filterRows(hits, { query: 'karen@', filter: 0, serverQuery: 'karen@' })).toHaveLength(1)
    expect(filterRows(hits, { query: 'karen@', filter: 0, serverQuery: 'kar' })).toHaveLength(0)
  })
})
