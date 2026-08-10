import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * A customer-opened return has to reach staff.
 *
 * The return is approved the moment it is created — a customer inside the published window does
 * not need permission to post something back — so nothing else in the system will surface it.
 * If the notification or the domain event is dropped, the goods arrive at the warehouse against
 * an RMA nobody has seen, and the audit's "return requested" row would still look wired because
 * the call site exists.
 */

const getServerSession = vi.fn()
const orderFindFirst = vi.fn()
const returnRequestCreate = vi.fn()
const emitDomainEvent = vi.fn()
const notifyOperators = vi.fn()
const getShippingOrigin = vi.fn()

vi.mock('next-auth', () => ({ getServerSession }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

vi.mock('@/lib/prisma', () => {
  const client = {
    order: { findFirst: orderFindFirst },
    returnRequest: { create: returnRequestCreate },
  }
  return { prisma: client, default: client }
})

vi.mock('@/lib/domain-events/emit', () => ({ emitDomainEvent }))

vi.mock('@/lib/notifications/dispatch', () => ({
  notifyOperators,
  severityFor: () => 'WARNING',
  dedupeKeys: { returnRequested: (id: string) => `return:${id}` },
}))

vi.mock('@/lib/shipping/origin', () => ({
  getShippingOrigin,
  describeMissingOrigin: () => 'Warehouse address is not configured',
}))

const { POST } = await import('@/app/api/account/returns/route')

const ORDER_ID = 'clreturnorder000000000001'

function returnRequest(body: Record<string, unknown> = {}) {
  return new NextRequest('http://localhost:3000/api/account/returns', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      orderId: ORDER_ID,
      reason: 'DAMAGED',
      items: [{ orderItemId: 'clreturnitem00000000001', quantity: 1 }],
      ...body,
    }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  getServerSession.mockResolvedValue({ user: { id: 'user_1' } })
  orderFindFirst.mockResolvedValue({
    id: ORDER_ID,
    orderNumber: 'JMS-6001',
    // Shipped recently, so the return falls inside the published window.
    shippedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    items: [
      { id: 'clreturnitem00000000001', quantity: 2, quantityFulfilled: 2, unitPrice: 9, returnItems: [] },
    ],
  })
  returnRequestCreate.mockResolvedValue({
    id: 'ret_1',
    rmaNumber: 'RMA-2026-0001',
    status: 'APPROVED',
  })
  getShippingOrigin.mockResolvedValue({
    ok: true,
    origin: {
      name: 'Jose Madrid Salsa',
      street1: '123 Warehouse Way',
      city: 'Zanesville',
      state: 'OH',
      zip: '43701',
      country: 'US',
    },
  })
})

describe('POST /api/account/returns', () => {
  it('notifies staff that a return was opened, with a link to it', async () => {
    await POST(returnRequest())

    expect(notifyOperators).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RETURN_REQUESTED',
        entityType: 'return_request',
        entityId: 'ret_1',
        link: '/admin/returns/ret_1',
        dedupeKey: 'return:ret_1',
      })
    )
  })

  it('names the RMA and the order in the message staff actually read', async () => {
    await POST(returnRequest())

    const notification = notifyOperators.mock.calls[0][0]
    expect(notification.message).toContain('RMA-2026-0001')
    expect(notification.message).toContain('JMS-6001')
  })

  it('records the return as a domain event against the order', async () => {
    await POST(returnRequest())

    expect(emitDomainEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'order.returned',
        entityType: 'order',
        entityId: ORDER_ID,
        actorUserId: 'user_1',
        payload: expect.objectContaining({ rmaNumber: 'RMA-2026-0001', via: 'customer' }),
      })
    )
  })

  it('turns nobody away without a session', async () => {
    getServerSession.mockResolvedValue(null)

    const response = await POST(returnRequest())

    expect(response.status).toBe(401)
    expect(returnRequestCreate).not.toHaveBeenCalled()
    expect(notifyOperators).not.toHaveBeenCalled()
  })

  it('scopes the lookup to the signed-in customer', async () => {
    await POST(returnRequest())

    // A customer may only return their own order, and a guessed id must resolve to nothing
    // rather than confirming the order exists.
    expect(orderFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ORDER_ID, userId: 'user_1' } })
    )
  })

  it('notifies nobody when the order is not the customer’s', async () => {
    orderFindFirst.mockResolvedValue(null)

    const response = await POST(returnRequest())

    expect(response.status).toBe(404)
    expect(notifyOperators).not.toHaveBeenCalled()
    expect(emitDomainEvent).not.toHaveBeenCalled()
  })

  it('notifies nobody when the requested quantity exceeds what was bought', async () => {
    const response = await POST(
      returnRequest({ items: [{ orderItemId: 'clreturnitem00000000001', quantity: 99 }] })
    )

    expect(response.status).toBe(400)
    expect(returnRequestCreate).not.toHaveBeenCalled()
    expect(notifyOperators).not.toHaveBeenCalled()
  })

  it('still opens and announces the return when the warehouse address is missing', async () => {
    getShippingOrigin.mockResolvedValue({ ok: false })

    const response = await POST(returnRequest())

    // The return is already approved at this point. Failing here would leave an open RMA that
    // nobody was told about.
    expect(response.status).toBe(201)
    expect(notifyOperators).toHaveBeenCalled()
  })
})
