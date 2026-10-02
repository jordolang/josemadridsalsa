import { beforeEach, describe, expect, it, vi } from 'vitest'

const tx = vi.hoisted(() => ({
  address: { create: vi.fn() },
  order: { create: vi.fn() },
}))
const db = vi.hoisted(() => ({
  order: { findUnique: vi.fn(), findMany: vi.fn() },
  product: { findMany: vi.fn() },
  $transaction: vi.fn(),
}))
const store = vi.hoisted(() => ({
  resolveFundraiserStore: vi.fn(),
  loadFundraiserStoreProducts: vi.fn(),
}))
const creditFundraiserCommission = vi.hoisted(() => vi.fn())
const emitOrderCreated = vi.hoisted(() => vi.fn())

vi.mock('@/lib/prisma', () => ({ prisma: db, default: db }))
vi.mock('@/lib/fundraising/store.server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/fundraising/store.server')>()
  return { ...actual, ...store }
})
vi.mock('@/lib/fundraising/credit-commission', () => ({ creditFundraiserCommission }))
vi.mock('@/lib/orders/events', () => ({ emitOrderCreated }))

const { createPhoneOrder, listSellerOrders } = await import('@/lib/fundraiser-app/orders')
const { FundraiserAppError } = await import('@/lib/fundraiser-app/errors')

type Session = Parameters<typeof createPhoneOrder>[0]
const session = {
  id: 's_1',
  participant: { id: 'p_1', name: 'Casey Jones', fundraiser: { id: 'f_1', slug: 'zhs-band' } },
} as unknown as Session

const groupStore = {
  fundraiserId: 'f_1',
  slug: 'zhs-band',
  name: 'Spring Salsa Drive',
  organizationName: 'Zanesville High Band',
  commissionRate: 50,
  defaultUnitPrice: 10,
  prices: new Map([['prod_hot', 12]]),
  productIds: new Set(['prod_hot', 'prod_mild']),
}

const order = (overrides: Record<string, unknown> = {}) => ({
  clientOrderId: '0b6f3c3e-2a59-4e8b-9a8e-6f2c1d6c9a11',
  customer: { firstName: 'Pat', lastName: 'Lee', phone: '740-555-0100', email: '' },
  items: [
    { productId: 'prod_hot', quantity: 2 },
    { productId: 'prod_mild', quantity: 1 },
    { productId: 'prod_hot', quantity: 1 },
  ],
  payment: 'CASH' as const,
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  db.order.findUnique.mockResolvedValue(null)
  store.resolveFundraiserStore.mockResolvedValue(groupStore)
  db.product.findMany.mockResolvedValue([
    { id: 'prod_hot', name: 'Hot', sku: 'HOT', costPrice: null, featuredImage: null },
    { id: 'prod_mild', name: 'Mild', sku: 'MILD', costPrice: null, featuredImage: null },
  ])
  db.$transaction.mockImplementation((fn: (client: typeof tx) => unknown) => fn(tx))
  tx.order.create.mockImplementation(({ data }) =>
    Promise.resolve({
      id: 'o_1',
      orderNumber: data.orderNumber,
      total: data.total,
      participantId: data.participantId,
      paymentStatus: data.paymentStatus,
    })
  )
})

