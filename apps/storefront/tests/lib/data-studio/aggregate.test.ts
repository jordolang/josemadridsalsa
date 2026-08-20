import { describe, it, expect } from 'vitest'

import { aggregate, resolveMode, type SourceRow } from '@/lib/data-studio/aggregate'
import type { DatasetDef, QuerySpec } from '@/lib/data-studio/types'

/**
 * A stand-in dataset shaped like the real ones: one money measure whose nulls mean *unknown*
 * (mirroring `Payment.processorFee` and `OrderItem.unitCost`), one plain count, and one enum
 * dimension with a member that deliberately has no rows.
 */
const dataset: DatasetDef = {
  id: 'test',
  label: 'Test dataset',
  description: 'fixture',
  domain: 'financials',
  basis: 'ledger',
  readPermission: 'financials:read',
  exportPermission: 'financials:export',
  timeAxis: { kind: 'timestamp', field: 'date', label: 'Date', grains: ['month', 'year'] },
  measures: [
    {
      id: 'amount',
      label: 'Amount',
      unit: 'cents',
      aggregation: 'sum',
      fields: ['amountCents'],
      nullMeansUnknown: true,
      read: (row) => (typeof row.amountCents === 'number' ? row.amountCents : null),
    },
    { id: 'entries', label: 'Entries', unit: 'count', aggregation: 'count', fields: [], read: () => 1 },
    {
      id: 'avgAmount',
      label: 'Average amount',
      unit: 'cents',
      aggregation: 'avg',
      fields: ['amountCents'],
      nullMeansUnknown: true,
      read: (row) => (typeof row.amountCents === 'number' ? row.amountCents : null),
    },
  ],
  dimensions: [
    {
      id: 'category',
      label: 'Category',
      field: 'category',
      values: ['SHOW_SALES', 'PRODUCT_SALES', 'COGS'],
      labels: { SHOW_SALES: 'Show sales', PRODUCT_SALES: 'Product sales', COGS: 'Cost of goods' },
      unknownLabel: 'Uncategorised',
    },
  ],
  filters: [],
  rowCap: 50_000,
}

const spec = (overrides: Partial<QuerySpec> = {}): QuerySpec => ({
  specVersion: 1,
  datasetId: 'test',
  measureIds: ['amount'],
  filters: [],
  vizType: 'bar',
  ...overrides,
})

const run = (rows: SourceRow[], overrides: Partial<QuerySpec> = {}, extra: Partial<Parameters<typeof aggregate>[0]> = {}) =>
  aggregate({
    dataset,
    spec: spec(overrides),
    rows,
    truncated: false,
    timezone: 'America/New_York',
    generatedAt: '2026-08-19T00:00:00.000Z',
    ...extra,
  })

