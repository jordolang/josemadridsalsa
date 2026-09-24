import { beforeEach, describe, expect, it, vi } from 'vitest'

const customerFindUnique = vi.fn()
const orderFindMany = vi.fn()
const fundraiserFindUnique = vi.fn()

vi.mock('@/lib/prisma', () => {
  const client = {
    customer: { findUnique: customerFindUnique },
    order: { findMany: orderFindMany },
    fundraiser: { findUnique: fundraiserFindUnique },
  }
  return { prisma: client, default: client }
})

const { buildEmailContext, extractOrderNumbers } = await import('@/lib/inbox/context')

describe('extractOrderNumbers', () => {
  it('finds a prefixed order number', () => {
    expect(extractOrderNumbers('About JMS-1043 please')).toContain('JMS-1043')
  })

  it('finds a bare number introduced by order or #', () => {
    expect(extractOrderNumbers('my order 10432 never came')).toContain('10432')
    expect(extractOrderNumbers('re: #10432')).toContain('10432')
  })

  it('ignores short numbers that are not order numbers', () => {
    expect(extractOrderNumbers('I ordered 3 jars')).toEqual([])
  })

  it('deduplicates repeats across the thread', () => {
    expect(extractOrderNumbers('JMS-1043 ... again JMS-1043')).toEqual(['JMS-1043'])
  })
})

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: 'o1',
    orderNumber: 'JMS-1043',
    status: 'SHIPPED',
    paymentStatus: 'PAID',
    fulfillmentStatus: 'FULFILLED',
    total: '24.00',
    createdAt: new Date('2026-09-01T12:00:00Z'),
    shippedAt: new Date('2026-09-02T12:00:00Z'),
    deliveredAt: null,
    trackingNumber: '1Z999',
    trackingUrl: 'https://track',
    carrierName: 'UPS',
    fundraiserId: null,
    items: [{ productName: 'Chipotle', quantity: 2 }],
    ...overrides,
  }
}

describe('buildEmailContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    customerFindUnique.mockResolvedValue(null)
    orderFindMany.mockResolvedValue([])
    fundraiserFindUnique.mockResolvedValue(null)
  })

  it('resolves the sender and their orders', async () => {
    customerFindUnique.mockResolvedValue({
      id: 'c1',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      totalOrders: 3,
      lastOrderAt: new Date('2026-09-01T00:00:00Z'),
    })
    orderFindMany.mockResolvedValue([order()])

    const context = await buildEmailContext('Jane@Example.com', 'where is JMS-1043')

    expect(context.customer).toMatchObject({ id: 'c1', name: 'Jane Doe' })
    expect(context.orders[0]).toMatchObject({
      orderNumber: 'JMS-1043',
      trackingNumber: '1Z999',
      items: ['2× Chipotle'],
    })
  })

  it('looks the sender up in lower case, whatever casing the header used', async () => {
    await buildEmailContext('Jane@Example.COM', 'hello')

    expect(customerFindUnique.mock.calls[0][0].where).toEqual({ email: 'jane@example.com' })
  })

  it('matches both guest orders and account orders', async () => {
    await buildEmailContext('jane@example.com', 'hello')

    expect(orderFindMany.mock.calls[0][0].where).toEqual({
      OR: [{ guestEmail: 'jane@example.com' }, { user: { email: 'jane@example.com' } }],
    })
  })

  it('keeps an order the sender does not own out of the verified facts', async () => {
    orderFindMany.mockResolvedValue([order({ orderNumber: 'JMS-1043' })])

    const context = await buildEmailContext('jane@example.com', 'what about JMS-9999')

    expect(context.orders.map((o) => o.orderNumber)).toEqual(['JMS-1043'])
    expect(context.referencedForeignOrderNumbers).toEqual(['JMS-9999'])
  })

  it('pulls the fundraiser behind a fundraiser order', async () => {
    orderFindMany.mockResolvedValue([order({ fundraiserId: 'f1' })])
    fundraiserFindUnique.mockResolvedValue({
      id: 'f1',
      name: 'Zanesville Band',
      status: 'ACTIVE',
      endDate: new Date('2026-10-01T00:00:00Z'),
    })

    const context = await buildEmailContext('jane@example.com', 'about the fundraiser')

    expect(context.fundraiser).toEqual({
      id: 'f1',
      name: 'Zanesville Band',
      status: 'ACTIVE',
      endDate: '2026-10-01',
    })
  })

  it('returns empty context rather than throwing when the database is unreachable', async () => {
    customerFindUnique.mockRejectedValue(new Error('connection lost'))

    const context = await buildEmailContext('jane@example.com', 'hello')

    expect(context).toEqual({
      customer: null,
      orders: [],
      referencedForeignOrderNumbers: [],
      fundraiser: null,
    })
  })
})
