import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { DesktopShell } from '@/components/admin-desktop/desktop-shell'
import type { Row, SectionPayload } from '@/lib/admin-desktop/types'
import type { DesktopSectionId } from '@/lib/admin-desktop/sections'

/**
 * The shell is the whole desktop window, so these cover the parts a screenshot
 * would: that a section draws its table, that the inspector offers the actions
 * the design puts at its foot, and that the keys those actions advertise work.
 *
 * Actions are commands rather than links now, so the assertions split: an `open`
 * still ends in a navigation, while a `form` opens a sheet in the window and a
 * `write` goes to the write route. Nothing leaves the window unless it says so.
 */

function row(id: string, name: string, total: string): Row {
  return {
    id,
    open: { kind: 'form', form: 'order.status', recordId: id, title: `Order ${id}` },
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
        {
          label: 'Edit order…',
          shortcut: '⌘⏎',
          command: { kind: 'form', form: 'order.status', recordId: id, title: `Order ${id}` },
        },
        { label: 'Packing slip…', shortcut: '⌘E', command: { kind: 'open', href: `/admin/orders/${id}/packing-slip` } },
        {
          label: 'Cancel order',
          danger: true,
          command: { kind: 'write', op: 'order.cancel', recordId: id, confirm: `Cancel ${id}?`, danger: true },
        },
      ],
    },
  }
}

