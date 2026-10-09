import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import PrintInvoiceButton from '@/components/admin/PrintInvoiceButton'

/**
 * Clicking Print Invoice used to replace the whole order page with
 * "Unable to Load Orders — ie is not a function": the PDF link wrapped the
 * invoice document in next/dynamic, which react-pdf's renderer cannot draw.
 * These pin the replacement: Print opens the printable invoice page, and the
 * PDF is built directly with pdf().toBlob().
 */

const toBlob = vi.fn(async () => new Blob(['%PDF'], { type: 'application/pdf' }))
const pdf = vi.fn(() => ({ toBlob }))

vi.mock('@react-pdf/renderer', () => ({ pdf }))
vi.mock('@/components/admin/InvoicePDF', () => ({ default: () => null }))

const order = {
  id: 'ord1',
  orderNumber: 'JMS-10452',
  createdAt: '2026-10-09T12:00:00.000Z',
  status: 'PROCESSING',
  paymentStatus: 'SUCCEEDED',
  items: [{ id: 'i1', productName: 'Peach Mild', productSku: 'JMS-FRUIT-003', quantity: 2, unitPrice: 7.99, totalPrice: 15.98 }],
  subtotal: 15.98,
  shippingCost: 5,
  tax: 0.52,
  discountAmount: 0,
  total: 21.5,
  shippingAddress: { firstName: 'Pat', lastName: 'Smith', street: '12 Main St', city: 'Zanesville', state: 'OH', zipCode: '43701', country: 'US' },
  billingAddress: null,
  user: { name: 'Pat Smith', email: 'pat@example.com' },
}

afterEach(() => {
  vi.restoreAllMocks()
  pdf.mockClear()
  toBlob.mockClear()
})

describe('PrintInvoiceButton', () => {
  it('opens the printable invoice page', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<PrintInvoiceButton order={order} />)

    fireEvent.click(screen.getByRole('button', { name: /print invoice/i }))

    expect(open).toHaveBeenCalledWith('/admin/orders/ord1/invoice', '_blank')
  })

  it('builds the PDF directly and downloads it', async () => {
    const createObjectURL = vi.fn(() => 'blob:invoice')
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<PrintInvoiceButton order={order} />)

    fireEvent.click(screen.getByRole('button', { name: /download invoice pdf/i }))

    await waitFor(() => expect(click).toHaveBeenCalled())
    expect(pdf).toHaveBeenCalledTimes(1)
    expect(toBlob).toHaveBeenCalledTimes(1)
    const anchor = click.mock.contexts[0] as HTMLAnchorElement
    expect(anchor.download).toBe('invoice-JMS-10452.pdf')
    expect(anchor.href).toBe('blob:invoice')
  })
})
