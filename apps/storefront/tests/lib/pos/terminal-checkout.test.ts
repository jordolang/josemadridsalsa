import { beforeEach, describe, expect, it, vi } from 'vitest'

const { square, db, inventory } = vi.hoisted(() => ({
  square: { get: vi.fn(), cancel: vi.fn() },
  db: { findFirst: vi.fn(), update: vi.fn(), payment: vi.fn(), transaction: vi.fn() },
  inventory: { deduct: vi.fn(), release: vi.fn() },
}))

vi.mock('square', () => ({
  SquareEnvironment: { Sandbox: 'sandbox', Production: 'production' },
  SquareClient: class {
    terminal = { checkouts: { get: square.get, cancel: square.cancel } }
  },
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    order: { findFirst: db.findFirst, update: db.update },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => {
      db.transaction()
      return fn({ order: { update: db.update }, payment: { create: db.payment } })
    },
  },
}))
vi.mock('@/lib/inventory-manager', () => ({
  deductReservedInventoryInTx: (...a: unknown[]) => inventory.deduct(...a),
  releaseOrderReservation: (...a: unknown[]) => inventory.release(...a),
  checkAndUpdateAlerts: vi.fn(),
  releaseInventory: vi.fn(),
  reserveMultipleProducts: vi.fn(),
}))
vi.mock('@/lib/orders/events', () => ({ emitOrderCreated: vi.fn() }))
vi.mock('@/lib/domain-events/emit', () => ({ emitDomainEvent: vi.fn() }))

import { cancelTerminalCheckout, syncTerminalCheckout } from '@/lib/pos/terminal-checkout'

const order = (paymentStatus: string) => ({
  id: 'o1',
  orderNumber: 'KIOSK-20261001-1234',
  userId: null,
  paymentStatus,
  status: 'PENDING',
  total: 32,
  items: [{ id: 'i1', productId: 'p1', quantity: 4, unitPrice: 10, totalPrice: 40 }],
})

beforeEach(() => {
  vi.stubEnv('SQUARE_ACCESS_TOKEN', 'test-token')
  Object.values(square).forEach((f) => f.mockReset())
  Object.values(db).forEach((f) => f.mockReset())
  Object.values(inventory).forEach((f) => f.mockReset())
  inventory.deduct.mockResolvedValue({ newInventory: 5, product: { lowStockThreshold: 2 } })
})

describe('syncTerminalCheckout', () => {
  it('records a completed checkout as paid and deducts stock once', async () => {
    square.get.mockResolvedValue({ checkout: { status: 'COMPLETED', paymentIds: ['pay_1'], amountMoney: { amount: 3200n } } })
    db.findFirst.mockResolvedValue(order('PENDING'))

    await expect(syncTerminalCheckout('chk_1')).resolves.toMatchObject({ status: 'COMPLETED', orderNumber: 'KIOSK-20261001-1234' })
    expect(db.payment).toHaveBeenCalledWith({ data: expect.objectContaining({ squarePaymentId: 'pay_1', amount: 3200 }) })
    expect(inventory.deduct).toHaveBeenCalledTimes(1)

    db.findFirst.mockResolvedValue(order('PAID'))
    await syncTerminalCheckout('chk_1')
    expect(db.transaction).toHaveBeenCalledTimes(1)
  })

  it('releases stock when the customer cancels on the Terminal', async () => {
    square.get.mockResolvedValue({ checkout: { status: 'CANCELED', amountMoney: { amount: 3200n } } })
    db.findFirst.mockResolvedValue(order('PENDING'))

    await expect(syncTerminalCheckout('chk_1')).resolves.toMatchObject({ status: 'CANCELED' })
    expect(inventory.release).toHaveBeenCalledWith('o1', expect.any(String))
    expect(db.update).toHaveBeenCalledWith({ where: { id: 'o1' }, data: { paymentStatus: 'FAILED', status: 'CANCELLED' } })
  })
})

describe('cancelTerminalCheckout', () => {
  it('keeps a sale the customer paid for just before cancel landed', async () => {
    square.cancel.mockRejectedValue(new Error('Checkout already completed'))
    square.get.mockResolvedValue({ checkout: { status: 'COMPLETED', paymentIds: ['pay_2'], amountMoney: { amount: 1000n } } })
    db.findFirst.mockResolvedValue(order('PENDING'))

    await expect(cancelTerminalCheckout('chk_2')).resolves.toMatchObject({ status: 'COMPLETED' })
    expect(db.payment).toHaveBeenCalled()
    expect(inventory.release).not.toHaveBeenCalled()
  })
})
