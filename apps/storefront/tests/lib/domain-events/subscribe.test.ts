import { beforeEach, describe, expect, it, vi } from 'vitest'

const findMany = vi.fn()
const updateMany = vi.fn()

vi.mock('@/lib/prisma', () => {
  const client = { domainEvent: { findMany, updateMany } }
  return { prisma: client, default: client }
})

const {
  clearDomainEventHandlers,
  dispatchDomainEvent,
  dispatchPendingDomainEvents,
  registerDomainEventHandler,
  subscribedEventTypes,
} = await import('@/lib/domain-events/subscribe')

function event(overrides: Partial<Record<string, unknown>> = {}) {
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

describe('domain event subscribers', () => {
  beforeEach(() => {
    clearDomainEventHandlers()
    findMany.mockReset()
    updateMany.mockReset()
    updateMany.mockResolvedValue({ count: 0 })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('runs every handler registered for the event type, in registration order', async () => {
    const calls: string[] = []
    registerDomainEventHandler('payment.completed', 'first', async () => {
      calls.push('first')
    })
    registerDomainEventHandler('payment.completed', 'second', async () => {
      calls.push('second')
    })

    await dispatchDomainEvent(event())

    expect(calls).toEqual(['first', 'second'])
  })

  it('ignores events nothing is subscribed to', async () => {
    const handler = vi.fn()
    registerDomainEventHandler('order.delivered', 'delivered', handler)

    await expect(dispatchDomainEvent(event({ type: 'payment.completed' }))).resolves.toBe(true)
    expect(handler).not.toHaveBeenCalled()
  })

  it('contains a throwing handler so its siblings still see the fact', async () => {
    const sibling = vi.fn()
    registerDomainEventHandler('payment.completed', 'broken', async () => {
      throw new Error('handler blew up')
    })
    registerDomainEventHandler('payment.completed', 'healthy', sibling)

    const ok = await dispatchDomainEvent(event())

    expect(sibling).toHaveBeenCalledTimes(1)
    expect(ok).toBe(false)
  })

  it('only reads event types something is subscribed to', async () => {
    registerDomainEventHandler('order.delivered', 'delivered', async () => {})
    findMany.mockResolvedValue([])

    await dispatchPendingDomainEvents()

    expect(findMany.mock.calls[0][0].where).toEqual({
      consumedAt: null,
      type: { in: ['order.delivered'] },
    })
  })

  it('does not query at all when nothing is subscribed', async () => {
    const result = await dispatchPendingDomainEvents()

    expect(findMany).not.toHaveBeenCalled()
    expect(result).toEqual({ claimed: 0, consumed: 0, failed: 0 })
  })

  it('marks an event consumed only after its handlers finish', async () => {
    const order: string[] = []
    registerDomainEventHandler('payment.completed', 'slow', async () => {
      order.push('handler')
    })
    findMany.mockResolvedValue([event()])
    updateMany.mockImplementation(async () => {
      order.push('mark-consumed')
      return { count: 1 }
    })

    const result = await dispatchPendingDomainEvents()

    expect(order).toEqual(['handler', 'mark-consumed'])
    expect(result).toEqual({ claimed: 1, consumed: 1, failed: 0 })
  })

  it('leaves a failed event pending so the next tick retries it', async () => {
    registerDomainEventHandler('payment.completed', 'broken', async () => {
      throw new Error('nope')
    })
    findMany.mockResolvedValue([event()])

    const result = await dispatchPendingDomainEvents()

    expect(updateMany).not.toHaveBeenCalled()
    expect(result).toEqual({ claimed: 1, consumed: 0, failed: 1 })
  })

  it('consumes the healthy events in a batch even when one fails', async () => {
    registerDomainEventHandler('payment.completed', 'selective', async (e) => {
      if (e.id === 'evt_bad') throw new Error('nope')
    })
    findMany.mockResolvedValue([event({ id: 'evt_good' }), event({ id: 'evt_bad' })])

    const result = await dispatchPendingDomainEvents()

    expect(updateMany.mock.calls[0][0].where).toEqual({ id: { in: ['evt_good'] } })
    expect(result).toEqual({ claimed: 2, consumed: 1, failed: 1 })
  })

  it('drains oldest first, so a customer never gets "delivered" before "shipped"', async () => {
    registerDomainEventHandler('payment.completed', 'noop', async () => {})
    findMany.mockResolvedValue([])

    await dispatchPendingDomainEvents()

    expect(findMany.mock.calls[0][0].orderBy).toEqual({ createdAt: 'asc' })
  })

  it('degrades to a no-op when the migration adding consumedAt has not run', async () => {
    registerDomainEventHandler('payment.completed', 'noop', async () => {})
    findMany.mockRejectedValue(
      new Error('The column `domain_events.consumedAt` does not exist in the current database.')
    )

    // A deploy can land this code before its migration, because the build wraps
    // `migrate deploy` in a warning rather than a failure. Throwing here would take down the
    // step processor that runs immediately afterwards in the same cron.
    await expect(dispatchPendingDomainEvents()).resolves.toEqual({
      claimed: 0,
      consumed: 0,
      failed: 0,
    })
  })

  it('still surfaces database errors that are not a missing column', async () => {
    registerDomainEventHandler('payment.completed', 'noop', async () => {})
    findMany.mockRejectedValue(new Error('connection terminated unexpectedly'))

    await expect(dispatchPendingDomainEvents()).rejects.toThrow('connection terminated')
  })

  it('reports the types currently subscribed', () => {
    registerDomainEventHandler('order.delivered', 'a', async () => {})
    registerDomainEventHandler('payment.completed', 'b', async () => {})

    expect(subscribedEventTypes().sort()).toEqual(['order.delivered', 'payment.completed'])
  })
})