describe('createPhoneOrder', () => {
  it('prices each line from the group store, never from the app', async () => {
    const result = await createPhoneOrder(session, order())

    const data = tx.order.create.mock.calls[0][0].data
    const lines = data.items.create.map((l: { productId: string; quantity: number; unitPrice: unknown }) => [
      l.productId,
      l.quantity,
      Number(l.unitPrice),
    ])
    // Hot is the store's $12 override, merged across both lines; Mild falls back to the $10 default.
    expect(lines).toEqual([
      ['prod_hot', 3, 12],
      ['prod_mild', 1, 10],
    ])
    expect(Number(data.total)).toBe(46)
    expect(Number(data.subtotal)).toBe(46)
    expect(result).toMatchObject({ total: 46, paid: true, duplicate: false })
  })

  it('records the sale against the group and the seller', async () => {
    await createPhoneOrder(session, order())
    const data = tx.order.create.mock.calls[0][0].data
    expect(data).toMatchObject({
      fundraiserId: 'f_1',
      participantId: 'p_1',
      salesChannel: 'FUNDRAISER',
      sellerName: 'Casey Jones',
      guestPhone: '740-555-0100',
      guestEmail: null,
      paymentProvider: null,
      paymentChannel: null,
    })
    expect(data.orderNumber).toBe('APP-0B6F3C3E2A59')
    expect(data.adminNotes).toContain('Pat Lee')
    expect(emitOrderCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 'o_1', salesChannel: 'FUNDRAISER' }))
  })

  it('credits the group straight away when the seller collected cash or a check', async () => {
    await createPhoneOrder(session, order({ payment: 'CHECK' }))
    const data = tx.order.create.mock.calls[0][0].data
    expect(data).toMatchObject({ paymentStatus: 'PAID', status: 'CONFIRMED' })
    expect(creditFundraiserCommission).toHaveBeenCalledWith(tx, 'o_1')
  })

  it('leaves a pay-later order pending and uncredited', async () => {
    const result = await createPhoneOrder(session, order({ payment: 'PAY_LATER' }))
    const data = tx.order.create.mock.calls[0][0].data
    expect(data).toMatchObject({ paymentStatus: 'PENDING', status: 'PENDING', paymentMethod: 'Pay on delivery' })
    expect(creditFundraiserCommission).not.toHaveBeenCalled()
    expect(result.paid).toBe(false)
  })

  it('saves a delivery address with the customer name when one is given', async () => {
    tx.address.create.mockResolvedValue({ id: 'addr_1' })
    await createPhoneOrder(
      session,
      order({ address: { street: '1 Main St', city: 'Zanesville', state: 'OH', zipCode: '43701' } })
    )
    expect(tx.address.create.mock.calls[0][0].data).toMatchObject({ firstName: 'Pat', lastName: 'Lee', city: 'Zanesville' })
    expect(tx.order.create.mock.calls[0][0].data.shippingAddressId).toBe('addr_1')
  })

  it('returns the same order when the app retries', async () => {
    db.order.findUnique.mockResolvedValue({
      id: 'o_1',
      orderNumber: 'APP-0B6F3C3E2A59',
      total: 46,
      participantId: 'p_1',
      paymentStatus: 'PAID',
    })
    const result = await createPhoneOrder(session, order())
    expect(result).toMatchObject({ id: 'o_1', duplicate: true })
    expect(tx.order.create).not.toHaveBeenCalled()
  })

  it("never hands back another seller's order", async () => {
    db.order.findUnique.mockResolvedValue({ id: 'o_9', orderNumber: 'x', total: 1, participantId: 'p_9', paymentStatus: 'PAID' })
    await expect(createPhoneOrder(session, order())).rejects.toBeInstanceOf(FundraiserAppError)
  })

  it('refuses a salsa the group does not sell', async () => {
    const error = await createPhoneOrder(session, order({ items: [{ productId: 'prod_other', quantity: 1 }] })).catch((e) => e)
    expect(error).toBeInstanceOf(FundraiserAppError)
    expect(error.status).toBe(409)
    expect(tx.order.create).not.toHaveBeenCalled()
  })

  it('refuses when the group store is not open', async () => {
    store.resolveFundraiserStore.mockResolvedValue(null)
    const error = await createPhoneOrder(session, order()).catch((e) => e)
    expect(error.status).toBe(409)
  })
})

describe('listSellerOrders', () => {
  it("lists only the seller's own orders, with the customer's name", async () => {
    db.order.findMany.mockResolvedValue([
      {
        id: 'o_1',
        orderNumber: 'APP-1',
        createdAt: new Date(),
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        paymentMethod: 'Cash (collected by seller)',
        total: 46,
        guestPhone: '740-555-0100',
        adminNotes: 'Phone order taken in the fundraiser app by Casey Jones for Pat Lee.',
        shippingAddress: null,
        items: [{ productName: 'Hot', quantity: 3 }],
      },
    ])
    const orders = await listSellerOrders(session)
    expect(db.order.findMany.mock.calls[0][0].where).toEqual({ participantId: 'p_1' })
    expect(orders[0]).toMatchObject({ customerName: 'Pat Lee', paid: true, total: 46 })
  })
})
