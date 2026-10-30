import { beforeEach, describe, expect, it, vi } from 'vitest'

const orderFindMany = vi.fn()
const suppressionFindMany = vi.fn()
const preferenceFindMany = vi.fn()
const customerFindMany = vi.fn()
const listUpsert = vi.fn()
const subscriberDeleteMany = vi.fn()
const subscriberCreateMany = vi.fn()

vi.mock('@/lib/prisma', () => {
  const tx = {
    mailingList: { upsert: listUpsert },
    mailingListSubscriber: { deleteMany: subscriberDeleteMany, createMany: subscriberCreateMany },
  }
  const client = {
    order: { findMany: orderFindMany },
    emailSuppression: { findMany: suppressionFindMany },
    unsubscribePreference: { findMany: preferenceFindMany },
    customer: { findMany: customerFindMany },
    $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  }
  return { prisma: client, default: client }
})

const {
  OPEN_ORDER_WHERE,
  OPEN_ORDERS_LIST_ID,
  buildOpenOrderContacts,
  loadOpenOrderEmails,
  orderEmail,
  refreshOpenOrdersList,
} = await import('@/lib/email/open-orders')

function order(overrides: Record<string, unknown> = {}) {
  return {
    orderNumber: 'JMS-1001',
    salesChannel: 'WEBSITE',
    guestEmail: null,
    guestPhone: null,
    user: null,
    shippingAddress: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  suppressionFindMany.mockResolvedValue([])
  preferenceFindMany.mockResolvedValue([])
  customerFindMany.mockResolvedValue([])
})

describe('OPEN_ORDER_WHERE', () => {
  it('means paid, not shipped, not handed over at a POS or event', () => {
    expect(OPEN_ORDER_WHERE).toEqual({
      paymentStatus: { in: ['PAID', 'PARTIALLY_REFUNDED'] },
      status: { in: ['PENDING', 'CONFIRMED', 'PROCESSING'] },
      fulfillmentStatus: { in: ['UNFULFILLED', 'PARTIALLY_FULFILLED'] },
      salesChannel: { notIn: ['POS', 'EVENT'] },
    })
  })
})

describe('orderEmail', () => {
  it('prefers the account email and falls back to the guest email', () => {
    expect(orderEmail({ user: { email: 'Acct@Example.com', name: null }, guestEmail: 'g@x.com' })).toBe(
      'acct@example.com',
    )
    expect(orderEmail({ user: null, guestEmail: ' Guest@Example.com ' })).toBe('guest@example.com')
    expect(orderEmail({ user: null, guestEmail: 'not-an-email' })).toBeNull()
  })
})

describe('buildOpenOrderContacts', () => {
  it('lists each person once across several open orders', () => {
    const contacts = buildOpenOrderContacts([
      order({ guestEmail: 'pat@example.com', shippingAddress: { firstName: 'Pat', lastName: 'Fan' } }),
      order({
        orderNumber: 'JMS-1002',
        salesChannel: 'FUNDRAISER',
        user: { email: 'PAT@example.com', name: 'Patricia Fan' },
      }),
    ])
    expect(contacts).toEqual([
      {
        email: 'pat@example.com',
        firstName: 'Pat',
        lastName: 'Fan',
        phone: null,
        orderNumbers: ['JMS-1001', 'JMS-1002'],
        salesChannels: ['website', 'fundraiser'],
      },
    ])
  })

  it('uses the account name when there is no shipping name', () => {
    const [contact] = buildOpenOrderContacts([
      order({ user: { email: 'sam@example.com', name: 'Sam de la Cruz' } }),
    ])
    expect(contact).toMatchObject({ firstName: 'Sam', lastName: 'de la Cruz' })
  })

  it('skips orders with no usable address', () => {
    expect(buildOpenOrderContacts([order({ guestEmail: '' })])).toEqual([])
  })
})

describe('loadOpenOrderEmails', () => {
  it('queries only open orders and returns lower-cased addresses', async () => {
    orderFindMany.mockResolvedValue([
      { guestEmail: 'A@Example.com', user: null },
      { guestEmail: null, user: { email: 'b@example.com', name: null } },
    ])
    const emails = await loadOpenOrderEmails()
    expect(orderFindMany.mock.calls[0][0].where).toBe(OPEN_ORDER_WHERE)
    expect([...emails]).toEqual(['a@example.com', 'b@example.com'])
  })
})

describe('refreshOpenOrdersList', () => {
  it('purges every previous entry and rebuilds from open orders only', async () => {
    orderFindMany.mockResolvedValue([
      order({ guestEmail: 'pat@example.com', shippingAddress: { firstName: 'Pat', lastName: 'Fan', phone: null } }),
      order({ orderNumber: 'JMS-1003', guestEmail: 'gone@example.com' }),
    ])
    suppressionFindMany.mockResolvedValue([{ email: 'gone@example.com', reason: 'UNSUBSCRIBE' }])

    const result = await refreshOpenOrdersList('user-1')

    expect(orderFindMany.mock.calls[0][0].where).toBe(OPEN_ORDER_WHERE)
    expect(listUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: OPEN_ORDERS_LIST_ID } }),
    )
    expect(subscriberDeleteMany).toHaveBeenCalledWith({ where: { listId: OPEN_ORDERS_LIST_ID } })
    expect(subscriberDeleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      subscriberCreateMany.mock.invocationCallOrder[0],
    )

    const rows = subscriberCreateMany.mock.calls[0][0].data
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      listId: OPEN_ORDERS_LIST_ID,
      email: 'pat@example.com',
      status: 'SUBSCRIBED',
      source: 'open-orders',
      customFields: { orderNumbers: 'JMS-1001' },
    })
    // Opted out people stay on the list but are never mailed.
    expect(rows[1]).toMatchObject({ email: 'gone@example.com', status: 'UNSUBSCRIBED' })
    expect(result).toEqual({
      listId: OPEN_ORDERS_LIST_ID,
      openOrders: 2,
      contacts: 2,
      subscribed: 1,
      optedOut: 1,
    })
  })

  it('empties the list when no orders are open', async () => {
    orderFindMany.mockResolvedValue([])

    const result = await refreshOpenOrdersList()

    expect(subscriberDeleteMany).toHaveBeenCalled()
    expect(subscriberCreateMany).not.toHaveBeenCalled()
    expect(result.contacts).toBe(0)
  })
})
