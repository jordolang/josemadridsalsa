import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const orderFindUnique = vi.fn()
const userFindUnique = vi.fn()
const enrollInAutomation = vi.fn()

vi.mock('@/lib/prisma', () => {
  const client = {
    order: { findUnique: orderFindUnique },
    user: { findUnique: userFindUnique },
  }
  return { prisma: client, default: client }
})

vi.mock('@/lib/email/automation-engine', () => ({ enrollInAutomation }))

const { handleAutomationEnrollment, AUTOMATION_TRIGGER_BY_EVENT } = await import(
  '@/lib/domain-events/handlers/automation-enrollment'
)
const { registerDomainEventConsumers, resetDomainEventConsumers } = await import(
  '@/lib/domain-events/handlers'
)
const { dispatchDomainEvent, subscribedEventTypes } = await import(
  '@/lib/domain-events/subscribe'
)

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt_1',
    type: 'payment.completed',
    entityType: 'order',
    entityId: 'order_1',
    payload: null,
    actorUserId: null,
    createdAt: new Date('2026-08-09T12:00:00Z'),
    ...overrides,
  } as never
}

describe('automation enrollment handler', () => {
  beforeEach(() => {
    orderFindUnique.mockReset()
    userFindUnique.mockReset()
    enrollInAutomation.mockReset()
    enrollInAutomation.mockResolvedValue(undefined)
    resetDomainEventConsumers()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('enrolls a registered customer using the account email', async () => {
    orderFindUnique.mockResolvedValue({ guestEmail: null, user: { email: 'buyer@example.com' } })

    await handleAutomationEnrollment(event())

    expect(enrollInAutomation).toHaveBeenCalledWith(
      'ORDER_PLACED',
      'buyer@example.com',
      expect.objectContaining({ eventType: 'payment.completed' }),
      'payment.completed:order_1'
    )
  })

  it('falls back to the guest email, because most storefront orders are guest orders', async () => {
    orderFindUnique.mockResolvedValue({ guestEmail: 'guest@example.com', user: null })

    await handleAutomationEnrollment(event())

    expect(enrollInAutomation.mock.calls[0][1]).toBe('guest@example.com')
  })

  it('prefers the account email over the guest email when both exist', async () => {
    orderFindUnique.mockResolvedValue({
      guestEmail: 'guest@example.com',
      user: { email: 'account@example.com' },
    })

    await handleAutomationEnrollment(event())

    expect(enrollInAutomation.mock.calls[0][1]).toBe('account@example.com')
  })

  it('takes the address straight from the payload without touching the database', async () => {
    await handleAutomationEnrollment(
      event({
        type: 'customer.created',
        entityType: 'customer',
        entityId: 'user_1',
        payload: { email: 'new@example.com', name: 'Ada' },
      })
    )

    expect(orderFindUnique).not.toHaveBeenCalled()
    expect(userFindUnique).not.toHaveBeenCalled()
    expect(enrollInAutomation).toHaveBeenCalledWith(
      'USER_REGISTERED',
      'new@example.com',
      expect.objectContaining({ name: 'Ada' }),
      'customer.created:user_1'
    )
  })

  it('looks the user up when a customer event carries no email', async () => {
    userFindUnique.mockResolvedValue({ email: 'looked-up@example.com' })

    await handleAutomationEnrollment(
      event({ type: 'customer.created', entityType: 'customer', entityId: 'user_1' })
    )

    expect(enrollInAutomation.mock.calls[0][1]).toBe('looked-up@example.com')
  })

  it('maps the shipped fact from order.fulfilled, which is what fulfillment actually emits', async () => {
    orderFindUnique.mockResolvedValue({ guestEmail: 'g@example.com', user: null })

    await handleAutomationEnrollment(event({ type: 'order.fulfilled' }))

    expect(enrollInAutomation.mock.calls[0][0]).toBe('ORDER_SHIPPED')
  })

  it('ignores events that map to no trigger', async () => {
    await handleAutomationEnrollment(event({ type: 'inventory.adjusted', entityType: 'product' }))

    expect(enrollInAutomation).not.toHaveBeenCalled()
    expect(orderFindUnique).not.toHaveBeenCalled()
  })

  it('does not enroll, and does not fail the event, when there is no address to write to', async () => {
    orderFindUnique.mockResolvedValue({ guestEmail: null, user: null })

    await expect(handleAutomationEnrollment(event())).resolves.toBeUndefined()
    expect(enrollInAutomation).not.toHaveBeenCalled()
  })

  it('passes the event payload through so templates can render {{orderNumber}}', async () => {
    orderFindUnique.mockResolvedValue({ guestEmail: 'g@example.com', user: null })

    await handleAutomationEnrollment(event({ payload: { orderNumber: 'JMS-1042', total: 42.5 } }))

    expect(enrollInAutomation.mock.calls[0][2]).toMatchObject({
      orderNumber: 'JMS-1042',
      total: 42.5,
      email: 'g@example.com',
      occurredAt: '2026-08-09T12:00:00.000Z',
    })
  })

  it('maps ORDER_REFUNDED now that lib/payments/refund.ts emits the fact', async () => {
    // Left unmapped until the producer existed: a trigger wired to a fact nobody emits reads
    // as a working automation and is not one.
    orderFindUnique.mockResolvedValue({ guestEmail: 'g@example.com', user: null })

    await handleAutomationEnrollment(event({ type: 'payment.refunded' }))

    expect(enrollInAutomation.mock.calls[0][0]).toBe('ORDER_REFUNDED')
  })

  it('maps exactly the facts that start an automation', () => {
    // Asserted against this handler's own map rather than the global registry, which other
    // consumers also register into — an unrelated new handler should not fail this test.
    expect(Object.keys(AUTOMATION_TRIGGER_BY_EVENT).sort()).toEqual([
      'customer.created',
      'inventory.low',
      'inventory.out_of_stock',
      'loyalty.points_earned',
      'loyalty.tier_upgraded',
      'newsletter.subscribed',
      'order.delivered',
      'order.fulfilled',
      'payment.completed',
      'payment.refunded',
    ])
  })

  it('gives both racing records of one payment the same dedupe key', async () => {
    // /api/checkout/complete and the Stripe webhook each emit payment.completed for the order.
    orderFindUnique.mockResolvedValue({ guestEmail: 'g@example.com', user: null })

    await handleAutomationEnrollment(event({ id: 'evt_route' }))
    await handleAutomationEnrollment(event({ id: 'evt_webhook' }))

    expect(enrollInAutomation.mock.calls[0][3]).toBe('payment.completed:order_1')
    expect(enrollInAutomation.mock.calls[1][3]).toBe('payment.completed:order_1')
  })

  it('keys each refund of an order separately, so a later partial refund still enrolls', async () => {
    orderFindUnique.mockResolvedValue({ guestEmail: 'g@example.com', user: null })

    await handleAutomationEnrollment(event({ type: 'payment.refunded', payload: { refundId: 'ref_1' } }))
    await handleAutomationEnrollment(event({ type: 'payment.refunded', payload: { refundId: 'ref_2' } }))

    expect(enrollInAutomation.mock.calls.map((c) => c[3])).toEqual([
      'payment.refunded:ref_1',
      'payment.refunded:ref_2',
    ])
  })

  it.each([
    ['loyalty.points_earned', 'LOYALTY_POINTS_EARNED'],
    ['loyalty.tier_upgraded', 'LOYALTY_TIER_UPGRADE'],
  ])('enrolls the order owner when %s', async (type, trigger) => {
    orderFindUnique.mockResolvedValue({ guestEmail: null, user: { email: 'member@example.com' } })

    await handleAutomationEnrollment(event({ type, payload: { points: 500, tier: 'SILVER' } }))

    expect(enrollInAutomation).toHaveBeenCalledWith(
      trigger,
      'member@example.com',
      expect.objectContaining({ points: 500, tier: 'SILVER' }),
      `${type}:order_1`
    )
  })

  it('enrolls a newsletter signup as SUBSCRIPTION_CREATED, once per address', async () => {
    await handleAutomationEnrollment(
      event({
        type: 'newsletter.subscribed',
        entityType: 'subscriber',
        entityId: 'fan@example.com',
        payload: { email: 'fan@example.com' },
      })
    )

    expect(enrollInAutomation).toHaveBeenCalledWith(
      'SUBSCRIPTION_CREATED',
      'fan@example.com',
      expect.any(Object),
      'newsletter.subscribed:fan@example.com'
    )
  })

  describe('LOW_STOCK', () => {
    const previous = process.env.INVENTORY_ALERT_EMAILS
    afterEach(() => {
      process.env.INVENTORY_ALERT_EMAILS = previous
    })

    it('enrolls every address on INVENTORY_ALERT_EMAILS, keyed on the alert event', async () => {
      process.env.INVENTORY_ALERT_EMAILS = 'buyer@jms.test, owner@jms.test'

      await handleAutomationEnrollment(
        event({
          id: 'evt_low',
          type: 'inventory.low',
          entityType: 'product',
          entityId: 'prod_1',
          payload: { productName: 'Hot', sku: 'H-1', stockLevel: 2, threshold: 5 },
        })
      )

      expect(enrollInAutomation.mock.calls.map((c) => [c[0], c[1], c[3]])).toEqual([
        ['LOW_STOCK', 'buyer@jms.test', 'inventory.low:evt_low'],
        ['LOW_STOCK', 'owner@jms.test', 'inventory.low:evt_low'],
      ])
      expect(enrollInAutomation.mock.calls[0][2]).toMatchObject({ productName: 'Hot', stockLevel: 2 })
    })

    it('enrolls nobody when no alert addresses are configured', async () => {
      process.env.INVENTORY_ALERT_EMAILS = ''

      await handleAutomationEnrollment(
        event({ type: 'inventory.out_of_stock', entityType: 'product', entityId: 'prod_1' })
      )

      expect(enrollInAutomation).not.toHaveBeenCalled()
    })
  })

  it('registers its handlers into the shared bus', () => {
    registerDomainEventConsumers()

    for (const type of Object.keys(AUTOMATION_TRIGGER_BY_EVENT)) {
      expect(subscribedEventTypes()).toContain(type)
    }
  })

  it('registers once, so a warm serverless instance cannot send duplicate emails', async () => {
    orderFindUnique.mockResolvedValue({ guestEmail: 'g@example.com', user: null })

    // A route calling this on every request is the realistic case: module state survives
    // between invocations, so an unguarded register would stack another copy each time.
    registerDomainEventConsumers()
    registerDomainEventConsumers()
    registerDomainEventConsumers()

    await dispatchDomainEvent(event())

    expect(enrollInAutomation).toHaveBeenCalledTimes(1)
  })
})
