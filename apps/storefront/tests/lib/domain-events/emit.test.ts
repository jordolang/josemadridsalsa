import { beforeEach, describe, expect, it, vi } from 'vitest'

const domainEventCreate = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: { domainEvent: { create: domainEventCreate } },
  default: { domainEvent: { create: domainEventCreate } },
}))

const { emitDomainEvent, emitDomainEvents } = await import('@/lib/domain-events/emit')

describe('emitDomainEvent', () => {
  beforeEach(() => {
    domainEventCreate.mockReset()
    domainEventCreate.mockResolvedValue({})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('records the event against its entity', async () => {
    await emitDomainEvent({
      type: 'order.fulfilled',
      entityType: 'order',
      entityId: 'order_1',
      payload: { orderNumber: 'JMS-1' },
      actorUserId: 'user_1',
    })

    expect(domainEventCreate).toHaveBeenCalledWith({
      data: {
        type: 'order.fulfilled',
        entityType: 'order',
        entityId: 'order_1',
        payload: { orderNumber: 'JMS-1' },
        actorUserId: 'user_1',
      },
    })
  })

  it('records a null actor for webhook-driven facts', async () => {
    await emitDomainEvent({
      type: 'payment.completed',
      entityType: 'order',
      entityId: 'order_1',
    })

    expect(domainEventCreate.mock.calls[0][0].data.actorUserId).toBeNull()
    expect(domainEventCreate.mock.calls[0][0].data.payload).toBeUndefined()
  })

  it('never throws, so a failed event write cannot roll back the operation it describes', async () => {
    domainEventCreate.mockRejectedValue(new Error('db down'))

    await expect(
      emitDomainEvent({ type: 'payment.completed', entityType: 'order', entityId: 'order_1' })
    ).resolves.toBeUndefined()
  })

  it('writes through a supplied transaction client instead of the singleton', async () => {
    const txCreate = vi.fn().mockResolvedValue({})

    await emitDomainEvent(
      { type: 'payment.completed', entityType: 'order', entityId: 'order_1' },
      { domainEvent: { create: txCreate } } as never
    )

    expect(txCreate).toHaveBeenCalledTimes(1)
    expect(domainEventCreate).not.toHaveBeenCalled()
  })

  it('preserves ordering when emitting several facts from one operation', async () => {
    await emitDomainEvents([
      { type: 'payment.completed', entityType: 'order', entityId: 'order_1' },
      { type: 'order.fulfilled', entityType: 'order', entityId: 'order_1' },
    ])

    expect(domainEventCreate.mock.calls.map((call) => call[0].data.type)).toEqual([
      'payment.completed',
      'order.fulfilled',
    ])
  })

  it('keeps emitting the rest of a batch when one write fails', async () => {
    domainEventCreate
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce({})

    await emitDomainEvents([
      { type: 'payment.completed', entityType: 'order', entityId: 'order_1' },
      { type: 'order.fulfilled', entityType: 'order', entityId: 'order_1' },
    ])

    expect(domainEventCreate).toHaveBeenCalledTimes(2)
  })
})
