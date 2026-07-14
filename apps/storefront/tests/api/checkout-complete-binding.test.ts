import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// A succeeded PaymentIntent that belongs to a DIFFERENT, cheap order.
// This is what an attacker replays against an expensive unpaid order.
const OTHER_ORDER_ID = 'clcheapordercuid0000000001'
const TARGET_ORDER_ID = 'clexpensiveordercuid00001'

const mockConfirmPayment = vi.fn()

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(() => undefined),
    delete: vi.fn(),
  })),
}))

vi.mock('@/lib/payments', () => ({
  getProvider: () => ({
    confirmPayment: mockConfirmPayment,
  }),
}))

vi.mock('@/lib/prisma', () => {
  const mockPrismaClient = {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  }
  return { prisma: mockPrismaClient, db: mockPrismaClient, default: mockPrismaClient }
})

vi.mock('@/lib/inventory-manager', () => ({
  deductReservedInventoryInTx: vi.fn(),
  releaseInventory: vi.fn(),
  checkAndUpdateAlerts: vi.fn(),
}))

import { POST } from '@/app/api/checkout/complete/route'
import prisma from '@/lib/prisma'

function completeRequest(orderId: string, paymentIntentId: string) {
  return new NextRequest('http://localhost:3000/api/checkout/complete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ orderId, paymentIntentId }),
  })
}

// The $300 order the attacker wants for free.
const targetOrder = {
  id: TARGET_ORDER_ID,
  orderNumber: 'JMS-1002',
  userId: null,
  guestEmail: 'attacker@example.com',
  paymentStatus: 'PENDING',
  status: 'PENDING',
  total: 300,
  participantId: null,
  fundraiserId: null,
  items: [
    { id: 'item1', productId: 'prod1', quantity: 10, unitPrice: 30, totalPrice: 300 },
  ],
}

describe('POST /api/checkout/complete — PaymentIntent must be bound to the order', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.order.findUnique).mockResolvedValue(targetOrder as never)
  })

  it('rejects a succeeded PaymentIntent that belongs to a different order', async () => {
    // Attacker replays a real, succeeded PaymentIntent from their earlier $8 order.
    mockConfirmPayment.mockResolvedValue({
      success: true,
      provider: 'STRIPE',
      providerPaymentId: 'pi_from_cheap_order',
      status: 'SUCCEEDED',
      amount: 800, // $8.00, not $300.00
      orderId: OTHER_ORDER_ID, // belongs to a different order
    })

    const response = await POST(completeRequest(TARGET_ORDER_ID, 'pi_from_cheap_order'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Payment does not match this order.',
    })
    // The order must NOT be marked paid, and inventory must not be deducted.
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('rejects a PaymentIntent for this order that underpays the total', async () => {
    // Same order, but the PaymentIntent only covers $8 of a $300 order.
    mockConfirmPayment.mockResolvedValue({
      success: true,
      provider: 'STRIPE',
      providerPaymentId: 'pi_underpaid',
      status: 'SUCCEEDED',
      amount: 800,
      orderId: TARGET_ORDER_ID,
    })

    const response = await POST(completeRequest(TARGET_ORDER_ID, 'pi_underpaid'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Payment does not match this order.',
    })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('accepts a PaymentIntent bound to the order for the full amount', async () => {
    mockConfirmPayment.mockResolvedValue({
      success: true,
      provider: 'STRIPE',
      providerPaymentId: 'pi_legit',
      status: 'SUCCEEDED',
      amount: 30000, // $300.00
      orderId: TARGET_ORDER_ID,
    })
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined as never)

    const response = await POST(completeRequest(TARGET_ORDER_ID, 'pi_legit'))

    expect(response.status).toBe(200)
    expect(prisma.$transaction).toHaveBeenCalled()
  })
})
