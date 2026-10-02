import { beforeEach, describe, expect, it, vi } from 'vitest'

const { db, inventory, events } = vi.hoisted(() => ({
  db: { orderCreate: vi.fn(), paymentCreate: vi.fn(), findMany: vi.fn() },
  inventory: { adjust: vi.fn(), alerts: vi.fn() },
  events: { orderCreated: vi.fn(), domain: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    product: { findMany: db.findMany },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ order: { create: db.orderCreate }, payment: { create: db.paymentCreate } }),
  },
}))
vi.mock('@/lib/inventory-manager', () => ({
  bulkAdjustInventoryInTx: (...a: unknown[]) => inventory.adjust(...a),
  checkAndUpdateAlerts: (...a: unknown[]) => inventory.alerts(...a),
}))
vi.mock('@/lib/orders/events', () => ({ emitOrderCreated: events.orderCreated }))
vi.mock('@/lib/domain-events/emit', () => ({ emitDomainEvent: events.domain }))

import { CashSaleError, recordCashSale } from '@/lib/pos/cash-sale'

const items = [{ productId: 'p1', name: 'Mild', sku: 'M1', unitPriceCents: 1000, quantity: 2 }]

beforeEach(() => {
  vi.clearAllMocks()
  db.findMany.mockResolvedValue([{ id: 'p1', costPrice: 2.32 }])
  db.orderCreate.mockResolvedValue({ id: 'o1', orderNumber: 'POS-20261002-1234', total: 21.45 })
  inventory.adjust.mockResolvedValue([{ product: { id: 'p1', lowStockThreshold: 3 }, newStock: 8 }])
})

describe('recordCashSale', () => {
  it('records a paid order, a cash payment and a stock deduction', async () => {
    const result = await recordCashSale({ items, taxCents: 145, totalCents: 2145, tenderedCents: 3000, userId: 'u1' })

    expect(result).toEqual({ orderId: 'o1', orderNumber: 'POS-20261002-1234', changeCents: 855 })
    expect(db.orderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentStatus: 'PAID', salesChannel: 'POS', paymentMethod: 'cash' }),
      })
    )
    expect(db.paymentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ orderId: 'o1', amount: 2145, status: 'SUCCEEDED', methodType: 'CASH' }),
    })
    expect(inventory.adjust).toHaveBeenCalledWith(
      [expect.objectContaining({ productId: 'p1', quantity: -2, type: 'SALE', orderId: 'o1' })],
      expect.anything()
    )
    expect(inventory.alerts).toHaveBeenCalledWith('p1', 8, 3)
    expect(events.orderCreated).toHaveBeenCalled()
  })

  it('refuses a total that does not add up', async () => {
    await expect(
      recordCashSale({ items, taxCents: 145, totalCents: 100, tenderedCents: 3000 })
    ).rejects.toBeInstanceOf(CashSaleError)
    expect(db.orderCreate).not.toHaveBeenCalled()
  })

  it('refuses when less cash is tendered than owed', async () => {
    await expect(
      recordCashSale({ items, taxCents: 145, totalCents: 2145, tenderedCents: 2000 })
    ).rejects.toThrow('less than the total')
  })

  it('surfaces a stock shortfall as a 400', async () => {
    inventory.adjust.mockRejectedValue(new Error('Insufficient inventory for Mild (SKU: M1). Current: 1, Requested: 2'))

    await expect(
      recordCashSale({ items, taxCents: 145, totalCents: 2145, tenderedCents: 3000 })
    ).rejects.toMatchObject({ status: 400 })
    expect(events.orderCreated).not.toHaveBeenCalled()
  })
})
