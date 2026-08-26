import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// vi.mock factories are hoisted above module-level consts, so these must be too.
const {
  mockValidateDiscountCode,
  mockValidateGiftCertificate,
  mockCreatePayment,
  mockOrderCreate,
} = vi.hoisted(() => ({
  mockValidateDiscountCode: vi.fn(),
  mockValidateGiftCertificate: vi.fn(),
  mockCreatePayment: vi.fn(),
  mockOrderCreate: vi.fn(),
}))

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/rbac', () => ({ getCurrentUser: vi.fn(async () => null) }))
vi.mock('@/lib/audit', () => ({ logAuditWithRequest: vi.fn() }))
vi.mock('@/lib/rateLimit', () => ({ rateLimit: vi.fn(() => ({ allowed: true, retryAfterMs: 0 })) }))
vi.mock('@/lib/fundraising/referral-tracker', () => ({ getReferralFromCode: vi.fn(async () => null) }))

vi.mock('@/lib/discounts', () => ({ validateDiscountCode: mockValidateDiscountCode }))
vi.mock('@/lib/gift-certificates', () => ({ validateGiftCertificate: mockValidateGiftCertificate }))

vi.mock('@/lib/inventory-manager', () => ({
  reserveMultipleProducts: vi.fn(async () => []),
  releaseInventory: vi.fn(async () => {}),
}))

// $20.00 of goods, $5 shipping, no tax — keeps the arithmetic checkable by hand.
vi.mock('@/lib/shipping-calculator', async (importOriginal) => ({
  // Only the rate call is stubbed. `buildShippingItems` is pure mapping — the thing that turns
  // catalogue rows into parcel weights and dimensions — so the real one is kept, and a unit
  // mistake in it fails these tests rather than being mocked away.
  ...(await importOriginal<typeof import('@/lib/shipping-calculator')>()),
  calculateShipping: vi.fn(async () => ({
    shippingCost: 5,
    shippingMethod: 'Standard Shipping',
    estimatedDelivery: '3-5 days',
    options: [],
  })),
}))
vi.mock('@/lib/tax-calculator', () => ({
  calculateTax: vi.fn(async () => ({ taxAmountDecimal: 0, taxRate: 0, taxBreakdown: [] })),
}))

vi.mock('@/lib/payments', () => ({
  getProvider: () => ({
    createPayment: mockCreatePayment,
    createCustomer: vi.fn(),
  }),
}))

vi.mock('@/lib/prisma', () => {
  const client = {
    product: {
      findMany: vi.fn(async () => [
        {
          id: 'cjld2cyuq0000t3rmniod1foy',
          name: 'Garden Cilantro Salsa',
          sku: 'GCS-1',
          price: 10,
          weight: 1,
          featuredImage: null,
        },
      ]),
    },
    order: { create: mockOrderCreate },
    user: { findUnique: vi.fn(async () => null) },
    abandonedCart: { updateMany: vi.fn() },
    storeSettings: { findUnique: vi.fn(async () => null) },
  }
  return { prisma: client, db: client, default: client }
})

import { POST } from '@/app/api/checkout/route'

function checkoutRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      items: [{ productId: 'cjld2cyuq0000t3rmniod1foy', quantity: 2 }], // 2 x $10 = $20 subtotal
      customer: { email: 'buyer@example.com', firstName: 'Sam', lastName: 'Buyer' },
      shipping: { address1: '1 Main St', city: 'Zanesville', state: 'OH', postalCode: '43701' },
      ...body,
    }),
  })
}

function createdOrderData() {
  return mockOrderCreate.mock.calls[0][0].data
}

