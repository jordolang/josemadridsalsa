import { beforeEach, describe, expect, it, vi } from 'vitest'

const tx = vi.hoisted(() => ({
  order: { updateMany: vi.fn() },
  payment: { create: vi.fn() },
}))
const db = vi.hoisted(() => ({
  order: { findUnique: vi.fn(), updateMany: vi.fn() },
  payment: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}))
const square = vi.hoisted(() => ({ get: vi.fn() }))
const findOrderPayment = vi.hoisted(() => vi.fn())
const creditFundraiserCommission = vi.hoisted(() => vi.fn())
const emitDomainEvent = vi.hoisted(() => vi.fn())
const getSquareReaderToken = vi.hoisted(() => vi.fn())

vi.mock('@/lib/prisma', () => ({ prisma: db, default: db }))
vi.mock('@/lib/pos/terminal-checkout', () => ({ getSquareClient: () => ({ payments: { get: square.get } }) }))
vi.mock('@/lib/pos/reader-checkout', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/pos/reader-checkout')>()),
  findOrderPayment,
}))
vi.mock('@/lib/fundraising/credit-commission', () => ({ creditFundraiserCommission }))
vi.mock('@/lib/domain-events/emit', () => ({ emitDomainEvent }))
vi.mock('@/lib/square/oauth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/square/oauth')>()),
  getSquareReaderToken,
}))

const { cancelCardOrder, confirmCardPayment, settleFundraiserAppPaymentFromWebhook, squareAuthorizationFor } =
  await import('@/lib/fundraiser-app/card-payments')
const { FundraiserAppError } = await import('@/lib/fundraiser-app/errors')
const { SquareOAuthError } = await import('@/lib/square/oauth')

type Session = Parameters<typeof confirmCardPayment>[0]
const sessionWith = (appCardPayments = true) =>
  ({ id: 's_1', participant: { id: 'p_1', fundraiser: { id: 'f_1', appCardPayments } } }) as unknown as Session
const session = sessionWith()

const cardOrder = (overrides: Record<string, unknown> = {}) => ({
  id: 'o_1',
  orderNumber: 'APP-ABC',
  participantId: 'p_1',
  paymentStatus: 'PENDING',
  paymentProvider: 'SQUARE',
  total: 46,
  createdAt: new Date('2026-10-03T12:00:00Z'),
  ...overrides,
})

const squarePayment = (overrides: Record<string, unknown> = {}) => ({
  id: 'sq_pay_1',
  status: 'COMPLETED',
  referenceId: 'o_1',
  locationId: 'LOC_1',
  amountMoney: { amount: BigInt(4600), currency: 'USD' },
  ...overrides,
})

async function expectAppError(promise: Promise<unknown>, status: number) {
  const error = await promise.catch((e) => e)
  expect(error).toBeInstanceOf(FundraiserAppError)
  expect(error.status).toBe(status)
  return error as InstanceType<typeof FundraiserAppError>
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.SQUARE_LOCATION_ID = 'LOC_1'
  process.env.SQUARE_ACCESS_TOKEN = 'server-token'
  db.order.findUnique.mockResolvedValue(cardOrder())
  db.order.updateMany.mockResolvedValue({ count: 1 })
  db.payment.findUnique.mockResolvedValue(null)
  db.$transaction.mockImplementation((fn: (client: typeof tx) => unknown) => fn(tx))
  tx.order.updateMany.mockResolvedValue({ count: 1 })
  square.get.mockResolvedValue({ payment: squarePayment() })
})

describe('squareAuthorizationFor', () => {
  it('hands the phone a Square token and the location, only with card payments on', async () => {
    getSquareReaderToken.mockResolvedValue({ accessToken: 'EAAA-token', expiresAt: '2026-11-01T00:00:00Z' })
    await expect(squareAuthorizationFor(session)).resolves.toEqual({
      accessToken: 'EAAA-token',
      expiresAt: '2026-11-01T00:00:00Z',
      locationId: 'LOC_1',
    })
    await expectAppError(squareAuthorizationFor(sessionWith(false)), 403)
  })

  it('says so when Square is not connected or no location is set', async () => {
    getSquareReaderToken.mockRejectedValue(new SquareOAuthError('Square is not connected'))
    await expectAppError(squareAuthorizationFor(session), 503)
    delete process.env.SQUARE_LOCATION_ID
    await expectAppError(squareAuthorizationFor(session), 503)
  })
})

