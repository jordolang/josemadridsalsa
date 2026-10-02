import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'

const { db, inventory, events, tax } = vi.hoisted(() => ({
  db: { orderCreate: vi.fn(), orderFindUnique: vi.fn(), paymentCreate: vi.fn(), findMany: vi.fn() },
  inventory: { adjust: vi.fn(), alerts: vi.fn() },
  events: { orderCreated: vi.fn(), domain: vi.fn() },
  tax: { quote: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    order: { findUnique: db.orderFindUnique },
    product: { findMany: db.findMany },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ order: { create: db.orderCreate }, payment: { create: db.paymentCreate } }),
  },
}))
vi.mock('@/lib/inventory-manager', () => ({
  bulkAdjustInventoryInTx: (...a: unknown[]) => inventory.adjust(...a),
  checkAndUpdateAlerts: (...a: unknown[]) => inventory.alerts(...a),
  withSerializableRetry: (fn: () => Promise<unknown>) => fn(),
}))
vi.mock('@/lib/orders/events', () => ({ emitOrderCreated: events.orderCreated }))
vi.mock('@/lib/domain-events/emit', () => ({ emitDomainEvent: events.domain }))
vi.mock('@/lib/pos/tax', () => ({ quotePosTaxCents: (...a: unknown[]) => tax.quote(...a) }))

import { CashSaleError, recordCashSale } from '@/lib/pos/cash-sale'

const attemptId = '0f8fad5b-d9cb-469f-a165-70867728950e'
const ORDER_NUMBER = 'POS-0F8FAD5BD9CB'
const items = [{ productId: 'p1', quantity: 2 }]
const sale = { items, totalCents: 2145, tenderedCents: 3000, attemptId, userId: 'cashier' }

beforeEach(() => {
  vi.clearAllMocks()
  db.orderFindUnique.mockResolvedValue(null)
  db.findMany.mockResolvedValue([{ id: 'p1', name: 'Mild', sku: 'M1', price: 10, costPrice: 2.32 }])
  db.orderCreate.mockResolvedValue({ id: 'o1', orderNumber: ORDER_NUMBER, total: 21.45 })
  inventory.adjust.mockResolvedValue([{ product: { id: 'p1', lowStockThreshold: 3 }, newStock: 8 }])
  tax.quote.mockResolvedValue(145)
})

describe('recordCashSale', () => {
  it('records a paid order, a cash payment and a stock deduction', async () => {
    const result = await recordCashSale(sale)

    expect(result).toEqual({ orderId: 'o1', orderNumber: ORDER_NUMBER, changeCents: 855 })
    const order = db.orderCreate.mock.calls[0][0].data
    expect(order).toMatchObject({ orderNumber: ORDER_NUMBER, paymentStatus: 'PAID', salesChannel: 'POS' })
    // The cashier is not the customer: their account must not collect walk-in orders.
    expect(order.userId).toBeUndefined()
    expect(order.items.create[0]).toMatchObject({ productName: 'Mild', productSku: 'M1' })
    expect(db.paymentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ orderId: 'o1', amount: 2145, status: 'SUCCEEDED', methodType: 'CASH' }),
    })
    expect(inventory.adjust).toHaveBeenCalledWith(
      [expect.objectContaining({ productId: 'p1', quantity: -2, type: 'SALE', orderId: 'o1', userId: 'cashier' })],
      expect.anything()
    )
    expect(inventory.alerts).toHaveBeenCalledWith('p1', 8, 3)
  })

  it('returns the recorded sale when the same attempt is retried', async () => {
    db.orderFindUnique.mockResolvedValue({ id: 'o1' })

    await expect(recordCashSale(sale)).resolves.toMatchObject({ orderId: 'o1', orderNumber: ORDER_NUMBER })
    expect(db.orderCreate).not.toHaveBeenCalled()
  })

  it('returns the other request’s sale when a duplicate loses the race', async () => {
    db.orderCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'x' })
    )
    db.orderFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'o1' })

    await expect(recordCashSale(sale)).resolves.toMatchObject({ orderId: 'o1' })
  })

  it('refuses a total that no longer matches current prices', async () => {
    db.findMany.mockResolvedValue([{ id: 'p1', name: 'Mild', sku: 'M1', price: 12, costPrice: null }])

    await expect(recordCashSale(sale)).rejects.toMatchObject({ status: 409 })
    expect(db.orderCreate).not.toHaveBeenCalled()
  })

  it('quotes tax from the server-priced lines and refuses a register total built on other tax', async () => {
    tax.quote.mockResolvedValue(0)

    await expect(recordCashSale(sale)).rejects.toMatchObject({ status: 409 })
    expect(tax.quote).toHaveBeenCalledWith([{ productId: 'p1', unitPriceCents: 1000, quantity: 2 }])
    expect(db.orderCreate).not.toHaveBeenCalled()
  })

  it('does not re-quote tax when a recorded attempt is retried', async () => {
    db.orderFindUnique.mockResolvedValue({ id: 'o1' })

    await recordCashSale(sale)
    expect(tax.quote).not.toHaveBeenCalled()
  })

  it('refuses an item that is not an active product', async () => {
    db.findMany.mockResolvedValue([])

    await expect(recordCashSale(sale)).rejects.toBeInstanceOf(CashSaleError)
  })

  it('refuses when less cash is tendered than owed', async () => {
    await expect(recordCashSale({ ...sale, tenderedCents: 2000 })).rejects.toThrow('less than the total')
  })

  it('surfaces a stock shortfall as a 400', async () => {
    inventory.adjust.mockRejectedValue(new Error('Insufficient inventory for Mild (SKU: M1). Current: 1, Requested: 2'))

    await expect(recordCashSale(sale)).rejects.toMatchObject({ status: 400 })
    expect(events.orderCreated).not.toHaveBeenCalled()
  })
})
