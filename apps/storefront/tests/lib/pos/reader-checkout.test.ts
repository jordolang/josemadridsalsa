import { beforeEach, describe, expect, it, vi } from 'vitest'

const { square, db, inventory } = vi.hoisted(() => ({
  square: { get: vi.fn(), list: vi.fn() },
  db: {
    orderFindUnique: vi.fn(),
    orderUpdate: vi.fn(),
    orderCreate: vi.fn(),
    paymentFindUnique: vi.fn(),
    paymentCreate: vi.fn(),
    productFindMany: vi.fn(),
  },
  inventory: { deduct: vi.fn(), release: vi.fn(), reserve: vi.fn() },
}))

vi.mock('square', () => ({
  SquareEnvironment: { Sandbox: 'sandbox', Production: 'production' },
  SquareClient: class {
    payments = { get: square.get, list: square.list }
  },
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    order: { findUnique: db.orderFindUnique, update: db.orderUpdate, create: db.orderCreate, updateMany: vi.fn() },
    payment: { findUnique: db.paymentFindUnique },
    product: { findMany: db.productFindMany },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ order: { update: db.orderUpdate }, payment: { create: db.paymentCreate } }),
  },
}))
vi.mock('@/lib/inventory-manager', () => ({
  deductReservedInventoryInTx: (...a: unknown[]) => inventory.deduct(...a),
  releaseOrderReservation: (...a: unknown[]) => inventory.release(...a),
  reserveMultipleProducts: (...a: unknown[]) => inventory.reserve(...a),
  checkAndUpdateAlerts: vi.fn(),
  releaseInventory: vi.fn(),
}))
vi.mock('@/lib/orders/events', () => ({ emitOrderCreated: vi.fn() }))
vi.mock('@/lib/domain-events/emit', () => ({ emitDomainEvent: vi.fn() }))

import {
  cancelReaderOrder,
  confirmReaderPayment,
  createReaderOrder,
  readerPaymentProblem,
  totalCents,
} from '@/lib/pos/reader-checkout'

const order = (paymentStatus = 'PENDING') => ({
  id: 'o1',
  orderNumber: 'KIOSK-ABC123',
  userId: null,
  paymentStatus,
  paymentChannel: 'POS',
  total: { toString: () => '32.00' },
  createdAt: new Date('2026-10-02T15:00:00Z'),
  items: [{ productId: 'p1', quantity: 4 }],
})

const squarePayment = (overrides: Record<string, unknown> = {}) => ({
  id: 'pay_1',
  status: 'COMPLETED',
  referenceId: 'o1',
  locationId: 'LOC1',
  amountMoney: { amount: 3200n, currency: 'USD' },
  ...overrides,
})

/** `payments.list` returns an async-iterable page. */
const pageOf = (items: unknown[]) => ({
  async *[Symbol.asyncIterator]() {
    yield* items
  },
})

beforeEach(() => {
  vi.stubEnv('SQUARE_ACCESS_TOKEN', 'server-token')
  vi.stubEnv('SQUARE_LOCATION_ID', 'LOC1')
  for (const group of [square, db, inventory]) Object.values(group).forEach((f) => f.mockReset())
  inventory.deduct.mockResolvedValue({ newInventory: 5, product: { lowStockThreshold: 2 } })
  db.paymentFindUnique.mockResolvedValue(null)
  square.list.mockResolvedValue(pageOf([]))
})

describe('readerPaymentProblem', () => {
  const o = { id: 'o1', total: { toString: () => '32.00' } }

  it('accepts a completed payment for this order, location and amount', () => {
    expect(readerPaymentProblem(squarePayment(), o, 'LOC1')).toBeNull()
  })

  it.each([
    ['no payment', undefined, 'no record'],
    ['not completed', squarePayment({ status: 'APPROVED' }), 'approved'],
    ['another order', squarePayment({ referenceId: 'o2' }), 'different order'],
    ['another location', squarePayment({ locationId: 'LOC2' }), 'different Square location'],
    ['short by a cent', squarePayment({ amountMoney: { amount: 3199n, currency: 'USD' } }), 'does not match'],
    ['wrong currency', squarePayment({ amountMoney: { amount: 3200n, currency: 'CAD' } }), 'US dollars'],
  ])('refuses %s', (_label, payment, reason) => {
    expect(readerPaymentProblem(payment as never, o, 'LOC1')).toContain(reason)
  })

  it('refuses everything when no location is configured', () => {
    expect(readerPaymentProblem(squarePayment(), o, undefined)).toContain('different Square location')
  })

  it('reads Decimal totals as cents without float drift', () => {
    expect(totalCents({ toString: () => '19.99' })).toBe(1999)
    expect(totalCents({ toString: () => '0.10' })).toBe(10)
  })
})