describe('data-studio aggregate', () => {
  describe('resolveMode', () => {
    it('picks series when a grain is set, breakdown for a bare dimension', () => {
      expect(resolveMode(spec({ timeGrain: 'month' }))).toBe('series')
      expect(resolveMode(spec({ dimensionId: 'category' }))).toBe('breakdown')
      expect(resolveMode(spec({ vizType: 'kpi' }))).toBe('kpi')
      expect(resolveMode(spec({ vizType: 'table' }))).toBe('detail')
    })
  })

  describe('unknown values are never coerced to zero', () => {
    // The defect this module exists to prevent, stated as a test: 10 rows, 3 with nothing recorded.
    const rows: SourceRow[] = [
      ...Array.from({ length: 7 }, (_, i) => ({ id: `k${i}`, amountCents: 100, category: 'SHOW_SALES' })),
      { id: 'u1', amountCents: null, category: 'SHOW_SALES' },
      { id: 'u2', amountCents: null, category: 'SHOW_SALES' },
      { id: 'u3', amountCents: undefined, category: 'SHOW_SALES' },
    ]

    it('sums only what was recorded and reports the rest as unknown', () => {
      const result = run(rows, { vizType: 'kpi' })
      expect(result.totals.amount).toBe(700)
      expect(result.meta.unknownCounts.amount).toBe(3)
      expect(result.meta.rowsScanned).toBe(10)
    })

    it('averages over contributing rows only, not over all rows', () => {
      const result = run(rows, { measureIds: ['avgAmount'], vizType: 'kpi' })
      // 700 / 7, not 700 / 10 — a missing figure must not drag the mean down.
      expect(result.totals.avgAmount).toBe(100)
    })

    it('counts every row, because a count of rows is knowable even when a value is not', () => {
      const result = run(rows, { measureIds: ['entries'], vizType: 'kpi' })
      expect(result.totals.entries).toBe(10)
      expect(result.meta.unknownCounts.entries).toBe(0)
    })

    it('reports null, not zero, for a group where nothing at all was recorded', () => {
      const result = run(
        [{ id: 'a', amountCents: null, category: 'COGS' }],
        { dimensionId: 'category' }
      )
      const cogs = result.rows.find((r) => r.key === 'COGS')
      expect(cogs?.cells.amount).toBeNull()
    })
  })

  describe('truncation withholds totals rather than reporting a partial sum as final', () => {
    it('nulls every total when the scan hit the row cap', () => {
      const result = run([{ id: 'a', amountCents: 500, category: 'SHOW_SALES' }], { vizType: 'kpi' }, { truncated: true })
      expect(result.totals.amount).toBeNull()
      expect(result.meta.truncated).toBe(true)
    })
  })

  describe('breakdown keeps empty members', () => {
    it('emits a zero row for an enum member with no data', () => {
      const result = run([{ id: 'a', amountCents: 250, category: 'SHOW_SALES' }], { dimensionId: 'category' })
      const keys = result.rows.map((r) => r.key)
      expect(keys).toContain('SHOW_SALES')
      expect(keys).toContain('PRODUCT_SALES')
      expect(keys).toContain('COGS')
      // Present, and zero rather than absent — an absent bar misrepresents the category set.
      expect(result.rows.find((r) => r.key === 'PRODUCT_SALES')?.cells.amount).toBeNull()
    })

    it('labels a null dimension value instead of dropping the row', () => {
      const result = run([{ id: 'a', amountCents: 100, category: null }], { dimensionId: 'category' })
      const unknown = result.rows.find((r) => r.key === 'unknown')
      expect(unknown?.cells.category).toBe('Uncategorised')
      expect(unknown?.cells.amount).toBe(100)
    })

    it('uses the display label for a known member', () => {
      const result = run([{ id: 'a', amountCents: 100, category: 'SHOW_SALES' }], { dimensionId: 'category' })
      expect(result.rows.find((r) => r.key === 'SHOW_SALES')?.cells.category).toBe('Show sales')
    })

    it('sorts by the first measure descending and parks blanks at the bottom', () => {
      const result = run(
        [
          { id: 'a', amountCents: 100, category: 'SHOW_SALES' },
          { id: 'b', amountCents: 900, category: 'PRODUCT_SALES' },
        ],
        { dimensionId: 'category' }
      )
      expect(result.rows.map((r) => r.key)).toEqual(['PRODUCT_SALES', 'SHOW_SALES', 'COGS'])
    })
  })

  describe('series emits every bucket in the window', () => {
    it('fills gap months with zeros rather than joining across them', () => {
      const result = run(
        [
          { id: 'a', amountCents: 100, date: new Date('2026-01-15T17:00:00.000Z'), category: 'SHOW_SALES' },
          { id: 'b', amountCents: 300, date: new Date('2026-04-15T17:00:00.000Z'), category: 'SHOW_SALES' },
        ],
        { timeGrain: 'month' },
        { window: { from: { year: 2026, month: 1, day: 1 }, to: { year: 2026, month: 4, day: 30 } } }
      )
      expect(result.rows.map((r) => r.cells.__time)).toEqual(['Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026'])
      expect(result.rows[0].cells.amount).toBe(100)
      expect(result.rows[1].cells.amount).toBeNull()
      expect(result.rows[3].cells.amount).toBe(300)
    })

    it('puts a row with no date in an unknown bucket, sorted last', () => {
      const result = run(
        [
          { id: 'a', amountCents: 100, date: new Date('2026-01-15T17:00:00.000Z'), category: 'SHOW_SALES' },
          { id: 'b', amountCents: 50, date: null, category: 'SHOW_SALES' },
        ],
        { timeGrain: 'month' }
      )
      expect(result.rows.at(-1)?.key).toBe('unknown')
      expect(result.rows.at(-1)?.cells.amount).toBe(50)
    })

    it('turns each dimension member into its own series column', () => {
      const result = run(
        [
          { id: 'a', amountCents: 100, date: new Date('2026-01-15T17:00:00.000Z'), category: 'SHOW_SALES' },
          { id: 'b', amountCents: 400, date: new Date('2026-01-20T17:00:00.000Z'), category: 'PRODUCT_SALES' },
        ],
        { timeGrain: 'month', dimensionId: 'category' }
      )
      const ids = result.columns.map((c) => c.id)
      expect(ids[0]).toBe('__time')
      expect(ids).toContain('SHOW_SALES')
      expect(ids).toContain('PRODUCT_SALES')
      expect(result.rows[0].cells.SHOW_SALES).toBe(100)
      expect(result.rows[0].cells.PRODUCT_SALES).toBe(400)
    })

    it('buckets a year axis on the integer year column', () => {
      const yearDataset: DatasetDef = {
        ...dataset,
        timeAxis: { kind: 'year', field: 'year', label: 'Year' },
      }
      const result = aggregate({
        dataset: yearDataset,
        spec: spec({ timeGrain: 'year' }),
        rows: [
          { id: 'a', amountCents: 100, year: 2011 },
          { id: 'b', amountCents: 200, year: 2013 },
          { id: 'c', amountCents: 50, year: null },
        ],
        truncated: false,
        yearWindow: { from: 2011, to: 2013 },
        timezone: 'America/New_York',
        generatedAt: '2026-08-19T00:00:00.000Z',
      })
      expect(result.rows.map((r) => r.key)).toEqual(['2011', '2012', '2013', 'unknown'])
      expect(result.rows[1].cells.amount).toBeNull()
      expect(result.rows[2].cells.amount).toBe(200)
    })
  })

  describe('detail mode', () => {
    it('carries a sourceId per row so a cell can be edited at source', () => {
      const result = run(
        [{ id: 'ledger-1', amountCents: 100, category: 'SHOW_SALES' }],
        { vizType: 'table' }
      )
      expect(result.rows[0].sourceId).toBe('ledger-1')
      expect(result.rows[0].cells.amount).toBe(100)
    })

    it('does not invent a sourceId when the row has no id', () => {
      const result = run([{ amountCents: 100 }], { vizType: 'table' })
      expect(result.rows[0].sourceId).toBeUndefined()
    })
  })

  describe('metadata', () => {
    it('reports the basis and timezone so a reader knows which book and which clock', () => {
      const result = run([{ id: 'a', amountCents: 1, category: 'COGS' }], { vizType: 'kpi' })
      expect(result.meta.basis).toBe('ledger')
      expect(result.meta.timezone).toBe('America/New_York')
      expect(result.meta.datasetLabel).toBe('Test dataset')
    })
  })
})
