import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PackSheet } from '@/components/admin-desktop/pack-sheet'
import type { PackOrder } from '@/lib/admin-desktop/fulfil'

/**
 * The pack sheet spends money: the last scan buys postage. These pin that it
 * buys only once every jar is in, refuses a jar that is not on the order, and
 * sends the label and slip to the desktop app's printers.
 */

const order: PackOrder = {
  id: 'ord1',
  orderNumber: 'JMS-10452',
  customerName: 'Pat Smith',
  address: ['12 Main St', 'Zanesville, OH 43701'],
  shippingMethod: 'USPS Ground Advantage',
  blocked: null,
  label: null,
  lines: [
    { id: 'i1', name: 'Peach Mild', sku: 'JMS-FRUIT-003', barcode: '093662452874', quantity: 2, packed: 0 },
    { id: 'i2', name: 'Spanish Verde Hot', sku: 'JMS-HOT-010', barcode: null, quantity: 1, packed: 0 },
  ],
  slipHtml: '<!doctype html><p>slip</p>',
}

const label = {
  trackingNumber: '9400100000000000000000',
  labelUrl: 'https://easypost-files.s3.amazonaws.com/label.png',
  carrier: 'USPS',
  service: 'GroundAdvantage',
  cost: 7.12,
}

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
}

function mockServer() {
  const purchases: string[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = String(input)
    if (url.startsWith('/api/admin/desktop/pack')) return json({ order })
    if (url.endsWith('/shipping-label') && init?.method === 'POST') {
      purchases.push(url)
      return json({ success: true, label })
    }
    return json({ error: 'unexpected' }, 500)
  })
  return purchases
}

function scan(code: string) {
  const input = screen.getByLabelText('Barcode')
  fireEvent.change(input, { target: { value: code } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

afterEach(() => {
  vi.restoreAllMocks()
  delete window.jmsDesktop
})

describe('PackSheet', () => {
  it('buys postage only once every jar is scanned, then prints the label and slip', async () => {
    const purchases = mockServer()
    const printLabel = vi.fn()
    const printDocument = vi.fn()
    window.jmsDesktop = { chrome: 'overlay', printLabel, printDocument }

    render(<PackSheet orderId="ord1" onClose={vi.fn()} onShipped={vi.fn()} />)
    await screen.findByText(/Scan each jar/)

    scan('093662452874')
    scan('093662452874')
    expect(purchases).toEqual([])
    scan('JMS-HOT-010')

    await waitFor(() => expect(printLabel).toHaveBeenCalledWith(label.labelUrl))
    expect(purchases).toEqual(['/api/admin/orders/ord1/shipping-label'])
    expect(printDocument).toHaveBeenCalledWith(order.slipHtml)
  })

  it('refuses a jar that is not on the order, and one too many', async () => {
    const purchases = mockServer()
    render(<PackSheet orderId="ord1" onClose={vi.fn()} onShipped={vi.fn()} />)
    await screen.findByText(/Scan each jar/)

    scan('093662452874')
    scan('012345678905')
    expect(screen.getByRole('status').textContent).toMatch(/not on order JMS-10452/)

    scan('093662452874')
    scan('093662452874')
    expect(screen.getByRole('status').textContent).toMatch(/Too many Peach Mild/)
    expect(purchases).toEqual([])
  })
})