describe('confirmReaderPayment', () => {
  it('marks the order paid only after Square confirms the payment', async () => {
    db.orderFindUnique.mockResolvedValue(order())
    square.get.mockResolvedValue({ payment: squarePayment() })

    await expect(confirmReaderPayment('o1', 'pay_1')).resolves.toEqual({ status: 'COMPLETED', orderNumber: 'KIOSK-ABC123' })
    expect(square.get).toHaveBeenCalledWith({ paymentId: 'pay_1' })
    expect(db.paymentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ squarePaymentId: 'pay_1', amount: 3200, methodType: 'SQUARE_READER', channel: 'POS' }),
    })
    expect(db.orderUpdate).toHaveBeenCalledWith({ where: { id: 'o1' }, data: { paymentStatus: 'PAID', status: 'CONFIRMED' } })
    expect(inventory.deduct).toHaveBeenCalledTimes(1)
  })

  it('refuses a payment for a smaller amount, whatever the iPad says', async () => {
    db.orderFindUnique.mockResolvedValue(order())
    square.get.mockResolvedValue({ payment: squarePayment({ amountMoney: { amount: 100n, currency: 'USD' } }) })

    await expect(confirmReaderPayment('o1', 'pay_1')).rejects.toThrow('does not match')
    expect(db.paymentCreate).not.toHaveBeenCalled()
  })

  it('refuses a payment already used for another order', async () => {
    db.orderFindUnique.mockResolvedValue(order())
    square.get.mockResolvedValue({ payment: squarePayment() })
    db.paymentFindUnique.mockResolvedValue({ orderId: 'other' })

    await expect(confirmReaderPayment('o1', 'pay_1')).rejects.toThrow('already used')
    expect(db.paymentCreate).not.toHaveBeenCalled()
  })

  it('is a no-op for an order already paid', async () => {
    db.orderFindUnique.mockResolvedValue(order('PAID'))
    await expect(confirmReaderPayment('o1', 'pay_1')).resolves.toMatchObject({ status: 'COMPLETED' })
    expect(square.get).not.toHaveBeenCalled()
  })

  it('finds the payment by its order reference when the iPad lost the id', async () => {
    db.orderFindUnique.mockResolvedValue(order())
    square.list.mockResolvedValue(pageOf([squarePayment({ id: 'pay_x', referenceId: 'other' }), squarePayment()]))

    await expect(confirmReaderPayment('o1')).resolves.toMatchObject({ status: 'COMPLETED' })
    expect(square.list).toHaveBeenCalledWith(expect.objectContaining({ locationId: 'LOC1' }))
    expect(db.paymentCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ squarePaymentId: 'pay_1' }) })
  })

  it('reports PENDING when Square has no payment for the order yet', async () => {
    db.orderFindUnique.mockResolvedValue(order())
    await expect(confirmReaderPayment('o1')).resolves.toMatchObject({ status: 'PENDING' })
  })

  it('will not touch an online order', async () => {
    db.orderFindUnique.mockResolvedValue({ ...order(), paymentChannel: 'ONLINE' })
    await expect(confirmReaderPayment('o1', 'pay_1')).rejects.toThrow('Order not found')
  })
})

describe('cancelReaderOrder', () => {
  it('releases the stock when no payment went through', async () => {
    db.orderFindUnique.mockResolvedValue(order())

    await expect(cancelReaderOrder('o1')).resolves.toMatchObject({ status: 'CANCELED' })
    expect(inventory.release).toHaveBeenCalledWith('o1', expect.any(String))
    expect(db.orderUpdate).toHaveBeenCalledWith({ where: { id: 'o1' }, data: { paymentStatus: 'FAILED', status: 'CANCELLED' } })
  })

  it('completes the sale instead when Square shows the card was charged', async () => {
    db.orderFindUnique.mockResolvedValue(order())
    square.list.mockResolvedValue(pageOf([squarePayment()]))
    square.get.mockResolvedValue({ payment: squarePayment() })

    await expect(cancelReaderOrder('o1')).resolves.toMatchObject({ status: 'COMPLETED' })
    expect(inventory.release).not.toHaveBeenCalled()
    expect(db.paymentCreate).toHaveBeenCalled()
  })
})

describe('createReaderOrder', () => {
  const sale = {
    items: [{ productId: 'p1', name: 'Peach', unitPriceCents: 1000, quantity: 4 }],
    discountCents: 800,
    taxCents: 0,
    totalCents: 3200,
    orderNumber: 'KIOSK-ABC123',
    orderPrefix: 'KIOSK' as const,
  }

  it('reuses the order a retried attempt already created', async () => {
    db.orderFindUnique.mockResolvedValue({ id: 'o1', paymentStatus: 'PENDING' })
    await expect(createReaderOrder(sale)).resolves.toEqual({ orderId: 'o1', alreadyPaid: false })
    expect(inventory.reserve).not.toHaveBeenCalled()
  })

  it('says so when the retried attempt was already paid', async () => {
    db.orderFindUnique.mockResolvedValue({ id: 'o1', paymentStatus: 'PAID' })
    await expect(createReaderOrder(sale)).resolves.toEqual({ orderId: 'o1', alreadyPaid: true })
  })

  it('holds the stock and records a new order, with no Square Terminal involved', async () => {
    db.orderFindUnique.mockResolvedValue(null)
    db.productFindMany.mockResolvedValue([{ id: 'p1', costPrice: null }])
    db.orderCreate.mockResolvedValue({ id: 'o9', orderNumber: 'KIOSK-ABC123', total: 32, salesChannel: 'POS' })

    await expect(createReaderOrder(sale)).resolves.toEqual({ orderId: 'o9', alreadyPaid: false })
    expect(inventory.reserve).toHaveBeenCalledWith([expect.objectContaining({ productId: 'p1', quantity: 4 })])
    expect(db.orderCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ orderNumber: 'KIOSK-ABC123', paymentStatus: 'PENDING', paymentChannel: 'POS' }),
    })
  })
})
