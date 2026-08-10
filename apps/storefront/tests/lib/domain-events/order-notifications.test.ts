import { beforeEach, describe, expect, it, vi } from 'vitest'

const orderFindUnique = vi.fn()
const notifyOperators = vi.fn()
const sendAdminNewOrderNotification = vi.fn()

vi.mock('@/lib/prisma', () => {
  const client = { order: { findUnique: orderFindUnique } }
  return { prisma: client, default: client }
})

vi.mock('@/lib/notifications/dispatch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/notifications/dispatch')>()
  return { ...actual, notifyOperators }
})

vi.mock('@/lib/email/automation', () => ({ sendAdminNewOrderNotification }))

const {
  HIGH_VALUE_ORDER_THRESHOLD,
  handleNewOrderNotifications,
  highValueOrderSpec,
  newOrderSpec,
} = await import('@/lib/domain-events/handlers/order-notifications')

const event = {
  id: 'evt_1',
  type: 'payment.completed',
  entityType: 'order',
  entityId: 'order_1',
  payload: null,
  actorUserId: null,
  createdAt: new Date('2026-08-09T12:00:00Z'),
} as never

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order_1',
    orderNumber: 'JMS-1042',
    total: 42.5,
    guestEmail: 'guest@example.com',
    user: null,
    ...overrides,
  }
}

describe('new order notification specs', () => {
  const summary = { id: 'order_1', orderNumber: 'JMS-1042', total: 250, customer: 'Ada' }

  it('links straight to the order rather than a bare list', () => {
    expect(newOrderSpec(summary).link).toBe('/admin/orders/order_1')
  })

  it('keys dedupe on the order, so a replayed event refreshes one row', () => {
    expect(newOrderSpec(summary).dedupeKey).toBe('new-order:order_1')
  })

  it('flags an order at the threshold', () => {
    const spec = highValueOrderSpec({ ...summary, total: HIGH_VALUE_ORDER_THRESHOLD })
    expect(spec?.type).toBe('ORDER_HIGH_VALUE')
  })

  it('does not flag an order below the threshold', () => {
    expect(highValueOrderSpec({ ...summary, total: HIGH_VALUE_ORDER_THRESHOLD - 0.01 })).toBeNull()
  })

  it('gives the two notifications different dedupe keys, so clearing one keeps the other', () => {
    expect(newOrderSpec(summary).dedupeKey).not.toBe(highValueOrderSpec(summary)?.dedupeKey)
  })
})

describe('new order notification handler', () => {
  beforeEach(() => {
    orderFindUnique.mockReset()
    notifyOperators.mockReset()
    notifyOperators.mockResolvedValue(1)
    sendAdminNewOrderNotification.mockReset()
    sendAdminNewOrderNotification.mockResolvedValue({ success: true })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('raises one notification for an ordinary order', async () => {
    orderFindUnique.mockResolvedValue(order())

    await handleNewOrderNotifications(event)

    expect(notifyOperators).toHaveBeenCalledTimes(1)
    expect(notifyOperators.mock.calls[0][0].type).toBe('ORDER_NEW')
  })

  it('raises a second notification for a large order', async () => {
    orderFindUnique.mockResolvedValue(order({ total: 250 }))

    await handleNewOrderNotifications(event)

    expect(notifyOperators.mock.calls.map((c) => c[0].type)).toEqual([
      'ORDER_NEW',
      'ORDER_HIGH_VALUE',
    ])
  })

  it('names the customer from the account when there is one', async () => {
    orderFindUnique.mockResolvedValue(order({ user: { name: 'Ada', email: 'ada@example.com' } }))

    await handleNewOrderNotifications(event)

    expect(notifyOperators.mock.calls[0][0].message).toContain('Ada')
  })

  it('falls back to the guest email, since most storefront orders are guest orders', async () => {
    orderFindUnique.mockResolvedValue(order())

    await handleNewOrderNotifications(event)

    expect(notifyOperators.mock.calls[0][0].message).toContain('guest@example.com')
  })

  it('sends the admin email as well as the in-app notification', async () => {
    orderFindUnique.mockResolvedValue(order())

    await handleNewOrderNotifications(event)

    expect(sendAdminNewOrderNotification).toHaveBeenCalledWith('order_1')
  })

  it('still raises the notifications when the admin email is unconfigured', async () => {
    orderFindUnique.mockResolvedValue(order())
    sendAdminNewOrderNotification.mockRejectedValue(new Error('no admin emails configured'))

    await expect(handleNewOrderNotifications(event)).resolves.toBeUndefined()
    expect(notifyOperators).toHaveBeenCalledTimes(1)
  })

  it('does nothing when the order has gone', async () => {
    orderFindUnique.mockResolvedValue(null)

    await handleNewOrderNotifications(event)

    expect(notifyOperators).not.toHaveBeenCalled()
    expect(sendAdminNewOrderNotification).not.toHaveBeenCalled()
  })

  it('handles a Decimal total without producing NaN in the message', async () => {
    // Prisma hands back Decimal, not number — `Number(...)` is what keeps this readable.
    orderFindUnique.mockResolvedValue(order({ total: { toString: () => '250.00' } }))

    await handleNewOrderNotifications(event)

    expect(notifyOperators.mock.calls[0][0].message).toContain('250.00')
    expect(notifyOperators.mock.calls.map((c) => c[0].type)).toContain('ORDER_HIGH_VALUE')
  })
})
