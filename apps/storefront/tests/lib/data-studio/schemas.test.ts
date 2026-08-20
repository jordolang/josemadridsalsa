import { describe, it, expect } from 'vitest'

import { parseQuerySpec } from '@/lib/data-studio/schemas'

const valid = {
  specVersion: 1 as const,
  datasetId: 'ledger',
  measureIds: ['income'],
  filters: [],
  vizType: 'bar' as const,
}

const parse = (overrides: Record<string, unknown> = {}) => parseQuerySpec({ ...valid, ...overrides })

describe('data-studio schemas', () => {
  it('accepts a minimal well-formed spec', () => {
    const result = parse()
    expect(result.ok).toBe(true)
  })

  it('rejects an unknown dataset', () => {
    const result = parse({ datasetId: 'nope' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('Unknown dataset')
  })

  it('rejects a measure the dataset does not declare', () => {
    const result = parse({ measureIds: ['not-a-measure'] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('is not a measure')
  })

  it('rejects a dimension the dataset does not declare', () => {
    const result = parse({ dimensionId: 'invented' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('is not a dimension')
  })

  it('rejects an unsupported specVersion so a stale saved report fails legibly', () => {
    const result = parse({ specVersion: 2 })
    expect(result.ok).toBe(false)
  })

  it('requires at least one measure', () => {
    const result = parse({ measureIds: [] })
    expect(result.ok).toBe(false)
  })

  it('rejects a duplicated measure', () => {
    const result = parse({ measureIds: ['income', 'income'] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('twice')
  })

  describe('year-axis datasets', () => {
    it('rejects a month grain on a dataset that only records a year', () => {
      const result = parseQuerySpec({
        ...valid,
        datasetId: 'archived-fundraisers',
        measureIds: ['jars'],
        timeGrain: 'month',
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.message).toContain('only be grouped by year')
    })

    it('accepts the year grain', () => {
      const result = parseQuerySpec({
        ...valid,
        datasetId: 'archived-fundraisers',
        measureIds: ['jars'],
        timeGrain: 'year',
      })
      expect(result.ok).toBe(true)
    })

    it('rejects a dateRange on a dataset with no date column', () => {
      const result = parseQuerySpec({
        ...valid,
        datasetId: 'archived-fundraisers',
        measureIds: ['jars'],
        dateRange: { from: '2011-01-01', to: '2026-12-31' },
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.message).toContain('no date column')
    })
  })

  describe('date ranges', () => {
    it('accepts a valid range on a timestamp axis', () => {
      expect(parse({ dateRange: { from: '2025-01-01', to: '2025-12-31' } }).ok).toBe(true)
    })

    it('rejects a reversed range', () => {
      const result = parse({ dateRange: { from: '2025-12-31', to: '2025-01-01' } })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.message).toContain('after the end date')
    })

    it('rejects a date that is not real', () => {
      expect(parse({ dateRange: { from: '2025-02-30', to: '2025-12-31' } }).ok).toBe(false)
    })
  })

  describe('filters are an allowlist', () => {
    it('accepts a declared filter with a declared operator and a known value', () => {
      const result = parse({ filters: [{ field: 'category', op: 'eq', value: 'SHOW_SALES' }] })
      expect(result.ok).toBe(true)
    })

    it('rejects a field the dataset does not expose', () => {
      const result = parse({ filters: [{ field: 'secretColumn', op: 'eq', value: 'x' }] })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.message).toContain('cannot be filtered by')
    })

    it('rejects an operator the filter does not permit', () => {
      const result = parse({ filters: [{ field: 'direction', op: 'contains', value: 'INCOME' }] })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.message).toContain('does not support')
    })

    it('rejects a value outside a closed vocabulary', () => {
      const result = parse({ filters: [{ field: 'category', op: 'eq', value: 'DROP TABLE' }] })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.message).toContain('is not a valid')
    })

    it('rejects every member of an invalid "in" list', () => {
      const result = parse({ filters: [{ field: 'source', op: 'in', value: ['ORDER', 'bogus'] }] })
      expect(result.ok).toBe(false)
    })
  })

  describe('viz constraints', () => {
    it('allows one measure when splitting a series by a dimension', () => {
      expect(parse({ timeGrain: 'month', dimensionId: 'category', measureIds: ['income'] }).ok).toBe(true)
    })

    it('rejects several measures when splitting a series by a dimension', () => {
      const result = parse({ timeGrain: 'month', dimensionId: 'category', measureIds: ['income', 'expense'] })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.message).toContain('one measure')
    })

    it('rejects a multi-measure pie', () => {
      const result = parse({ vizType: 'pie', measureIds: ['income', 'expense'] })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.message).toContain('one measure')
    })
  })
})
