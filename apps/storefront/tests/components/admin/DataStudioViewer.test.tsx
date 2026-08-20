import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

// recharts' ResponsiveContainer measures its parent; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

import { ReportViewer } from '@/app/admin/data/_components/ReportViewer'
import type { ReportResult } from '@/lib/data-studio/types'

function result(overrides: Partial<ReportResult> = {}): ReportResult {
  return {
    columns: [
      { id: 'category', label: 'Category', kind: 'dimension' },
      { id: 'income', label: 'Income', kind: 'measure', unit: 'cents' },
    ],
    rows: [
      { key: 'SHOW_SALES', cells: { category: 'Show sales', income: 48_126_800 } },
      { key: 'PRODUCT_SALES', cells: { category: 'Product sales', income: 2_100 } },
      { key: 'COGS', cells: { category: 'Cost of goods', income: null } },
    ],
    totals: { income: 48_128_900 },
    meta: {
      datasetId: 'ledger',
      datasetLabel: 'Bookkeeping ledger',
      basis: 'ledger',
      rowsScanned: 272,
      truncated: false,
      timezone: 'America/New_York',
      unknownCounts: { income: 0 },
      generatedAt: '2026-08-19T00:00:00.000Z',
    },
    ...overrides,
  }
}

describe('ReportViewer', () => {
  describe('table view', () => {
    it('formats money from cents and shows a total', () => {
      render(<ReportViewer result={result()} vizType="table" />)
      expect(screen.getByText('$481,268.00')).toBeInTheDocument()
      expect(screen.getByText('$21.00')).toBeInTheDocument()
      expect(screen.getByText('$481,289.00')).toBeInTheDocument()
    })

    it('renders a value that was never recorded as a dash, not zero', () => {
      render(<ReportViewer result={result()} vizType="table" />)
      // Cost of goods has no figure; a "$0.00" here would assert a fact nobody recorded.
      expect(screen.queryByText('$0.00')).not.toBeInTheDocument()
      expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    })
  })

  describe('truncation', () => {
    const truncated = result({
      totals: { income: null },
      meta: { ...result().meta, truncated: true },
    })

    it('warns and withholds the total instead of showing a partial sum', () => {
      render(<ReportViewer result={truncated} vizType="table" />)
      expect(screen.getByText(/totals have been withheld/i)).toBeInTheDocument()
      expect(screen.queryByText('$481,289.00')).not.toBeInTheDocument()
    })
  })

  describe('provenance strip', () => {
    it('names the book and the timezone the buckets were cut in', () => {
      render(<ReportViewer result={result()} vizType="table" />)
      expect(screen.getByText('Bookkeeping ledger')).toBeInTheDocument()
      expect(screen.getByText(/America\/New_York/)).toBeInTheDocument()
      expect(screen.getByText(/272 rows read/)).toBeInTheDocument()
    })

    it('reports how many values were not recorded', () => {
      const withGaps = result({
        meta: { ...result().meta, unknownCounts: { income: 238 } },
      })
      render(<ReportViewer result={withGaps} vizType="table" />)
      expect(screen.getByText(/238 values not recorded/)).toBeInTheDocument()
    })
  })

  describe('headline figures', () => {
    it('explains a missing total rather than showing a zero tile', () => {
      const missing = result({
        totals: { income: null },
        meta: { ...result().meta, unknownCounts: { income: 3 } },
      })
      render(<ReportViewer result={missing} vizType="kpi" />)
      expect(screen.getByText(/not recorded in any matching row/i)).toBeInTheDocument()
    })

    it('notes partial coverage beneath a real total', () => {
      const partial = result({ meta: { ...result().meta, unknownCounts: { income: 5 } } })
      render(<ReportViewer result={partial} vizType="kpi" />)
      expect(screen.getByText(/5 rows had no figure recorded/i)).toBeInTheDocument()
    })
  })

  describe('empty results', () => {
    const empty = result({
      rows: [],
      totals: { income: null },
      meta: { ...result().meta, rowsScanned: 0 },
    })

    it("shows the dataset's own explanation rather than a blank chart", () => {
      render(
        <ReportViewer
          result={empty}
          vizType="bar"
          emptyStateNote="Run the ledger backfill to populate this."
        />
      )
      expect(screen.getByText(/run the ledger backfill/i)).toBeInTheDocument()
    })

    it('tells the reader there is nothing to plot', () => {
      render(<ReportViewer result={empty} vizType="bar" />)
      expect(screen.getByText(/nothing to plot/i)).toBeInTheDocument()
    })
  })

  describe('chart views', () => {
    it('renders a chart plus its table without throwing', () => {
      render(<ReportViewer result={result()} vizType="bar" />)
      // The table accompanies every chart, so the underlying figures are always readable.
      expect(screen.getByText('$481,268.00')).toBeInTheDocument()
    })
  })
})
