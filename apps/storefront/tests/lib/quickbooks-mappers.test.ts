import { describe, it, expect } from 'vitest'
import {
  buildCustomerPayload,
  buildRefundReceipt,
  buildItemPayload,
  buildSalesReceipt,
  centsToDollars,
  round2,
  toTxnDate,
  type OrderForSync,
  type SyncSettings,
} from '@/lib/quickbooks/mappers'

const baseOrder = (overrides: Partial<OrderForSync> = {}): OrderForSync => ({
  id: 'ord_abc123',
  orderNumber: 'JMS-1001',
  createdAt: new Date(2026, 6, 22, 14, 30),
  subtotal: 24,
  shippingCost: 0,
  tax: 0,
  discountAmount: 0,
  giftCertificateAmount: 0,
  total: 24,
  customerEmail: 'buyer@example.com',
  customerFirstName: 'Ada',
  customerLastName: 'Lovelace',
  items: [
    {
      productId: 'prod_1',
      productName: 'Black Bean & Corn',
      productSku: 'JMS-BBC',
      quantity: 2,
      unitPrice: 12,
      totalPrice: 24,
    },
  ],
  ...overrides,
})

const settings: SyncSettings = {
  incomeAccountId: '79',
  depositAccountId: '4',
  shippingItemId: '21',
  discountAccountId: '86',
  giftCertificateAccountId: null,
}

const itemIds = { prod_1: '101', prod_2: '102' }

describe('money helpers', () => {
  it('rounds to two decimals', () => {
    expect(round2(12.005)).toBe(12.01)
    expect(round2(0.1 + 0.2)).toBe(0.3)
    expect(round2(24)).toBe(24)
  })

  it('converts Int cents to dollars', () => {
    expect(centsToDollars(2400)).toBe(24)
    expect(centsToDollars(1999)).toBe(19.99)
    expect(centsToDollars(1)).toBe(0.01)
  })
})