describe('POST /api/checkout — discount and gift certificate pricing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mirrors what the route's own `include: { items: true }` returns. The stub previously
    // carried only id and orderNumber, which no real call to this query can produce.
    mockOrderCreate.mockResolvedValue({
      id: 'clorderaaaaaaaaaaaaaaaaaa',
      orderNumber: 'JMS-1',
      total: 20,
      salesChannel: 'WEBSITE',
      items: [{ id: 'clitemaaaaaaaaaaaaaaaaaaa' }],
    })
    mockCreatePayment.mockResolvedValue({ success: true, clientSecret: 'cs_test' })
    process.env.NEXTAUTH_SECRET = 'test-secret'
  })

  it('computes the discount server-side from the code alone', async () => {
    // 15% off $20 of goods = $3.00
    mockValidateDiscountCode.mockResolvedValue({
      valid: true,
      discountAmount: 3,
      discountCode: { id: 'd1', code: 'WELCOME15', type: 'PERCENTAGE', value: 15, description: null },
    })

    const response = await POST(checkoutRequest({ discountCode: 'welcome15' }))
    expect(response.status).toBe(200)

    const data = createdOrderData()
    // subtotal 20 - discount 3 + shipping 5 + tax 0 = 22
    expect(Number(data.subtotal)).toBe(20)
    expect(Number(data.discountAmount)).toBe(3)
    expect(data.discountCode).toBe('WELCOME15')
    expect(Number(data.total)).toBe(22)
  })

  it('ignores any client-supplied discount amount, trusting only the code', async () => {
    mockValidateDiscountCode.mockResolvedValue({
      valid: true,
      discountAmount: 3,
      discountCode: { id: 'd1', code: 'WELCOME15', type: 'PERCENTAGE', value: 15, description: null },
    })

    // A tampered client claims a $19.99 discount. The server must not honor it.
    const response = await POST(
      checkoutRequest({ discountCode: 'WELCOME15', discountAmount: 19.99, total: 0.01 })
    )
    expect(response.status).toBe(200)

    const data = createdOrderData()
    expect(Number(data.discountAmount)).toBe(3)
    expect(Number(data.total)).toBe(22)
  })

  it('rejects an invalid discount code rather than silently ignoring it', async () => {
    mockValidateDiscountCode.mockResolvedValue({ valid: false, error: 'This discount code has expired' })

    const response = await POST(checkoutRequest({ discountCode: 'EXPIRED' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'This discount code has expired' })
    expect(mockOrderCreate).not.toHaveBeenCalled()
  })

  it('applies a gift certificate against the full amount due', async () => {
    mockValidateGiftCertificate.mockResolvedValue({
      valid: true,
      code: 'GIFT10',
      balance: 10,
      applicableAmount: 10,
    })

    const response = await POST(checkoutRequest({ giftCertificateCode: 'gift10' }))
    expect(response.status).toBe(200)

    const data = createdOrderData()
    // 20 goods + 5 shipping = 25 due, less a $10 certificate = $15 charged
    expect(Number(data.giftCertificateAmount)).toBe(10)
    expect(data.giftCertificateCode).toBe('GIFT10')
    expect(Number(data.total)).toBe(15)
  })

  it('skips payment entirely when a gift certificate covers the whole order', async () => {
    mockValidateGiftCertificate.mockResolvedValue({
      valid: true,
      code: 'GIFT100',
      balance: 100,
      applicableAmount: 25, // capped at the amount due
    })

    const response = await POST(checkoutRequest({ giftCertificateCode: 'GIFT100' }))
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.requiresPayment).toBe(false)
    expect(Number(createdOrderData().total)).toBe(0)
    // Stripe rejects a zero-amount PaymentIntent, so none should be created.
    expect(mockCreatePayment).not.toHaveBeenCalled()
  })

  it('leaves an undiscounted order exactly as before', async () => {
    const response = await POST(checkoutRequest({}))
    expect(response.status).toBe(200)

    const data = createdOrderData()
    expect(Number(data.discountAmount)).toBe(0)
    expect(data.discountCode).toBeNull()
    expect(Number(data.total)).toBe(25)
    expect(mockValidateDiscountCode).not.toHaveBeenCalled()
  })
})
