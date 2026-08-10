import { describe, expect, it } from 'vitest'

import {
  DUPLICATE_WINDOW_SECONDS,
  duplicateWindowStart,
  generateManualOrderNumber,
  ManualOrderSchema,
  priceManualOrder,
  type ManualOrderInput,
  type PricedProduct,
} from '@/lib/admin/manual-order'

const cuid = (n: number) => `c${String(n).padStart(24, '0')}`

const catalogue = new Map<string, PricedProduct>([
  [cuid(1), { id: cuid(1), name: 'Clovis Medium', sku: 'JMS-MILD-002', price: 9, costPrice: 2.05 }],
  [cuid(2), { id: cuid(2), name: 'Strawberry Mild', sku: 'JMS-FRUIT-006', price: 9, costPrice: null }],
])

const input = (over: Partial<ManualOrderInput> = {}): ManualOrderInput =>
  ({
    customer: { email: 'buyer@example.com' },
    items: [{ productId: cuid(1), quantity: 2 }],
    salesChannel: 'PHONE',
    paymentStatus: 'PAID',
    shippingCost: 0,
    tax: 0,
    discountAmount: 0,
    ...over,
  }) as ManualOrderInput

describe('ManualOrderSchema', () => {
  it('accepts a phone order', () => {
    expect(
      ManualOrderSchema.safeParse({
        customer: { email: 'buyer@example.com' },
        items: [{ productId: cuid(1), quantity: 2 }],
        salesChannel: 'PHONE',
        paymentStatus: 'PAID',
      }).success
    ).toBe(true)
  })

  it('refuses an order with no items', () => {
    expect(
      ManualOrderSchema.safeParse({
        customer: { email: 'buyer@example.com' },
        items: [],
        salesChannel: 'PHONE',
        paymentStatus: 'PAID',
      }).success
    ).toBe(false)
  })

  it('refuses the channels that belong to other paths', () => {
    // WEBSITE, POS, FUNDRAISER and IMPORT are set by the paths that own them; letting someone
    // pick them here would make channel reporting a matter of opinion.
    for (const salesChannel of ['WEBSITE', 'POS', 'FUNDRAISER', 'IMPORT']) {
      expect(ManualOrderSchema.safeParse(input({ salesChannel } as never)).success).toBe(false)
    }
  })

  it('refuses a payment state only a processor can produce', () => {
    expect(ManualOrderSchema.safeParse(input({ paymentStatus: 'REFUNDED' } as never)).success).toBe(
      false
    )
  })

  it('defaults the money fields to zero', () => {
    const parsed = ManualOrderSchema.parse({
      customer: { email: 'buyer@example.com' },
      items: [{ productId: cuid(1), quantity: 1 }],
      salesChannel: 'MANUAL',
      paymentStatus: 'PENDING',
    })

    expect(parsed.shippingCost).toBe(0)
    expect(parsed.tax).toBe(0)
    expect(parsed.discountAmount).toBe(0)
  })
})

describe('priceManualOrder', () => {
  it('uses the catalogue price when none is given', () => {
    const totals = priceManualOrder(input(), catalogue)

    expect(totals.lines[0].unitPrice).toBe(9)
    expect(totals.lines[0].totalPrice).toBe(18)
    expect(totals.subtotal).toBe(18)
    expect(totals.total).toBe(18)
  })

  it('honours a negotiated price, which is the norm on these channels', () => {
    const totals = priceManualOrder(
      input({ items: [{ productId: cuid(1), quantity: 12, unitPrice: 3.5 }] }),
      catalogue
    )

    expect(totals.subtotal).toBe(42)
  })

  it('snapshots the cost at the moment of sale, and leaves an unknown cost null', () => {
    const totals = priceManualOrder(
      input({
        items: [
          { productId: cuid(1), quantity: 1 },
          { productId: cuid(2), quantity: 1 },
        ],
      }),
      catalogue
    )

    expect(totals.lines[0].unitCost).toBe(2.05)
    expect(totals.lines[1].unitCost).toBeNull()
  })

  it('adds shipping and tax and takes the discount off the goods', () => {
    const totals = priceManualOrder(
      input({ shippingCost: 8.95, tax: 1.2, discountAmount: 5 }),
      catalogue
    )

    // 18.00 - 5.00 + 8.95 + 1.20
    expect(totals.total).toBe(23.15)
  })

  it('clamps a discount larger than the goods rather than going negative', () => {
    const totals = priceManualOrder(input({ discountAmount: 500 }), catalogue)

    expect(totals.discountAmount).toBe(18)
    expect(totals.total).toBe(0)
  })

  it('rounds to cents rather than carrying float noise into the order', () => {
    const totals = priceManualOrder(
      input({ items: [{ productId: cuid(1), quantity: 3, unitPrice: 3.33 }] }),
      catalogue
    )

    expect(totals.subtotal).toBe(9.99)
  })

  it('skips a line whose product could not be loaded', () => {
    const totals = priceManualOrder(
      input({ items: [{ productId: cuid(9), quantity: 1 }] }),
      catalogue
    )

    expect(totals.lines).toHaveLength(0)
    expect(totals.total).toBe(0)
  })
})

describe('duplicate submission window', () => {
  it('looks back one minute', () => {
    const now = new Date('2026-08-09T12:00:30.000Z')

    expect(duplicateWindowStart(now).toISOString()).toBe('2026-08-09T11:59:30.000Z')
    expect(DUPLICATE_WINDOW_SECONDS).toBe(60)
  })
})

describe('generateManualOrderNumber', () => {
  it('matches the format every other order path produces', () => {
    const number = generateManualOrderNumber(new Date('2026-08-09T12:00:00.000Z'), 0.5)

    expect(number).toMatch(/^JMS-20260809-\d{4}$/)
  })
})
