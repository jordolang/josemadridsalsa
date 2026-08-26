import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * The main storefront checkout must record that payment completed.
 *
 * This route and the Stripe webhook race to finish the same order, and whichever loses returns
 * early because the order is already paid. Only the webhook emitted `payment.completed` and only
 * the webhook sent the confirmation email — so when this route won, the customer got nothing and
 * every consumer downstream of the fact stayed silent. These tests pin the fix: the fact is
 * written, it is written inside the transaction that marks the order paid, and it is not written
 * when the route bails out.
 */

const ORDER_ID = 'clcheckoutorder0000000001'

const mockConfirmPayment = vi.fn()
const domainEventCreate = vi.fn()
const orderUpdate = vi.fn()

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(() => undefined),
    delete: vi.fn(),
  })),
}))

vi.mock('@/lib/payments', () => ({
  getProvider: () => ({ confirmPayment: mockConfirmPayment }),
}))

vi.mock('@/lib/inventory-manager', () => ({
  deductReservedInventoryOnceInTx: vi.fn(async () => ({
    newInventory: 5,
    product: { lowStockThreshold: 2 },
  })),
  releaseInventory: vi.fn(),
  releaseOrderReservation: vi.fn(async () => ({
    released: true,
    itemsReleased: 1,
    failures: 0,
  })),
  checkAndUpdateAlerts: vi.fn(),
}))

vi.mock('@/lib/orders/redeem-codes', () => ({ redeemOrderCodesInTx: vi.fn() }))
vi.mock('@/lib/fundraising/credit-commission', () => ({
  creditFundraiserCommission: vi.fn(async () => ({ credited: false, amount: 0 })),
}))
vi.mock('@/lib/loyalty', () => ({
  creditPurchaseLoyaltyPoints: vi.fn(async () => ({ awarded: false, points: 0 })),
}))

vi.mock('@/lib/prisma', () => {
  const tx = {
    order: { update: orderUpdate },
    abandonedCart: { update: vi.fn(), updateMany: vi.fn() },
    inventoryTransaction: { findFirst: vi.fn(async () => null) },
    domainEvent: { create: domainEventCreate },
  }
  const client = {
    order: { findUnique: vi.fn(), update: vi.fn() },
    // Hand the callback the transaction client, so an emit that forgets to pass `tx` would
    // show up on the singleton instead and fail the assertions below.
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  }
  return { prisma: client, db: client, default: client }
})

// Imported after the mocks rather than statically, because the factory above closes over the
// spies declared in this file and a hoisted static import would run it before they exist.
const { POST } = await import('@/app/api/checkout/complete/route')
const { default: prisma } = await import('@/lib/prisma')

function completeRequest(orderId = ORDER_ID, paymentIntentId = 'pi_live_1') {
  return new NextRequest('http://localhost:3000/api/checkout/complete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ orderId, paymentIntentId }),
  })
}

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    orderNumber: 'JMS-2001',
    userId: null,
    guestEmail: 'buyer@example.com',
    paymentStatus: 'PENDING',
    status: 'PENDING',
    total: 42,
    participantId: null,
    fundraiserId: null,
    discountCode: null,
    discountAmount: 0,
    giftCertificateCode: null,
    giftCertificateAmount: 0,
    items: [{ id: 'item1', productId: 'prod1', quantity: 2, unitPrice: 21, totalPrice: 42 }],
    ...overrides,
  }
}

function emittedEvents() {
  return domainEventCreate.mock.calls.map((call) => call[0].data)
}

describe('POST /api/checkout/complete — records the payment fact', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.order.findUnique).mockResolvedValue(order() as never)
    mockConfirmPayment.mockResolvedValue({
      success: true,
      provider: 'STRIPE',
      providerPaymentId: 'pi_live_1',
      orderId: ORDER_ID,
      amount: 4200,
      status: 'SUCCEEDED',
    })
  })

  it('emits payment.completed for the completed order', async () => {
    const response = await POST(completeRequest())

    expect(response.status).toBe(200)
    const events = emittedEvents()
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: 'payment.completed',
      entityType: 'order',
      entityId: ORDER_ID,
    })
  })

  it('emits on the transaction client, not the singleton', async () => {
    await POST(completeRequest())

    // `domainEventCreate` is only reachable through the transaction client, so a call proves
    // the fact commits with the payment rather than surviving a rolled-back one.
    expect(domainEventCreate).toHaveBeenCalledTimes(1)
    expect(orderUpdate).toHaveBeenCalledTimes(1)
  })

  it('records the provider and amount on the event payload', async () => {
    await POST(completeRequest())

    expect(emittedEvents()[0].payload).toMatchObject({
      provider: 'STRIPE',
      amount: 4200,
      currency: 'usd',
    })
  })

  it('emits nothing when the webhook already completed the order', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(
      order({ paymentStatus: 'PAID' }) as never
    )

    const response = await POST(completeRequest())

    // The loser of the race must stay quiet: the winner emitted, and a second fact would run
    // every consumer twice.
    expect(response.status).toBe(200)
    expect(domainEventCreate).not.toHaveBeenCalled()
  })

  it('emits nothing when payment was not confirmed', async () => {
    mockConfirmPayment.mockResolvedValue({ success: false, status: 'FAILED' })

    const response = await POST(completeRequest())

    expect(response.status).toBe(400)
    expect(domainEventCreate).not.toHaveBeenCalled()
  })

  it('marks a gift-certificate-covered order as such rather than as a card payment', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(
      order({ total: 0, giftCertificateCode: 'GC-1', giftCertificateAmount: 42 }) as never
    )

    const request = new NextRequest('http://localhost:3000/api/checkout/complete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderId: ORDER_ID }),
    })
    await POST(request)

    // A fully covered order has no PaymentIntent to charge, but it is still a completed sale
    // and still has to reach the consumers.
    expect(emittedEvents()[0].payload).toMatchObject({ provider: 'GIFT_CERTIFICATE', amount: 0 })
  })
})
