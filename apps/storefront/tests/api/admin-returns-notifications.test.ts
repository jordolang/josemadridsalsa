import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * The staff-opened return — the other half of the pair the audit scored as two rows.
 *
 * It differs from the customer path in two ways that matter: staff may accept a return past the
 * published window, and the return opens as REQUESTED rather than APPROVED. Both are recorded on
 * the event, so a consumer can tell a self-serve return from one somebody accepted by hand.
 */

const getCurrentUser = vi.fn()
const hasPermission = vi.fn()
const orderFindUnique = vi.fn()
const returnRequestCreate = vi.fn()
const emitDomainEvent = vi.fn()
const notifyOperators = vi.fn()
const logAuditWithRequest = vi.fn()

vi.mock('@/lib/rbac', () => ({ getCurrentUser, hasPermission }))

vi.mock('@/lib/prisma', () => {
  const client = {
    order: { findUnique: orderFindUnique },
    returnRequest: { create: returnRequestCreate, findMany: vi.fn() },
  }
  return { prisma: client, default: client }
})

vi.mock('@/lib/domain-events/emit', () => ({ emitDomainEvent }))
vi.mock('@/lib/audit', () => ({ logAuditWithRequest }))

vi.mock('@/lib/notifications/dispatch', () => ({
  notifyOperators,
  severityFor: () => 'WARNING',
  dedupeKeys: { returnRequested: (id: string) => `return:${id}` },
}))

const { POST } = await import('@/app/api/admin/returns/route')

const ORDER_ID = 'cladminreturnorder0000001'
const ITEM_ID = 'cladminreturnitem0000001'

function createReturn(body: Record<string, unknown> = {}) {
  return new NextRequest('http://localhost:3000/api/admin/returns', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      orderId: ORDER_ID,
      reason: 'QUALITY_ISSUE',
      items: [{ orderItemId: ITEM_ID, quantity: 1 }],
      ...body,
    }),
  })
}

/** Shipped long enough ago that the published return window has closed. */
const LONG_AGO = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000)

beforeEach(() => {
  vi.clearAllMocks()
  getCurrentUser.mockResolvedValue({ id: 'admin_1' })
  hasPermission.mockResolvedValue(true)
  orderFindUnique.mockResolvedValue({
    id: ORDER_ID,
    orderNumber: 'JMS-7001',
    shippedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    items: [{ id: ITEM_ID, quantity: 2, quantityFulfilled: 2, unitPrice: 9, returnItems: [] }],
  })
  returnRequestCreate.mockResolvedValue({
    id: 'ret_admin_1',
    rmaNumber: 'RMA-2026-0002',
    items: [],
  })
  logAuditWithRequest.mockResolvedValue(undefined)
})

describe('POST /api/admin/returns', () => {
  it('notifies operators and records the fact against the order', async () => {
    await POST(createReturn())

    expect(notifyOperators).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'RETURN_REQUESTED', entityId: 'ret_admin_1' })
    )
    expect(emitDomainEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'order.returned',
        entityId: ORDER_ID,
        actorUserId: 'admin_1',
        payload: expect.objectContaining({ status: 'REQUESTED' }),
      })
    )
  })

  it('refuses a caller without write permission on orders', async () => {
    hasPermission.mockResolvedValue(false)

    const response = await POST(createReturn())

    expect(response.status).toBe(401)
    expect(returnRequestCreate).not.toHaveBeenCalled()
    expect(notifyOperators).not.toHaveBeenCalled()
  })

  it('refuses an unauthenticated caller', async () => {
    getCurrentUser.mockResolvedValue(null)

    const response = await POST(createReturn())

    expect(response.status).toBe(401)
    expect(emitDomainEvent).not.toHaveBeenCalled()
  })

  it('rejects a late return by default', async () => {
    orderFindUnique.mockResolvedValue({
      id: ORDER_ID,
      orderNumber: 'JMS-7001',
      shippedAt: LONG_AGO,
      items: [{ id: ITEM_ID, quantity: 2, quantityFulfilled: 2, unitPrice: 9, returnItems: [] }],
    })

    const response = await POST(createReturn())

    expect(response.status).toBe(400)
    expect(notifyOperators).not.toHaveBeenCalled()
  })

  it('lets staff accept a late return when they say so explicitly', async () => {
    orderFindUnique.mockResolvedValue({
      id: ORDER_ID,
      orderNumber: 'JMS-7001',
      shippedAt: LONG_AGO,
      items: [{ id: ITEM_ID, quantity: 2, quantityFulfilled: 2, unitPrice: 9, returnItems: [] }],
    })

    // The override is an explicit choice rather than a side effect of being staff, which is why
    // it is worth a test of its own.
    await POST(createReturn({ ignoreWindow: true }))

    expect(returnRequestCreate).toHaveBeenCalled()
    expect(notifyOperators).toHaveBeenCalled()
  })

  it('does not double-count units already claimed by a live return', async () => {
    orderFindUnique.mockResolvedValue({
      id: ORDER_ID,
      orderNumber: 'JMS-7001',
      shippedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      items: [
        {
          id: ITEM_ID,
          quantity: 2,
          quantityFulfilled: 2,
          unitPrice: 9,
          returnItems: [{ quantity: 2 }],
        },
      ],
    })

    const response = await POST(createReturn())

    expect(response.status).toBe(400)
    expect(returnRequestCreate).not.toHaveBeenCalled()
  })

  it('leaves an audit trail naming the admin who opened it', async () => {
    await POST(createReturn())

    expect(logAuditWithRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin_1',
        action: 'create',
        entityType: 'return_request',
        entityId: 'ret_admin_1',
      }),
      expect.anything()
    )
  })
})
