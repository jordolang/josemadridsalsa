import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TableView } from '@/components/admin-desktop/views'
import type { Column, Row } from '@/lib/admin-desktop/types'

const columns: Column[] = [
  { label: 'Fundraiser', width: '1fr' },
  { label: 'Runs', width: '1fr' },
]

const rows: Row[] = [
  {
    id: 'f1',
    cells: [{ text: 'Spring Band' }, { text: 'Mar 1 – Apr 1', sort: 1 }],
    search: 'spring',
    buckets: [0],
    inspector: { title: 'Spring Band', groups: [] },
  },
]

function renderTable(props: Partial<Parameters<typeof TableView>[0]> = {}) {
  return render(
    <TableView
      columns={columns}
      rows={rows}
      selected={0}
      onSelect={vi.fn()}
      onOpen={vi.fn()}
      emptyLabel="Nothing"
      {...props}
    />,
  )
}

describe('TableView headers', () => {
  it('sorts by the clicked column', () => {
    const onSort = vi.fn()
    renderTable({ onSort })
    fireEvent.click(screen.getByRole('button', { name: /Runs/ }))
    expect(onSort).toHaveBeenCalledWith('Runs', 1)
  })

  it('marks the sorted column and its direction', () => {
    renderTable({ onSort: vi.fn(), sort: { key: 'Runs', direction: 'desc' } })
    const headers = screen.getAllByRole('columnheader')
    expect(headers[1]).toHaveAttribute('aria-sort', 'descending')
    expect(headers[1]).toHaveTextContent('▼')
    expect(headers[0]).not.toHaveAttribute('aria-sort')
  })

  it('draws plain labels when the table cannot sort', () => {
    renderTable()
    expect(screen.queryByRole('button', { name: /Runs/ })).toBeNull()
    expect(screen.getByText('Runs')).toBeInTheDocument()
  })
})
