// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import {
  firstDirection,
  nextSort,
  readTableSorts,
  sortRows,
  sortValue,
  withTableSort,
  writeTableSorts,
} from '@/lib/admin-desktop/sort'
import type { Cell, Column, Row } from '@/lib/admin-desktop/types'

const columns: Column[] = [
  { label: 'Fundraiser', width: '1fr' },
  { label: 'Runs', width: '1fr' },
  { label: 'Sales', width: '96px', right: true },
]

function row(id: string, cells: Cell[]): Row {
  return {
    id,
    cells,
    search: id,
    buckets: [0],
    inspector: { title: id, groups: [] },
  }
}

// Loader order is not date order: live campaigns come first.
const rows = [
  row('spring', [
    { text: 'Spring Band' },
    { text: 'Mar 1 – Apr 1', sort: Date.UTC(2026, 2, 1) },
    { text: '$1,240.00' },
  ]),
  row('old', [{ text: 'archery club' }, { text: 'Nov 3 – Dec 1', sort: Date.UTC(2024, 10, 3) }, { text: '—' }]),
  row('fall', [{ text: 'Fall Choir' }, { text: 'Sep 9 – Oct 30', sort: Date.UTC(2026, 8, 9) }, { text: '$310.50' }]),
  row('blank', [{ text: 'Zeta' }, { text: '— – —' }, { text: '-$5.00' }]),
]

const ids = (list: Row[]) => list.map((entry) => entry.id)

describe('sortValue', () => {
  it('reads money, counts and percents as numbers', () => {
    expect(sortValue({ text: '$1,240.00' })).toBe(1240)
    expect(sortValue({ text: '-$5.00' })).toBe(-5)
    expect(sortValue({ text: '42%' })).toBe(42)
    expect(sortValue({ text: '1,204' })).toBe(1204)
    expect(sortValue({ text: '12m' })).toBe(12)
  })

  it('treats blanks as nothing and leaves ids and phones as text', () => {
    expect(sortValue({ text: '—' })).toBeNull()
    expect(sortValue({ text: 'Never' })).toBeNull()
    expect(sortValue({ text: '740-555-1234' })).toBe('740-555-1234')
    expect(sortValue({ text: '192.168.1.1' })).toBe('192.168.1.1')
  })

  it('prefers the loader’s sort key over the text', () => {
    expect(sortValue({ text: 'Oct 21', sort: 5 })).toBe(5)
  })
})

describe('sortRows', () => {
  it('sorts the Runs column newest first by the date, not the text', () => {
    const sorted = sortRows(rows, columns, { key: 'Runs', direction: 'desc' })
    expect(ids(sorted)).toEqual(['fall', 'spring', 'old', 'blank'])
  })

  it('keeps blanks last in both directions', () => {
    expect(ids(sortRows(rows, columns, { key: 'Runs', direction: 'asc' }))).toEqual(['old', 'spring', 'fall', 'blank'])
    expect(ids(sortRows(rows, columns, { key: 'Sales', direction: 'asc' }))).toEqual(['blank', 'fall', 'spring', 'old'])
  })

  it('sorts text without regard to case', () => {
    expect(ids(sortRows(rows, columns, { key: 'Fundraiser', direction: 'asc' }))).toEqual([
      'old',
      'fall',
      'spring',
      'blank',
    ])
  })

  it('leaves the loader’s order alone with no sort or an unknown column', () => {
    expect(sortRows(rows, columns, undefined)).toBe(rows)
    expect(sortRows(rows, columns, { key: 'Gone', direction: 'asc' })).toBe(rows)
  })
})

describe('header clicks', () => {
  it('starts dates and numbers newest or biggest first, text A to Z', () => {
    expect(firstDirection(rows, 1)).toBe('desc')
    expect(firstDirection(rows, 2)).toBe('desc')
    expect(firstDirection(rows, 0)).toBe('asc')
  })

  it('gives the same first direction whatever order the rows are in', () => {
    const mixed = [row('a', [{ text: 'n/a' }]), row('b', [{ text: '$5.00' }])]
    expect(firstDirection(mixed, 0)).toBe('desc')
    expect(firstDirection([...mixed].reverse(), 0)).toBe('desc')
  })

  it('cycles first way, flipped, then off', () => {
    const first = nextSort(undefined, 'Runs', 'desc')
    expect(first).toEqual({ key: 'Runs', direction: 'desc' })
    const second = nextSort(first, 'Runs', 'desc')
    expect(second).toEqual({ key: 'Runs', direction: 'asc' })
    expect(nextSort(second, 'Runs', 'desc')).toBeUndefined()
    expect(nextSort(second, 'Sales', 'desc')).toEqual({
      key: 'Sales',
      direction: 'desc',
    })
  })
})

describe('remembered sorts', () => {
  beforeEach(() => window.localStorage.clear())

  it('round-trips through storage and drops junk', () => {
    writeTableSorts(withTableSort({}, 'fundraisers', { key: 'Runs', direction: 'desc' }))
    expect(readTableSorts()).toEqual({
      fundraisers: { key: 'Runs', direction: 'desc' },
    })

    window.localStorage.setItem(
      'jms-desktop-sorts',
      JSON.stringify({ a: { key: 1 }, b: { key: 'x', direction: 'up' } }),
    )
    expect(readTableSorts()).toEqual({})
    window.localStorage.setItem('jms-desktop-sorts', '{not json')
    expect(readTableSorts()).toEqual({})
  })

  it('clears one page without touching the others', () => {
    const sorts = {
      a: { key: 'x', direction: 'asc' as const },
      b: { key: 'y', direction: 'desc' as const },
    }
    expect(withTableSort(sorts, 'a', undefined)).toEqual({ b: sorts.b })
  })
})
