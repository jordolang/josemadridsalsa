import { beforeEach, describe, expect, it, vi } from 'vitest'

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
      expect.objectContaining({ eventType: 'payment.completed' })
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
      expect.objectContaining({ name: 'Ada' })
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
      'order.delivered',
      'order.fulfilled',
      'payment.completed',
      'payment.refunded',
    ])
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
