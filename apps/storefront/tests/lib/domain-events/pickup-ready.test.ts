import { beforeEach, describe, expect, it, vi } from 'vitest'

const orderFindUnique = vi.fn()
const sendOrderReadyForPickupEmail = vi.fn()

vi.mock('@/lib/prisma', () => {
  const client = { order: { findUnique: orderFindUnique } }
  return { prisma: client, default: client }
})

vi.mock('@/lib/email/transactional', () => ({ sendOrderReadyForPickupEmail }))

const { handlePickupReady } = await import('@/lib/domain-events/handlers/pickup-ready')
const { LOCAL_PICKUP_SHIPPING_METHOD } = await import('@/lib/orders/order-filters')

const event = {
  id: 'evt_1',
  type: 'order.fulfilled',
  entityType: 'order',
  entityId: 'order_1',
  payload: null,
  actorUserId: null,
  createdAt: new Date('2026-08-09T12:00:00Z'),
} as never

function order(overrides: Record<string, unknown> = {}) {
  return {
    orderNumber: 'JMS-1042',
    shippingMethod: LOCAL_PICKUP_SHIPPING_METHOD,
    guestEmail: 'guest@example.com',
    user: null,
    ...overrides,
  }
}

describe('pickup ready handler', () => {
  beforeEach(() => {
    orderFindUnique.mockReset()
    sendOrderReadyForPickupEmail.mockReset()
    sendOrderReadyForPickupEmail.mockResolvedValue(undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('emails the customer when a pickup order is fulfilled', async () => {
    orderFindUnique.mockResolvedValue(order())

    await handlePickupReady(event)

    expect(sendOrderReadyForPickupEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'guest@example.com', orderNumber: 'JMS-1042' })
    )
  })

  it('stays silent for a shipped order, which already gets its email from the tracking webhook', async () => {
    orderFindUnique.mockResolvedValue(order({ shippingMethod: 'USPS_PRIORITY' }))

    await handlePickupReady(event)

    expect(sendOrderReadyForPickupEmail).not.toHaveBeenCalled()
  })

  it('stays silent when no shipping method is recorded', async () => {
    orderFindUnique.mockResolvedValue(order({ shippingMethod: null }))

    await handlePickupReady(event)

    expect(sendOrderReadyForPickupEmail).not.toHaveBeenCalled()
  })

  it('prefers the account name and email over the guest address', async () => {
    orderFindUnique.mockResolvedValue(
      order({ user: { name: 'Ada', email: 'ada@example.com' } })
    )

    await handlePickupReady(event)

    expect(sendOrderReadyForPickupEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ada@example.com', name: 'Ada' })
    )
  })

  it('greets a guest without a name rather than rendering "undefined"', async () => {
    orderFindUnique.mockResolvedValue(order())

    await handlePickupReady(event)

    expect(sendOrderReadyForPickupEmail.mock.calls[0][0].name).toBe('there')
  })

  it('does nothing when a counter sale has no address on file', async () => {
    orderFindUnique.mockResolvedValue(order({ guestEmail: null, user: null }))

    await handlePickupReady(event)

    expect(sendOrderReadyForPickupEmail).not.toHaveBeenCalled()
  })

  it('does nothing when the order has gone', async () => {
    orderFindUnique.mockResolvedValue(null)

    await expect(handlePickupReady(event)).resolves.toBeUndefined()
    expect(sendOrderReadyForPickupEmail).not.toHaveBeenCalled()
  })
})