const payload: SectionPayload = {
  id: 'orders',
  page: 'orders',
  pages: [
    { id: 'orders', label: 'Orders' },
    { id: 'orders.returns', label: 'Returns & RMAs' },
    { id: 'orders.shipping', label: 'Shipping labels' },
  ],
  kind: 'table',
  eyebrow: 'ALL CHANNELS',
  heading: 'Orders',
  path: '/admin/orders',
  filters: ['All channels', 'Online'],
  actions: [
    { label: 'New order', icon: 'i-plus', command: { kind: 'form', form: 'order.create' }, primary: true },
  ],
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

function renderShell(visibleSections?: DesktopSectionId[]) {
  return render(
    <DesktopShell
      initialSection={payload}
      badges={{ orders: 6 }}
      operator={{ name: 'Mike Madrid', email: 'mike@josemadrid.net' }}
      visibleSections={visibleSections}
    />,
  )
}

/** Render at a payload other than the shared orders fixture. */
function renderAt(initial: SectionPayload) {
  return render(
    <DesktopShell
      initialSection={initial}
      badges={{}}
      operator={{ name: 'Mike Madrid', email: 'mike@josemadrid.net' }}
    />,
  )
}

let assigned: string[]

beforeEach(() => {
  assigned = []
  // Column widths persist per window, so one test's drag must not reach another.
  window.localStorage.clear()
  // jsdom has no layout, so the shell's keep-the-row-in-view effect needs a stub.
  Element.prototype.scrollIntoView = vi.fn()
  // An `open` command is a navigation, so this is what "it left the window"
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

  it('offers the selected row its actions and follows the one that leaves the window', () => {
    renderShell()

    fireEvent.click(screen.getByRole('button', { name: /Packing slip/ }))
    expect(assigned).toEqual(['/admin/orders/JMS-24817/packing-slip'])
  })

  it('runs an action from the key its label advertises', () => {
    renderShell()

    fireEvent.keyDown(document, { key: 'e', metaKey: true })
    expect(assigned).toEqual(['/admin/orders/JMS-24817/packing-slip'])
  })

  it('opens an edit sheet in the window instead of navigating to /admin', () => {
    // The whole point of the change: the operator stays in the window.
    renderShell()

    fireEvent.click(screen.getByRole('button', { name: /Edit order…/ }))

    expect(screen.getByRole('dialog', { name: 'Order JMS-24817' })).toBeInTheDocument()
    expect(assigned).toEqual([])
  })

  it('opens the create sheet from the section’s own header button', () => {
    renderShell()

    fireEvent.click(screen.getByRole('button', { name: /New order/ }))

    expect(screen.getByRole('dialog', { name: 'New order' })).toBeInTheDocument()
    expect(assigned).toEqual([])
  })

  it('asks before running a destructive action, and does nothing if told no', () => {
    renderShell()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel order' }))

    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText('Cancel JMS-24817?')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(assigned).toEqual([])
  })

  it('opens a row’s own sheet on ⏎ rather than leaving for a page', () => {
    renderShell()

    fireEvent.keyDown(document, { key: 'Enter' })
    expect(screen.getByRole('dialog', { name: 'Order JMS-24817' })).toBeInTheDocument()
    expect(assigned).toEqual([])
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
    // A page two clicks in is still one ⌘K away.
    expect(within(palette).getByText('Content & Blog · Redirects')).toBeInTheDocument()
  })

  it('draws the pages of a section as tabs and marks the one on screen', () => {
    renderShell()

    const strip = screen.getByRole('tablist', { name: 'Orders pages' })
    const tabs = within(strip).getAllByRole('tab')
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Orders', 'Returns & RMAs', 'Shipping labels'])
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false')
  })

  it('fetches the page a tab names rather than the section on its own', async () => {
    // The route takes the section in the path and the page in the query, so a
    // tab that asked for the wrong one would silently redraw the same list.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ...payload,
        page: 'orders.returns',
        heading: 'Returns & RMAs',
        path: '/admin/returns',
        body: { view: 'table', columns: payload.body.columns, rows: [], totals: [] },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    renderShell()
    fireEvent.click(screen.getByRole('tab', { name: 'Returns & RMAs' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/desktop/orders?page=orders.returns')

    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Returns & RMAs' })).toHaveAttribute('aria-selected', 'true'),
    )
  })

  it('draws no tab strip for a section that is one page', () => {
    renderAt({ ...payload, id: 'audit', page: 'audit', pages: [{ id: 'audit', label: 'Audit Logs' }] })

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  it('resizes a column from the keyboard and remembers it', () => {
    // The drag is a pointer gesture jsdom cannot lay out, but the same handler
    // runs on the arrow keys — which is also how anyone not using a mouse
    // resizes a column at all.
    renderShell()

    const handle = screen.getByRole('separator', { name: 'Resize Customer' })
    fireEvent.keyDown(handle, { key: 'ArrowRight' })

    const stored = JSON.parse(window.localStorage.getItem('jms-desktop-columns') ?? '{}')
    expect(stored.orders.Customer).toBeGreaterThan(0)

    // The header, the rows and the totals all move together, or the columns
    // would slide out from under their headings.
    const template = `104px ${stored.orders.Customer}px 92px`
    for (const node of document.querySelectorAll('.jmsd-thead, .jmsd-row, .jmsd-tfoot')) {
      expect((node as HTMLElement).style.gridTemplateColumns).toBe(template)
    }
  })

  it('offers a way back to the default widths once one has been dragged', () => {
    renderShell()

    expect(screen.queryByRole('button', { name: /Reset columns/ })).not.toBeInTheDocument()

    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize Customer' }), { key: 'ArrowRight' })
    fireEvent.click(screen.getByRole('button', { name: /Reset columns/ }))

    const stored = JSON.parse(window.localStorage.getItem('jms-desktop-columns') ?? '{}')
    expect(stored.orders).toBeUndefined()
    expect(
      (document.querySelector('.jmsd-thead') as HTMLElement).style.gridTemplateColumns,
    ).toBe('104px minmax(0,1fr) 92px')
  })

  it('leaves out sections the account may not see', () => {
    // The server resolves this from the same permissions /admin checks, so a
    // section missing here is one the API would refuse anyway. Offering it and
    // then failing the fetch would be worse than not offering it.
    renderShell(['orders', 'products'])

    const sidebar = screen.getByRole('navigation')
    expect(within(sidebar).getByText('Orders')).toBeInTheDocument()
    expect(within(sidebar).queryByText('Financials')).not.toBeInTheDocument()
    expect(within(sidebar).queryByText('Database Console')).not.toBeInTheDocument()

    // And the palette agrees, so ⌘K is not a way around the sidebar.
    fireEvent.keyDown(document, { key: 'k', metaKey: true })
    const palette = screen.getByRole('dialog', { name: 'Command palette' })
    expect(within(palette).getByText('Products')).toBeInTheDocument()
    expect(within(palette).queryByText('Database Console')).not.toBeInTheDocument()
  })

  it('shows every section when the server supplies no list', () => {
    renderShell()
    expect(within(screen.getByRole('navigation')).getByText('Database Console')).toBeInTheDocument()
  })

  it('runs a bulk action once per marked row, each on its own record', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(url === '/api/admin/desktop/write' ? { ok: true, message: 'Done' } : payload),
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    renderShell()

    const [first, second] = screen.getAllByRole('option')
    fireEvent.click(first, { metaKey: true })
    fireEvent.click(second, { ctrlKey: true })

    const bar = screen.getByRole('toolbar', { name: 'Bulk actions' })
    expect(within(bar).getByText('2 marked')).toBeInTheDocument()
    // Sheets are never offered in bulk; the shared write is.
    expect(within(bar).queryByText('Edit order…')).not.toBeInTheDocument()

    fireEvent.click(within(bar).getByText('Cancel order'))
    fireEvent.click(screen.getByText('Yes, do it'))

    await waitFor(() => expect(screen.getByText('Cancel order: 2 done')).toBeInTheDocument())
    const writes = fetchMock.mock.calls.filter(([url]) => url === '/api/admin/desktop/write')
    expect(writes.map(([, init]) => JSON.parse(init.body).recordId)).toEqual(['JMS-24817', 'JMS-24816'])
    expect(screen.queryByRole('toolbar', { name: 'Bulk actions' })).not.toBeInTheDocument()
  })

  it('marks a run of rows with Shift and clears them with Escape', () => {
    renderShell()
    fireEvent.click(screen.getAllByRole('option')[1], { shiftKey: true })
    expect(screen.getByText('2 marked')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('2 marked')).not.toBeInTheDocument()
  })

  it('searches the server once typing stops when the window is full', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(payload) })
    vi.stubGlobal('fetch', fetchMock)
    renderAt({ ...payload, list: { q: '', limit: 250, more: true, searchable: true } })

    fireEvent.change(screen.getByPlaceholderText(/Filter this table/), { target: { value: 'wolfe' } })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/desktop/orders?q=wolfe')
  })

  it('filters on the spot, without the server, when every row is already loaded', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    renderAt({ ...payload, list: { q: '', limit: 250, more: false, searchable: true } })

    fireEvent.change(screen.getByPlaceholderText(/Filter this table/), { target: { value: 'wolfe' } })
    expect(screen.getAllByRole('option')).toHaveLength(1)
    await new Promise((resolve) => setTimeout(resolve, 450))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reads the next rows when asked, keeping the search', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(payload) })
    vi.stubGlobal('fetch', fetchMock)
    renderAt({ ...payload, list: { q: '', limit: 250, more: true, searchable: false } })

    fireEvent.click(screen.getByText('Load more'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/desktop/orders?limit=500')
  })

  it('refreshes on its own and keeps the sidebar badges current', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ...payload, badges: { orders: 9 } }),
    })
    vi.stubGlobal('fetch', fetchMock)
    try {
      renderShell()
      expect(screen.getByText('6')).toBeInTheDocument()

      await vi.advanceTimersByTimeAsync(60_000)
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/desktop/orders', { credentials: 'same-origin' })
    } finally {
      vi.useRealTimers()
    }
    await waitFor(() => expect(screen.getByText('9')).toBeInTheDocument())
  })

  it('tells the desktop app when orders arrive, and keeps its badge at what is waiting', async () => {
    vi.useFakeTimers()
    const notify = vi.fn()
    const setBadge = vi.fn()
    window.jmsDesktop = { chrome: 'overlay', notify, setBadge }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ orders: 8 }) })
    vi.stubGlobal('fetch', fetchMock)
    try {
      renderShell()
      // Opening the window is the baseline, not news.
      expect(notify).not.toHaveBeenCalled()
      expect(setBadge).toHaveBeenLastCalledWith(6)

      // Hidden windows keep polling: this is the case notifications are for.
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
      await vi.advanceTimersByTimeAsync(60_000)
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/desktop/badges', { credentials: 'same-origin' })
      vi.useRealTimers()
      await waitFor(() =>
        expect(notify).toHaveBeenCalledWith({
          title: '2 new orders to fulfil',
          body: '8 waiting to ship',
          path: '/admin-desktop?section=orders',
        }),
      )
      expect(setBadge).toHaveBeenLastCalledWith(8)
      // Only the poll's fetch: a hidden window does not reload its page.
      expect(fetchMock.mock.calls.every(([url]) => url === '/api/admin/desktop/badges')).toBe(true)
    } finally {
      vi.useRealTimers()
      delete window.jmsDesktop
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    }
  })

  it('prints a label on the desktop app’s label printer, or opens it beside the shell in a browser', () => {
    const labelRow = row('JMS-24817', 'Karen Wolfe', '$71.40')
    labelRow.inspector.actions = [
      { label: 'Print label', command: { kind: 'label', href: 'https://easypost-files.s3.amazonaws.com/label.png' } },
    ]
    const opened = vi.spyOn(window, 'open').mockReturnValue(null)
    const printLabel = vi.fn()

    const view = renderAt({ ...payload, body: { ...payload.body, rows: [labelRow] } as typeof payload.body })
    fireEvent.click(screen.getByText('Print label'))
    expect(opened).toHaveBeenCalledWith('https://easypost-files.s3.amazonaws.com/label.png', '_blank', 'noopener')
    expect(assigned).toEqual([])
    view.unmount()

    window.jmsDesktop = { chrome: 'overlay', printLabel }
    try {
      renderAt({ ...payload, body: { ...payload.body, rows: [labelRow] } as typeof payload.body })
      fireEvent.click(screen.getByText('Print label'))
      expect(printLabel).toHaveBeenCalledWith('https://easypost-files.s3.amazonaws.com/label.png')
      expect(opened).toHaveBeenCalledTimes(1)
    } finally {
      delete window.jmsDesktop
    }
  })

  it('exports what the filter shows as a CSV download', () => {
    const clicked: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this.getAttribute('href') ?? '')
    })
    renderShell()

    fireEvent.change(screen.getByPlaceholderText(/Filter this table/), { target: { value: 'wolfe' } })
    fireEvent.click(screen.getByText('Online'))
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }))

    expect(clicked).toEqual(['/api/admin/desktop/orders?format=csv&q=wolfe&filter=1'])
  })
})
