import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ShowCheckoutSheet } from '@/components/admin-desktop/show-checkout-sheet'
import type { CheckoutProduct, CheckoutShow } from '@/lib/admin-desktop/show-checkout'

/**
 * Show checkout is scan, grab, scan, grab: each scan has to land as exactly one
 * case, or half of one with ⌘ held, and every case needs its date before the
 * cart can be checked out. These pin those, and that the desktop app is told to
 * let ⌘+digits through while the sheet is open.
 */

const products: CheckoutProduct[] = [
  { id: 'p1', name: 'Mild Salsa', sku: 'JMS-MILD-001', barcode: '093662452874', category: 'Mild', unitsPerCase: 12 },
]
const shows: CheckoutShow[] = [
  {
    id: 'e1',
    title: 'Zanesville Pumpkin Fest',
    startDate: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    location: 'Zanesville, OH',
    manifest: null,
  },
]

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
}

function mockServer() {
  const saved: unknown[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    if (String(input) === '/api/admin/desktop/show-checkout') {
      if (init?.method === 'POST') {
        saved.push(JSON.parse(String(init.body)))
        return json({ message: '1½ cases checked out' })
      }
      return json({ shows, products, codesHtml: '<p>codes</p>' })
    }
    return json({ error: 'unexpected' }, 500)
  })
  return saved
}

/** The scanner types each character, then Enter, with ⌘ down for a half case. */
function scan(code: string, { command = false } = {}) {
  const input = screen.getByRole('textbox', { name: /Case label/ })
  if (command) {
    fireEvent.keyDown(input, { key: 'Meta', metaKey: true })
    for (const key of code) fireEvent.keyDown(input, { key, metaKey: true })
  } else {
    fireEvent.change(input, { target: { value: code } })
  }
  fireEvent.keyDown(input, { key: 'Enter', metaKey: command })
  if (command) fireEvent.keyUp(window, { key: 'Meta' })
}

async function startScanning() {
  await screen.findByRole('option', { name: /Zanesville Pumpkin Fest/ })
  fireEvent.change(screen.getByLabelText(/Your name/), { target: { value: 'Jordan' } })
  fireEvent.click(screen.getByRole('button', { name: 'Start scanning' }))
}

afterEach(() => {
  vi.restoreAllMocks()
  delete window.jmsDesktop
  localStorage.clear()
})

describe('ShowCheckoutSheet', () => {
  it('counts a scan as a case and a ⌘ scan as a half case, then saves once every case is dated', async () => {
    const saved = mockServer()
    const setScanCapture = vi.fn()
    window.jmsDesktop = { chrome: 'traffic-lights', setScanCapture }
    const onSaved = vi.fn()

    render(<ShowCheckoutSheet onClose={vi.fn()} onSaved={onSaved} />)
    expect(setScanCapture).toHaveBeenCalledWith(true)
    await startScanning()

    scan('093662452874')
    expect(screen.getByRole('status').textContent).toMatch(/1 CASE · Mild Salsa/)
    scan('093662452874', { command: true })
    expect(screen.getByRole('status').textContent).toMatch(/HALF CASE \(6 jars\) · Mild Salsa/)
    expect(screen.getByRole('status').textContent).toMatch(/1½ on the cart/)

    const checkOut = screen.getByRole('button', { name: 'Check out' }) as HTMLButtonElement
    expect(checkOut.disabled).toBe(true)

    scan('JMSDATES')
    const dateBox = screen.getByRole('textbox', { name: /Case label or date/ })
    fireEvent.change(dateBox, { target: { value: '02/15' } })
    fireEvent.keyDown(dateBox, { key: 'Enter' })
    // The code sheet: month, then day.
    for (const code of ['JD03', 'JD01']) {
      fireEvent.change(dateBox, { target: { value: code } })
      fireEvent.keyDown(dateBox, { key: 'Enter' })
    }
    expect(screen.getByRole('status').textContent).toMatch(/Every case is dated/)

    fireEvent.click(checkOut)
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('1½ cases checked out'))
    const year = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()).slice(0, 4)) + 3
    expect(saved).toEqual([
      expect.objectContaining({
        eventId: 'e1',
        checkedOutBy: 'Jordan',
        cases: [
          { productId: 'p1', half: false, date: `${year}-02-15` },
          { productId: 'p1', half: true, date: `${year}-03-01` },
        ],
      }),
    ])
  })

  it('refuses a label it does not know without adding anything', async () => {
    mockServer()
    render(<ShowCheckoutSheet onClose={vi.fn()} onSaved={vi.fn()} />)
    await startScanning()

    scan('012345678905')
    expect(screen.getByRole('status').textContent).toMatch(/not a case label we know/)
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('gives the desktop app its shortcuts back when it closes', async () => {
    mockServer()
    const setScanCapture = vi.fn()
    window.jmsDesktop = { chrome: 'overlay', setScanCapture }
    const { unmount } = render(<ShowCheckoutSheet onClose={vi.fn()} onSaved={vi.fn()} />)
    await screen.findByRole('option', { name: /Zanesville Pumpkin Fest/ })
    unmount()
    expect(setScanCapture).toHaveBeenLastCalledWith(false)
  })
})
