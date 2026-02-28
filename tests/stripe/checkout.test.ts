import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/checkout/create-session/route'
import type { CheckoutSessionRequest } from '@/lib/stripe/types'

// Mock Stripe checkout sessions create
const mockCheckoutSessionsCreate = vi.fn()

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  default: {
    order: {
      findUnique: vi.fn(),
    },
    payment: {
      create: vi.fn(),
    },
  },
}))

// Mock Stripe
vi.mock('@/lib/stripe', () => ({
  getStripe: vi.fn(() => ({
    checkout: {
      sessions: {
        create: mockCheckoutSessionsCreate,
      },
    },
  })),
}))

const mockOrder = {
  id: 'order-123',
  orderNumber: 'JMS-20260228-1234',
  total: 29.99,
  paymentStatus: 'PENDING',
  guestEmail: 'guest@example.com',
  user: null,
  items: [
    {
      id: 'item-1',
      productName: 'Salsa Roja',
      quantity: 2,
      unitPrice: 12.99,
    },
  ],
}

const mockStripeSession = {
  id: 'cs_test_123',
  url: 'https://checkout.stripe.com/pay/cs_test_123',
}

describe('Stripe checkout session creation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckoutSessionsCreate.mockClear()
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
  })

  it('creates checkout session with valid order', async () => {
    const { default: prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)
    mockCheckoutSessionsCreate.mockResolvedValue(mockStripeSession)
    vi.mocked(prisma.payment.create).mockResolvedValue({
      id: 'payment-123',
      orderId: 'order-123',
      stripeCheckoutSessionId: 'cs_test_123',
      amount: 2999,
      currency: 'usd',
      status: 'PENDING',
    } as any)

    const requestBody: CheckoutSessionRequest = {
      orderId: 'clxxx1234567890abc',
    }

    const request = new NextRequest('http://localhost/api/checkout/create-session', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.sessionId).toBe('cs_test_123')
    expect(data.url).toBe('https://checkout.stripe.com/pay/cs_test_123')
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        customer_email: 'guest@example.com',
        metadata: expect.objectContaining({
          orderId: 'order-123',
          orderNumber: 'JMS-20260228-1234',
        }),
      })
    )
  })

  it('validates checkout session request schema', async () => {
    const request = new NextRequest('http://localhost/api/checkout/create-session', {
      method: 'POST',
      body: JSON.stringify({ orderId: 'invalid-id' }), // Not a CUID
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid checkout session request')
    expect(data.details).toBeDefined()
  })

  it('returns 404 when order not found', async () => {
    const { default: prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.order.findUnique).mockResolvedValue(null)

    const requestBody: CheckoutSessionRequest = {
      orderId: 'clxxx1234567890abc',
    }

    const request = new NextRequest('http://localhost/api/checkout/create-session', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Order not found')
  })

  it('rejects already paid orders', async () => {
    const { default: prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      ...mockOrder,
      paymentStatus: 'PAID',
    } as any)

    const requestBody: CheckoutSessionRequest = {
      orderId: 'clxxx1234567890abc',
    }

    const request = new NextRequest('http://localhost/api/checkout/create-session', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Order has already been paid')
  })

  it('uses authenticated user email when available', async () => {
    const { default: prisma } = await import('@/lib/prisma')

    const orderWithUser = {
      ...mockOrder,
      guestEmail: null,
      user: {
        id: 'user-123',
        email: 'user@example.com',
      },
    }

    vi.mocked(prisma.order.findUnique).mockResolvedValue(orderWithUser as any)
    mockCheckoutSessionsCreate.mockResolvedValue(mockStripeSession)
    vi.mocked(prisma.payment.create).mockResolvedValue({} as any)

    const requestBody: CheckoutSessionRequest = {
      orderId: 'clxxx1234567890abc',
    }

    const request = new NextRequest('http://localhost/api/checkout/create-session', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    })

    await POST(request)

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_email: 'user@example.com',
      })
    )
  })

  it('uses custom success and cancel URLs when provided', async () => {
    const { default: prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)
    mockCheckoutSessionsCreate.mockResolvedValue(mockStripeSession)
    vi.mocked(prisma.payment.create).mockResolvedValue({} as any)

    const requestBody: CheckoutSessionRequest = {
      orderId: 'clxxx1234567890abc',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    }

    const request = new NextRequest('http://localhost/api/checkout/create-session', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    })

    await POST(request)

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
      })
    )
  })

  it('uses default URLs when not provided', async () => {
    const { default: prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)
    mockCheckoutSessionsCreate.mockResolvedValue(mockStripeSession)
    vi.mocked(prisma.payment.create).mockResolvedValue({} as any)

    const requestBody: CheckoutSessionRequest = {
      orderId: 'clxxx1234567890abc',
    }

    const request = new NextRequest('http://localhost/api/checkout/create-session', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    })

    await POST(request)

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        success_url: 'http://localhost:3000/checkout/success?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'http://localhost:3000/checkout/cancel',
      })
    )
  })

  it('converts order total to cents correctly', async () => {
    const { default: prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)
    mockCheckoutSessionsCreate.mockResolvedValue(mockStripeSession)
    vi.mocked(prisma.payment.create).mockResolvedValue({} as any)

    const requestBody: CheckoutSessionRequest = {
      orderId: 'clxxx1234567890abc',
    }

    const request = new NextRequest('http://localhost/api/checkout/create-session', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    })

    await POST(request)

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({
              unit_amount: 2999, // 29.99 * 100
            }),
            quantity: 1,
          }),
        ],
      })
    )
  })

  it('creates line items with correct product data', async () => {
    const { default: prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)
    mockCheckoutSessionsCreate.mockResolvedValue(mockStripeSession)
    vi.mocked(prisma.payment.create).mockResolvedValue({} as any)

    const requestBody: CheckoutSessionRequest = {
      orderId: 'clxxx1234567890abc',
    }

    const request = new NextRequest('http://localhost/api/checkout/create-session', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    })

    await POST(request)

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({
              currency: 'usd',
              product_data: {
                name: 'Order #JMS-20260228-1234',
                description: '1 item(s)',
              },
            }),
          }),
        ],
      })
    )
  })

  it('creates pending payment record', async () => {
    const { default: prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)
    mockCheckoutSessionsCreate.mockResolvedValue(mockStripeSession)
    vi.mocked(prisma.payment.create).mockResolvedValue({} as any)

    const requestBody: CheckoutSessionRequest = {
      orderId: 'clxxx1234567890abc',
    }

    const request = new NextRequest('http://localhost/api/checkout/create-session', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    })

    await POST(request)

    expect(prisma.payment.create).toHaveBeenCalledWith({
      data: {
        orderId: 'order-123',
        stripeCheckoutSessionId: 'cs_test_123',
        stripePaymentIntentId: '',
        amount: 2999,
        currency: 'usd',
        status: 'PENDING',
        metadata: {
          orderNumber: 'JMS-20260228-1234',
          itemCount: 1,
        },
      },
    })
  })

  it('handles Stripe API errors gracefully', async () => {
    const { default: prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)
    mockCheckoutSessionsCreate.mockRejectedValue(new Error('Stripe API error'))

    const requestBody: CheckoutSessionRequest = {
      orderId: 'clxxx1234567890abc',
    }

    const request = new NextRequest('http://localhost/api/checkout/create-session', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Unable to create checkout session. Please try again.')
  })

  it('handles database errors gracefully', async () => {
    const { default: prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.order.findUnique).mockRejectedValue(new Error('Database error'))

    const requestBody: CheckoutSessionRequest = {
      orderId: 'clxxx1234567890abc',
    }

    const request = new NextRequest('http://localhost/api/checkout/create-session', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Unable to create checkout session. Please try again.')
  })
})