describe('toTxnDate', () => {
  it('emits a date-only string in local time', () => {
    expect(toTxnDate(new Date(2026, 6, 22, 14, 30))).toBe('2026-07-22')
  })

  it('pads single-digit months and days', () => {
    expect(toTxnDate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('does not roll back a late-evening order to the previous day', () => {
    expect(toTxnDate(new Date(2026, 6, 22, 23, 59))).toBe('2026-07-22')
  })
})

describe('buildCustomerPayload', () => {
  it('makes DisplayName unique by folding in the email', () => {
    expect(buildCustomerPayload(baseOrder()).DisplayName).toBe('Ada Lovelace (buyer@example.com)')
  })

  it('falls back to the email alone when no name is on the order', () => {
    const payload = buildCustomerPayload(
      baseOrder({ customerFirstName: null, customerLastName: null })
    )
    expect(payload.DisplayName).toBe('buyer@example.com')
    expect(payload.GivenName).toBeUndefined()
  })

  it('omits the email field entirely when there is none', () => {
    const payload = buildCustomerPayload(baseOrder({ customerEmail: null }))
    expect(payload.DisplayName).toBe('Ada Lovelace')
    expect(payload).not.toHaveProperty('PrimaryEmailAddr')
  })
})

describe('buildItemPayload', () => {
  it('maps a product to a non-inventory item on the income account', () => {
    expect(buildItemPayload({ name: 'Chipotle', sku: 'JMS-CHP' }, '79')).toEqual({
      Name: 'Chipotle',
      Sku: 'JMS-CHP',
      Type: 'NonInventory',
      IncomeAccountRef: { value: '79' },
    })
  })
})

describe('buildSalesReceipt', () => {
  it('builds a receipt for a simple paid order', () => {
    const result = buildSalesReceipt({
      order: baseOrder(),
      customerId: '55',
      itemIds,
      settings,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.payload.CustomerRef).toEqual({ value: '55' })
    expect(result.payload.TxnDate).toBe('2026-07-22')
    expect(result.payload.DocNumber).toBe('JMS-1001')
    expect(result.payload.DepositToAccountRef).toEqual({ value: '4' })
    expect(result.payload.Line).toHaveLength(1)
    expect(result.payload.Line[0]).toEqual({
      DetailType: 'SalesItemLineDetail',
      Amount: 24,
      Description: 'Black Bean & Corn',
      SalesItemLineDetail: {
        ItemRef: { value: '101' },
        Qty: 2,
        UnitPrice: 12,
      },
    })
  })

  it('adds shipping and tax without breaking the total', () => {
    const result = buildSalesReceipt({
      order: baseOrder({ shippingCost: 8.5, tax: 1.95, total: 34.45 }),
      customerId: '55',
      itemIds,
      settings,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.payload.Line).toHaveLength(2)
    expect(result.payload.Line[1].Amount).toBe(8.5)
    expect(result.payload.TxnTaxDetail).toEqual({ TotalTax: 1.95 })
  })

  it('subtracts a discount line from the reconciled total', () => {
    const result = buildSalesReceipt({
      order: baseOrder({ discountAmount: 4, total: 20 }),
      customerId: '55',
      itemIds,
      settings,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const discount = result.payload.Line[1]
    expect(discount.DetailType).toBe('DiscountLineDetail')
    expect(discount.Amount).toBe(4)
  })

  it('omits TxnTaxDetail when there is no tax', () => {
    const result = buildSalesReceipt({ order: baseOrder(), customerId: '55', itemIds, settings })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.payload).not.toHaveProperty('TxnTaxDetail')
  })

  it('truncates a DocNumber past QBO 21-character limit', () => {
    const result = buildSalesReceipt({
      order: baseOrder({ orderNumber: 'JMS-2026-0722-EXTRA-LONG-NUMBER' }),
      customerId: '55',
      itemIds,
      settings,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.payload.DocNumber).toHaveLength(21)
    // The untruncated number stays recoverable in the note.
    expect(result.payload.PrivateNote).toContain('JMS-2026-0722-EXTRA-LONG-NUMBER')
  })

  it('refuses an order whose lines do not reconcile to its total', () => {
    const result = buildSalesReceipt({
      order: baseOrder({ total: 99 }),
      customerId: '55',
      itemIds,
      settings,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toContain('does not match order total')
  })

  it('refuses when a product has no mapped QBO item', () => {
    const result = buildSalesReceipt({
      order: baseOrder(),
      customerId: '55',
      itemIds: {},
      settings,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toContain('JMS-BBC')
  })

  it('refuses shipping with no shipping item mapped', () => {
    const result = buildSalesReceipt({
      order: baseOrder({ shippingCost: 8.5, total: 32.5 }),
      customerId: '55',
      itemIds,
      settings: { ...settings, shippingItemId: null },
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toContain('shipping')
  })

  it('refuses a discount with no discount account mapped', () => {
    const result = buildSalesReceipt({
      order: baseOrder({ discountAmount: 4, total: 20 }),
      customerId: '55',
      itemIds,
      settings: { ...settings, discountAccountId: null },
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toContain('discount account')
  })

  it('holds gift-certificate orders rather than posting them as a discount', () => {
    const result = buildSalesReceipt({
      order: baseOrder({ giftCertificateAmount: 10, total: 14 }),
      customerId: '55',
      itemIds,
      settings,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toContain('gift certificate')
  })

  it('refuses an order with no line items', () => {
    const result = buildSalesReceipt({
      order: baseOrder({ items: [], subtotal: 0, total: 0 }),
      customerId: '55',
      itemIds,
      settings,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toContain('no line items')
  })

  it('reconciles a multi-line order with fractional cents', () => {
    const result = buildSalesReceipt({
      order: baseOrder({
        subtotal: 41.97,
        tax: 2.94,
        total: 44.91,
        items: [
          {
            productId: 'prod_1',
            productName: 'Black Bean & Corn',
            productSku: 'JMS-BBC',
            quantity: 3,
            unitPrice: 6.99,
            totalPrice: 20.97,
          },
          {
            productId: 'prod_2',
            productName: 'Roasted Garlic',
            productSku: 'JMS-RGL',
            quantity: 3,
            unitPrice: 7,
            totalPrice: 21,
          },
        ],
      }),
      customerId: '55',
      itemIds,
      settings,
    })

    expect(result.ok).toBe(true)
  })
})

describe('buildRefundReceipt', () => {
  const refundBase = (amount: number, orderOverrides = {}) => ({
    id: 'ref_1',
    amount,
    reason: 'Damaged in transit',
    createdAt: new Date(2026, 6, 25),
    order: baseOrder(orderOverrides),
  })

  it('mirrors the original lines for a full refund', () => {
    const result = buildRefundReceipt({
      refund: refundBase(24),
      customerId: '55',
      itemIds,
      settings,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.payload.Line).toHaveLength(1)
    expect(result.payload.Line[0].Amount).toBe(24)
    expect(result.payload.DocNumber).toBe('R-JMS-1001')
  })

  it('refunds shipping too on a whole-order reversal', () => {
    const result = buildRefundReceipt({
      refund: refundBase(32.5, { shippingCost: 8.5, total: 32.5 }),
      customerId: '55',
      itemIds,
      settings,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.payload.Line).toHaveLength(2)
    expect(result.payload.Line[1].Description).toBe('Shipping')
  })

  it('books a partial refund against the designated refund item', () => {
    const result = buildRefundReceipt({
      refund: refundBase(10),
      customerId: '55',
      itemIds,
      settings: { ...settings, refundItemId: '33' },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.payload.Line).toHaveLength(1)
    expect(result.payload.Line[0].Amount).toBe(10)
    expect(result.payload.Line[0].SalesItemLineDetail.ItemRef).toEqual({ value: '33' })
  })

  it('refuses a partial refund when no refund item is mapped', () => {
    const result = buildRefundReceipt({
      refund: refundBase(10),
      customerId: '55',
      itemIds,
      settings: { ...settings, refundItemId: null },
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toContain('refund item')
  })

  it('refuses a refund larger than the order total', () => {
    const result = buildRefundReceipt({
      refund: refundBase(99),
      customerId: '55',
      itemIds,
      settings: { ...settings, refundItemId: '33' },
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toContain('exceeds the order total')
  })

  it('refuses a zero refund', () => {
    const result = buildRefundReceipt({
      refund: refundBase(0),
      customerId: '55',
      itemIds,
      settings,
    })

    expect(result.ok).toBe(false)
  })
})
