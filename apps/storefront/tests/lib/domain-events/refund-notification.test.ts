import { beforeEach, describe, expect, it, vi } from 'vitest'

const orderFindUnique = vi.fn()
const orderUpdate = vi.fn()
const sendRefundProcessedEmail = vi.fn()

vi.mock('@/lib/prisma', () => {
  const client = { order: { findUnique: orderFindUnique, update: orderUpdate } }
  return { prisma: client, default: client }
})

vi.mock('@/lib/email/transactional', () => ({ sendRefundProcessedEmail }))

const { handleRefundNotification } = await import(
  '@/lib/domain-events/handlers/refund-notification'
)

function event(payload: Record<string, unknown> | null = { amountCents: 1250 }) {
  return {
    id: 'evt_1',
    type: 'payment.refunded',
    entityType: 'order',
    entityId: 'order_1',
    payload,
    actorUserId: null,
    createdAt: new Date('2026-08-10T12:00:00Z'),
  } as never
}

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order_1',
    orderNumber: 'JMS-1042',
    total: 40,
    createdAt: new Date('2026-07-01T12:00:00Z'),
    guestEmail: 'guest@example.com',
    refundEmailSentAt: null,
    user: null,
    payments: [{ methodType: 'CARD', provider: 'STRIPE' }],
    ...overrides,
  }
}

describe('refund notification handler', () => {
  beforeEach(() => {
    orderFindUnique.mockReset()
    orderUpdate.mockReset()
    orderUpdate.mockResolvedValue({})
    sendRefundProcessedEmail.mockReset()
    sendRefundProcessedEmail.mockResolvedValue(undefined)
  })

  it('tells the customer their refund settled', async () => {
    orderFindUnique.mockResolvedValue(order())

    await handleRefundNotification(event())

    expect(sendRefundProcessedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'guest@example.com', orderNumber: 'JMS-1042' })
    )
  })

  it('reports what was actually refunded, not the order total', async () => {
    // A partial refund on a larger order must not tell the customer the whole order came back.
    orderFindUnique.mockResolvedValue(order({ total: 40 }))

    await handleRefundNotification(event({ amountCents: 1250 }))

    expect(sendRefundProcessedEmail.mock.calls[0][0].refundAmount).toBe('$12.50')
  })

  it('falls back to the order total when the event carries no amount', async () => {
    orderFindUnique.mockResolvedValue(order({ total: 40 }))

    await handleRefundNotification(event(null))

    expect(sendRefundProcessedEmail.mock.calls[0][0].refundAmount).toBe('$40.00')
  })

  it('stays quiet when the admin status change already sent this email', async () => {
    orderFindUnique.mockResolvedValue(order({ refundEmailSentAt: new Date() }))

    await handleRefundNotification(event())

    expect(sendRefundProcessedEmail).not.toHaveBeenCalled()
  })

  it('stamps the marker after sending, so the other sender stays quiet', async () => {
    const calls: string[] = []
    orderFindUnique.mockResolvedValue(order())
    sendRefundProcessedEmail.mockImplementation(async () => {
      calls.push('send')
    })
    orderUpdate.mockImplementation(async () => {
      calls.push('stamp')
      return {}
    })

    await handleRefundNotification(event())

    expect(calls).toEqual(['send', 'stamp'])
    expect(orderUpdate).toHaveBeenCalledWith({
      where: { id: 'order_1' },
      data: { refundEmailSentAt: expect.any(Date) },
    })
  })

  it('prefers the account email over the guest address', async () => {
    orderFindUnique.mockResolvedValue(
      order({ user: { name: 'Ada', email: 'ada@example.com' } })
    )

    await handleRefundNotification(event())

    expect(sendRefundProcessedEmail.mock.calls[0][0].email).toBe('ada@example.com')
  })

  it('names the payment method the customer will see it on', async () => {
    orderFindUnique.mockResolvedValue(order({ payments: [] }))

    await handleRefundNotification(event())

    expect(sendRefundProcessedEmail.mock.calls[0][0].refundMethod).toBe('original payment method')
  })

  it('does nothing when there is no address on file', async () => {
    orderFindUnique.mockResolvedValue(order({ guestEmail: null, user: null }))

    await handleRefundNotification(event())

    expect(sendRefundProcessedEmail).not.toHaveBeenCalled()
    expect(orderUpdate).not.toHaveBeenCalled()
  })

  it('does nothing when the order has gone', async () => {
    orderFindUnique.mockResolvedValue(null)

    await expect(handleRefundNotification(event())).resolves.toBeUndefined()
    expect(sendRefundProcessedEmail).not.toHaveBeenCalled()
  })
})
