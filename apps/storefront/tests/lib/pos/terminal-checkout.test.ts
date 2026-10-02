import { beforeEach, describe, expect, it, vi } from 'vitest'

const { square, db, inventory } = vi.hoisted(() => ({
  square: { get: vi.fn(), cancel: vi.fn() },
  db: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), payment: vi.fn(), transaction: vi.fn() },
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
    order: { findFirst: db.findFirst, findUnique: db.findUnique, update: db.update },
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

import { cancelTerminalCheckout, createTerminalCheckout, syncTerminalCheckout } from '@/lib/pos/terminal-checkout'

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

describe('Terminal edge cases', () => {
  it('finds the order after the payment webhook rewrote its provider id', async () => {
    square.get.mockResolvedValue({ checkout: { status: 'COMPLETED', referenceId: 'o1', paymentIds: ['pay_3'], amountMoney: { amount: 1000n } } })
    db.findFirst.mockResolvedValue(order('PAID'))
    await syncTerminalCheckout('chk_3')
    expect(db.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { OR: [{ providerPaymentId: 'chk_3' }, { id: 'o1' }] } }))
  })

  it('keeps a cancel-requested checkout open and its stock reserved', async () => {
    square.get.mockResolvedValue({ checkout: { status: 'CANCEL_REQUESTED', amountMoney: { amount: 1000n } } })
    db.findFirst.mockResolvedValue(order('PENDING'))
    await expect(syncTerminalCheckout('chk_4')).resolves.toMatchObject({ status: 'IN_PROGRESS' })
    expect(inventory.release).not.toHaveBeenCalled()
  })

  it('reports a failed cancel while the checkout is still payable', async () => {
    square.cancel.mockRejectedValue(new Error('network down'))
    square.get.mockResolvedValue({ checkout: { status: 'IN_PROGRESS', amountMoney: { amount: 1000n } } })
    db.findFirst.mockResolvedValue(order('PENDING'))
    await expect(cancelTerminalCheckout('chk_5')).rejects.toThrow('network down')
  })
})

describe('createTerminalCheckout retries', () => {
  const attemptId = '3f9a1c2b-0000-4000-8000-000000000000'
  const input = {
    items: [{ productId: 'p1', name: 'Mild', unitPriceCents: 1000, quantity: 1 }],
    totalCents: 1000,
    deviceId: 'dev_1',
    orderPrefix: 'KIOSK' as const,
    attemptId,
  }

  it('returns the checkout already sent instead of creating a second one', async () => {
    db.findUnique.mockResolvedValue({ id: 'o1', providerPaymentId: 'chk_9', paymentStatus: 'PENDING' })
    const result = await createTerminalCheckout(input)
    expect(result).toMatchObject({ checkoutId: 'chk_9', orderId: 'o1', alreadyPaid: false })
    expect(db.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { orderNumber: result.orderNumber } }))
  })

  it('gives the same order number for the same attempt on any day', async () => {
    db.findUnique.mockResolvedValue({ id: 'o1', providerPaymentId: 'chk_9', paymentStatus: 'PENDING' })
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-02T23:59:59Z'))
    const before = await createTerminalCheckout(input)
    vi.setSystemTime(new Date('2026-10-03T00:00:01Z'))
    const after = await createTerminalCheckout(input)
    vi.useRealTimers()
    expect(before.orderNumber).toBe('KIOSK-3F9A1C2B0000')
    expect(after.orderNumber).toBe(before.orderNumber)
  })

  it('reports an attempt the customer already paid for instead of a checkout to poll', async () => {
    db.findUnique.mockResolvedValue({ id: 'o1', providerPaymentId: 'pay_1', paymentStatus: 'PAID' })
    await expect(createTerminalCheckout(input)).resolves.toMatchObject({ orderId: 'o1', alreadyPaid: true })
  })

  it('asks for a moment when the first attempt has not reached Square yet', async () => {
    db.findUnique.mockResolvedValue({ id: 'o1', providerPaymentId: null, paymentStatus: 'PENDING' })
    await expect(createTerminalCheckout(input)).rejects.toMatchObject({ status: 409 })
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
