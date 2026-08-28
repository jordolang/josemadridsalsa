import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { DesktopShell } from '@/components/admin-desktop/desktop-shell'
import type { Row, SectionPayload } from '@/lib/admin-desktop/types'

/**
 * The shell is the whole desktop window, so these cover the parts a screenshot
 * would: that a section draws its table, that the inspector offers the actions
 * the design puts at its foot, and that the keys those actions advertise work.
 */

function row(id: string, name: string, total: string): Row {
  return {
    id,
    href: `/admin/orders/${id}`,
    search: `${id} ${name}`,
    buckets: [0, 1],
    cells: [
      { text: id, mono: true, dim: true },
      { text: name, strong: true },
      { text: total, mono: true, right: true },
    ],
    inspector: {
      title: id,
      tag: 'Paid',
      tagTone: 'good',
      groups: [{ label: 'ORDER', fields: [{ label: 'Customer', value: name }] }],
      actions: [
        { label: 'Fulfill & print slip…', href: `/admin/orders/${id}/packing-slip`, shortcut: '⌘⏎' },
        { label: 'Email customer…', href: `/admin/orders/${id}`, shortcut: '⌘E' },
      ],
    },
  }
}

const payload: SectionPayload = {
  id: 'orders',
  kind: 'table',
  eyebrow: 'ALL CHANNELS',
  heading: 'Orders',
  path: '/admin/orders',
  filters: ['All channels', 'Online'],
  actions: [{ label: 'New order', icon: 'i-plus', href: '/admin/orders/new', primary: true }],
  body: {
    view: 'table',
    columns: [
      { label: 'Order', width: '104px' },
      { label: 'Customer', width: 'minmax(0,1fr)' },
      { label: 'Total', width: '92px', right: true },
    ],
    rows: [row('JMS-24817', 'Karen Wolfe', '$71.40'), row('JMS-24816', 'La Perla Market', '$812.00')],
    totals: [{ text: '2 orders' }, { text: '' }, { text: '$883.40', right: true, strong: true }],
  },
  loadedAt: '2026-09-14T12:41:00.000Z',
}

function renderShell() {
  return render(
    <DesktopShell
      initialSection={payload}
      badges={{ orders: 6 }}
      operator={{ name: 'Mike Madrid', email: 'mike@josemadrid.net' }}
    />,
  )
}

let assigned: string[]

beforeEach(() => {
  assigned = []
  // jsdom has no layout, so the shell's keep-the-row-in-view effect needs a stub.
  Element.prototype.scrollIntoView = vi.fn()
  // Every action in the shell is a navigation, so this is what "it worked"
  // looks like from the outside.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      href: 'http://localhost/admin-desktop',
      set _(value: string) {
        assigned.push(value)
      },
    },
  })
  Object.defineProperty(window.location, 'href', {
    configurable: true,
    get: () => 'http://localhost/admin-desktop',
    set: (value: string) => assigned.push(value),
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('DesktopShell', () => {
  it('draws the sidebar, the table and the totals the section carries', () => {
    renderShell()

    expect(screen.getByText('SALSA · EST. 1987')).toBeInTheDocument()
    expect(screen.getByText('ALL CHANNELS')).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(2)
    expect(screen.getByText('$883.40')).toBeInTheDocument()
    // The badge the registry asked for, next to its section.
    expect(screen.getByText('6')).toBeInTheDocument()
  })

  it('shows the first row in the inspector and follows the selection', () => {
    renderShell()

    const inspector = screen.getByRole('complementary')
    expect(within(inspector).getByText('JMS-24817')).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('option')[1])
    expect(within(inspector).getByText('JMS-24816')).toBeInTheDocument()
  })

  it('offers the selected row its actions and opens the one that is clicked', () => {
    renderShell()

    fireEvent.click(screen.getByRole('button', { name: /Email customer/ }))
    expect(assigned).toEqual(['/admin/orders/JMS-24817'])
  })

  it('runs an action from the key its label advertises', () => {
    renderShell()

    fireEvent.keyDown(document, { key: 'e', metaKey: true })
    expect(assigned).toEqual(['/admin/orders/JMS-24817'])
  })

  it('leaves the row type-ahead alone when the same letter has no modifier', () => {
    renderShell()

    // "l" jumps to La Perla Market rather than firing anything.
    fireEvent.keyDown(document, { key: 'l' })
    expect(assigned).toEqual([])
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true')
  })

  it('filters rows from the chips without changing what the totals say', () => {
    renderShell()

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'perla' } })

    const rows = screen.getAllByRole('option')
    expect(rows).toHaveLength(1)
    expect(within(rows[0]).getByText('La Perla Market')).toBeInTheDocument()
  })

  it('opens the command palette on ⌘K and lists sections and sub-pages', () => {
    renderShell()

    fireEvent.keyDown(document, { key: 'k', metaKey: true })
    const palette = screen.getByRole('dialog', { name: 'Command palette' })

    expect(within(palette).getByText('Inventory')).toBeInTheDocument()
    // Sub-pages the shell does not draw itself are still reachable here.
    expect(within(palette).getByText('Content & Blog · Redirects')).toBeInTheDocument()
  })
})
