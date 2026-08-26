import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Behavioural tests for the abandoned-checkout sweep.
 *
 * The leak this closes: checkout reserves stock, then asks the browser to confirm the card.
 * When that confirmation fails — or the tab closes — `/api/checkout/complete` is never
 * called, so no server-side path ever learns the order is dead. It stays PENDING and its
 * stock stays reserved indefinitely.
 *
 * The two things worth pinning down are which orders the sweep is willing to touch (it must
 * never take stock back from something that got paid) and that cancelling and releasing stay
 * in step, since `retry-payment` refuses cancelled orders and that refusal is what stops a
 * customer paying for stock already given away.
 */

const findMany = vi.fn()
const update = vi.fn()
const releaseOrderReservation = vi.fn()

vi.mock('@/lib/prisma', () => ({
  default: { order: { findMany: (...a: unknown[]) => findMany(...a), update: (...a: unknown[]) => update(...a) } },
}))
vi.mock('@/lib/inventory-manager', () => ({
  releaseOrderReservation: (...a: unknown[]) => releaseOrderReservation(...a),
}))
vi.mock('@/lib/cron/auth', () => ({
  isAuthorizedCronRequest: (req: Request) => req.headers.get('authorization') === 'Bearer ok',
}))

const { GET } = await import('@/app/api/cron/expire-pending-orders/route')

const authed = () =>
  new Request('http://localhost/api/cron/expire-pending-orders', {
    headers: { authorization: 'Bearer ok' },
  })

beforeEach(() => {
  findMany.mockReset()
  update.mockReset()
  releaseOrderReservation.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('GET /api/cron/expire-pending-orders', () => {
  it('refuses an unauthorized caller', async () => {
    const response = await GET(new Request('http://localhost/api/cron/expire-pending-orders'))
    expect(response.status).toBe(401)
    expect(findMany).not.toHaveBeenCalled()
  })

  it('only considers unpaid PENDING orders that still hold their reservation', async () => {
    findMany.mockResolvedValue([])

    await GET(authed())

    const where = findMany.mock.calls[0][0].where
    expect(where.status).toBe('PENDING')
    expect(where.inventoryReleasedAt).toBeNull()
    expect(where.createdAt.lte).toBeInstanceOf(Date)
    // A paid order must never have its stock taken back, even if its status lagged behind.
    expect(where.paymentStatus.notIn).toEqual(
      expect.arrayContaining(['PAID', 'SUCCEEDED', 'REFUNDED', 'PARTIALLY_REFUNDED'])
    )
  })

  it('looks back by the configured window rather than an arbitrary date', async () => {
    const { PENDING_ORDER_EXPIRY_HOURS } = await import('@/lib/operations/aging')
    findMany.mockResolvedValue([])

    const before = Date.now()
    await GET(authed())

    const cutoff: Date = findMany.mock.calls[0][0].where.createdAt.lte
    const expected = before - PENDING_ORDER_EXPIRY_HOURS * 60 * 60 * 1000
    expect(Math.abs(cutoff.getTime() - expected)).toBeLessThan(5_000)
  })

  it('cancels each order whose reservation it actually released', async () => {
    findMany.mockResolvedValue([
      { id: 'order-1', orderNumber: 'JMS-1' },
      { id: 'order-2', orderNumber: 'JMS-2' },
    ])
    releaseOrderReservation.mockResolvedValue({ released: true, itemsReleased: 1, failures: 0 })
    update.mockResolvedValue({})

    const response = await GET(authed())
    const body = await response.json()

    expect(body).toMatchObject({ success: true, scanned: 2, expired: 2 })
    expect(body.orderNumbers).toEqual(['JMS-1', 'JMS-2'])
    expect(update).toHaveBeenCalledTimes(2)
    expect(update.mock.calls[0][0].data).toMatchObject({
      status: 'CANCELLED',
      paymentStatus: 'FAILED',
    })
  })

  it('leaves an order alone when another path had already released it', async () => {
    findMany.mockResolvedValue([{ id: 'order-1', orderNumber: 'JMS-1' }])
    releaseOrderReservation.mockResolvedValue({ released: false, itemsReleased: 0, failures: 0 })

    const response = await GET(authed())
    const body = await response.json()

    // Not cancelling here matters: the other path may have left the order retryable.
    expect(update).not.toHaveBeenCalled()
    expect(body).toMatchObject({ scanned: 1, expired: 0 })
  })

  it('reports a failure instead of throwing', async () => {
    findMany.mockRejectedValue(new Error('db down'))

    const response = await GET(authed())

    expect(response.status).toBe(500)
  })
})
