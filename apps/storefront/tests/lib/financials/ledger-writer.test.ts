import { describe, expect, it } from 'vitest'

import { orderToInput } from '@/lib/financials/ledger-writer'

const order = (overrides: Record<string, unknown> = {}) => ({
  id: 'ord_1',
  orderNumber: 'JMS-1',
  createdAt: new Date('2026-08-13T00:00:00Z'),
  salesChannel: 'WEBSITE' as const,
  guestEmail: 'a@b.com',
  paymentMethod: 'card',
  subtotal: 54,
  shippingCost: 6.99,
  tax: 4.32,
  discountAmount: 0,
  items: [{ unitCost: 2.0, quantity: 3 }],
  payments: [{ status: 'PAID' as const, processorFee: 186 }],
  ...overrides,
})

describe('orderToInput', () => {
  it('converts dollar columns to cents and sums COGS across items', () => {
    const input = orderToInput(order())
    expect(input.subtotalCents).toBe(5400)
    expect(input.shippingCents).toBe(699)
    expect(input.taxCents).toBe(432)
    expect(input.cogsCents).toBe(600) // $2.00 * 3
    expect(input.processorFeeCents).toBe(186)
  })

  it('treats an unknown (null) processor fee as not-yet-known, never zero', () => {
    // A null fee must not produce a $0 fee row — that would overstate profit. It stays out until
    // the fee sweep fills it in and re-records the order.
    const input = orderToInput(order({ payments: [{ status: 'PAID', processorFee: null }] }))
    expect(input.processorFeeCents).toBe(0)
  })

  it('sums only the known fees when some payments are still pending their fee', () => {
    const input = orderToInput(
      order({
        payments: [
          { status: 'PAID', processorFee: 150 },
          { status: 'PAID', processorFee: null },
        ],
      })
    )
    expect(input.processorFeeCents).toBe(150)
  })

  it('still counts the fee on a refunded order — the original sale happened', () => {
    const input = orderToInput(order({ payments: [{ status: 'REFUNDED', processorFee: 186 }] }))
    expect(input.processorFeeCents).toBe(186)
  })

  it('skips an item whose cost was unknown rather than counting it as zero', () => {
    const input = orderToInput(
      order({ items: [{ unitCost: null, quantity: 5 }, { unitCost: 2, quantity: 1 }] })
    )
    expect(input.cogsCents).toBe(200)
  })
})