describe('confirmCardPayment', () => {
  it("marks the order paid from Square's own record, credits the group and announces the payment", async () => {
    const result = await confirmCardPayment(session, 'o_1', 'sq_pay_1')

    expect(square.get).toHaveBeenCalledWith({ paymentId: 'sq_pay_1' })
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'o_1', paymentStatus: { in: ['PENDING', 'FAILED'] } },
      data: { paymentStatus: 'PAID', status: 'CONFIRMED' },
    })
    expect(tx.payment.create.mock.calls[0][0].data).toMatchObject({
      squarePaymentId: 'sq_pay_1',
      orderId: 'o_1',
      amount: 4600,
      provider: 'SQUARE',
      channel: 'POS',
      status: 'SUCCEEDED',
    })
    expect(creditFundraiserCommission).toHaveBeenCalledWith(tx, 'o_1')
    expect(emitDomainEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'payment.completed', entityId: 'o_1' }), tx)
    expect(result).toEqual({ status: 'COMPLETED', orderNumber: 'APP-ABC' })
  })

  it.each([
    ['not completed', { status: 'APPROVED' }],
    ['for another order', { referenceId: 'o_other' }],
    ['at another location', { locationId: 'LOC_2' }],
    ['for the wrong amount', { amountMoney: { amount: BigInt(100), currency: 'USD' } }],
  ])('refuses a payment %s', async (_label, overrides) => {
    square.get.mockResolvedValue({ payment: squarePayment(overrides) })
    await expectAppError(confirmCardPayment(session, 'o_1', 'sq_pay_1'), 409)
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('refuses a payment already used for another order', async () => {
    db.payment.findUnique.mockResolvedValue({ orderId: 'o_other' })
    await expectAppError(confirmCardPayment(session, 'o_1', 'sq_pay_1'), 409)
  })

  it('says card payments are not set up when the storefront has no Square credentials', async () => {
    delete process.env.SQUARE_ACCESS_TOKEN
    const error = await expectAppError(confirmCardPayment(session, 'o_1', 'sq_pay_1'), 503)
    expect(error.message).toMatch(/not set up/)
    await expectAppError(cancelCardOrder(session, 'o_1'), 503)
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it("will not settle another seller's order", async () => {
    db.order.findUnique.mockResolvedValue(cardOrder({ participantId: 'p_other' }))
    await expectAppError(confirmCardPayment(session, 'o_1', 'sq_pay_1'), 404)
  })

  it('settles an order once when two confirmations race', async () => {
    tx.order.updateMany.mockResolvedValue({ count: 0 })
    db.order.findUnique.mockResolvedValueOnce(cardOrder()).mockResolvedValueOnce({ paymentStatus: 'PAID' })
    await expect(confirmCardPayment(session, 'o_1', 'sq_pay_1')).resolves.toMatchObject({ status: 'COMPLETED' })
    expect(tx.payment.create).not.toHaveBeenCalled()
    expect(creditFundraiserCommission).not.toHaveBeenCalled()
  })

  it('still records a payment that completed after the app canceled the order', async () => {
    db.order.findUnique.mockResolvedValue(cardOrder({ paymentStatus: 'FAILED' }))
    await expect(confirmCardPayment(session, 'o_1', 'sq_pay_1')).resolves.toMatchObject({ status: 'COMPLETED' })
    expect(tx.payment.create).toHaveBeenCalledOnce()
  })

  it('says a canceled order with no Square payment is canceled', async () => {
    db.order.findUnique.mockResolvedValue(cardOrder({ paymentStatus: 'FAILED' }))
    findOrderPayment.mockResolvedValueOnce(undefined)
    const error = await expectAppError(confirmCardPayment(session, 'o_1'), 409)
    expect(error.message).toMatch(/canceled/)
  })

  it('finds the payment in Square when the phone lost the payment id', async () => {
    findOrderPayment.mockResolvedValueOnce(undefined)
    await expect(confirmCardPayment(session, 'o_1')).resolves.toMatchObject({ status: 'PENDING' })

    findOrderPayment.mockResolvedValueOnce(squarePayment())
    await expect(confirmCardPayment(session, 'o_1')).resolves.toMatchObject({ status: 'COMPLETED' })
  })
})

describe('cancelCardOrder', () => {
  it('cancels when Square has no payment for the order', async () => {
    findOrderPayment.mockResolvedValue(undefined)
    await expect(cancelCardOrder(session, 'o_1')).resolves.toMatchObject({ status: 'CANCELED' })
    expect(db.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'o_1', paymentStatus: 'PENDING' },
      data: { paymentStatus: 'FAILED', status: 'CANCELLED' },
    })
  })

  it('reports paid, not canceled, when a confirmation won the race', async () => {
    findOrderPayment.mockResolvedValue(undefined)
    db.order.updateMany.mockResolvedValue({ count: 0 })
    db.order.findUnique.mockResolvedValueOnce(cardOrder()).mockResolvedValueOnce({ paymentStatus: 'PAID' })
    await expect(cancelCardOrder(session, 'o_1')).resolves.toMatchObject({ status: 'COMPLETED' })
  })

  it('settles instead when the card went through after all', async () => {
    findOrderPayment.mockResolvedValue(squarePayment())
    await expect(cancelCardOrder(session, 'o_1')).resolves.toMatchObject({ status: 'COMPLETED' })
    expect(db.order.updateMany).not.toHaveBeenCalled()
    expect(tx.payment.create).toHaveBeenCalledOnce()
  })
})

describe('settleFundraiserAppPaymentFromWebhook', () => {
  it('settles an app card order only when the payment really pays it', async () => {
    await expect(settleFundraiserAppPaymentFromWebhook('o_1', squarePayment())).resolves.toMatchObject({
      handled: true,
      status: 'COMPLETED',
    })
    expect(tx.payment.create).toHaveBeenCalledOnce()
  })

  it('refuses an underpayment or a payment from another location', async () => {
    const under = await settleFundraiserAppPaymentFromWebhook(
      'o_1',
      squarePayment({ amountMoney: { amount: BigInt(100), currency: 'USD' } })
    )
    expect(under).toMatchObject({ handled: true, problem: expect.stringMatching(/amount/) })
    const elsewhere = await settleFundraiserAppPaymentFromWebhook('o_1', squarePayment({ locationId: 'LOC_X' }))
    expect(elsewhere).toMatchObject({ handled: true, problem: expect.stringMatching(/location/) })
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('leaves orders that are not fundraiser-app card orders to the webhook', async () => {
    db.order.findUnique.mockResolvedValue(cardOrder({ orderNumber: 'KIOSK-123' }))
    await expect(settleFundraiserAppPaymentFromWebhook('o_1', squarePayment())).resolves.toEqual({ handled: false })
  })
})
