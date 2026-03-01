import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/payment/route'

// Mock dependencies
vi.mock('@/lib/rbac', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/audit', () => ({
  logAuditWithRequest: vi.fn(),
}))

// Route uses paymentIntents.confirm, NOT create — prevents double-charging
const mockPaymentIntentsConfirm = vi.fn()

vi.mock('@/lib/stripe', () => ({
  getStripe: vi.fn(() => ({
    paymentIntents: {
      confirm: mockPaymentIntentsConfirm,
    },
  })),
}))

// Mock rate limiter to allow all requests through in tests
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 99, resetIn: 60, current: 1 })),
  getClientIdentifier: vi.fn(() => 'test-ip'),
  createRateLimitHeaders: vi.fn(() => ({})),
  RATE_LIMITS: {
    API_GENERAL: { maxRequests: 100, windowSeconds: 60 },
  },
}))

describe('Payment API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPaymentIntentsConfirm.mockClear()
  })

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'CUSTOMER',
  }

  // Order must have a stripePaymentId to confirm
  const mockOrder: any = {
    id: 'claaa1234567890abc',
    orderNumber: 'JMS-20260301-1234',
    userId: 'user-123',
    guestEmail: null,
    status: 'PENDING',
    paymentStatus: 'PENDING',
    subtotal: 17.98,
    shippingCost: 8.99,
    tax: 2.5,
    discountAmount: 0,
    total: 29.47,
    stripePaymentId: 'pi_existing123',
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [
      {
        id: 'clbbb1234567890abc',
        productId: 'clyyy1234567890abc',
        productName: 'Test Salsa',
        quantity: 2,
        unitPrice: 8.99,
        totalPrice: 17.98,
      },
    ],
  }

  const validPaymentData = {
    orderId: 'claaa1234567890abc',
    paymentMethodId: 'pm_card_visa',
  }

  describe('POST /api/payment', () => {
    it('should return 401 when user is not authenticated', async () => {
      const { getCurrentUser } = await import('@/lib/rbac')
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/payment', {
        method: 'POST',
        body: JSON.stringify(validPaymentData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication required to process payment')
    })

    it('should return 400 when payload is invalid', async () => {
      const { getCurrentUser } = await import('@/lib/rbac')
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser)

      const request = new NextRequest('http://localhost/api/payment', {
        method: 'POST',
        body: JSON.stringify({ orderId: 'claaa1234567890abc' }), // Missing paymentMethodId
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid payment payload')
    })

    it('should return 400 when orderId format is invalid', async () => {
      const { getCurrentUser } = await import('@/lib/rbac')
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser)

      const request = new NextRequest('http://localhost/api/payment', {
        method: 'POST',
        body: JSON.stringify({
          orderId: 'not-a-cuid',
          paymentMethodId: 'pm_card_visa',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid payment payload')
    })

    it('should return 404 when order does not exist', async () => {
      const { getCurrentUser } = await import('@/lib/rbac')
      const { default: prisma } = await import('@/lib/prisma')

      vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
      vi.mocked(prisma.order.findUnique).mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/payment', {
        method: 'POST',
        body: JSON.stringify(validPaymentData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Order not found')
    })

    it('should return 403 when order belongs to different user', async () => {
      const { getCurrentUser } = await import('@/lib/rbac')
      const { default: prisma } = await import('@/lib/prisma')

      vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
      vi.mocked(prisma.order.findUnique).mockResolvedValue({
        ...mockOrder,
        userId: 'different-user',
      })

      const request = new NextRequest('http://localhost/api/payment', {
        method: 'POST',
        body: JSON.stringify(validPaymentData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('You do not have permission to pay for this order')
    })

    it('should return 403 when order userId is null (cannot bypass ownership)', async () => {
      const { getCurrentUser } = await import('@/lib/rbac')
      const { default: prisma } = await import('@/lib/prisma')

      vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
      // userId is null — must NOT bypass ownership check
      vi.mocked(prisma.order.findUnique).mockResolvedValue({
        ...mockOrder,
        userId: null,
      })

      const request = new NextRequest('http://localhost/api/payment', {
        method: 'POST',
        body: JSON.stringify(validPaymentData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('You do not have permission to pay for this order')
    })

    it('should return 400 when order is already paid', async () => {
      const { getCurrentUser } = await import('@/lib/rbac')
      const { default: prisma } = await import('@/lib/prisma')

      vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
      vi.mocked(prisma.order.findUnique).mockResolvedValue({
        ...mockOrder,
        paymentStatus: 'PAID',
      })

      const request = new NextRequest('http://localhost/api/payment', {
        method: 'POST',
        body: JSON.stringify(validPaymentData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Order has already been paid')
    })

    it('should return 400 when order is cancelled', async () => {
      const { getCurrentUser } = await import('@/lib/rbac')
      const { default: prisma } = await import('@/lib/prisma')

      vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
      vi.mocked(prisma.order.findUnique).mockResolvedValue({
        ...mockOrder,
        status: 'CANCELLED',
      })

      const request = new NextRequest('http://localhost/api/payment', {
        method: 'POST',
        body: JSON.stringify(validPaymentData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('cancelled')
    })

    it('should return 400 when order has no existing PaymentIntent', async () => {
      const { getCurrentUser } = await import('@/lib/rbac')
      const { default: prisma } = await import('@/lib/prisma')

      vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
      vi.mocked(prisma.order.findUnique).mockResolvedValue({
        ...mockOrder,
        stripePaymentId: null,
      })

      const request = new NextRequest('http://localhost/api/payment', {
        method: 'POST',
        body: JSON.stringify(validPaymentData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('No payment intent found for this order')
    })

    it('should confirm existing PaymentIntent (not create new one)', async () => {
      const { getCurrentUser } = await import('@/lib/rbac')
      const { default: prisma } = await import('@/lib/prisma')
      const { logAuditWithRequest } = await import('@/lib/audit')

      vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
      vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder)

      mockPaymentIntentsConfirm.mockResolvedValue({
        id: 'pi_existing123',
        status: 'succeeded',
        client_secret: 'test_secret_123',
      })

      vi.mocked(prisma.order.update).mockResolvedValue({
        ...mockOrder,
        paymentStatus: 'PAID',
        status: 'CONFIRMED',
        stripePaymentId: 'pi_existing123',
      })

      const request = new NextRequest('http://localhost/api/payment', {
        method: 'POST',
        body: JSON.stringify(validPaymentData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.paymentIntent.id).toBe('pi_existing123')
      expect(data.paymentIntent.status).toBe('succeeded')
      expect(data.paymentIntent.clientSecret).toBe('test_secret_123')
      expect(data.order.paymentStatus).toBe('PAID')
      expect(data.order.status).toBe('CONFIRMED')

      // Verify confirm was called with the EXISTING intent ID (not create)
      expect(mockPaymentIntentsConfirm).toHaveBeenCalledWith(
        'pi_existing123',
        {
          payment_method: 'pm_card_visa',
          return_url: expect.stringContaining('/orders/claaa1234567890abc'),
        }
      )

      // Verify order was updated
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'claaa1234567890abc' },
        data: {
          paymentStatus: 'PAID',
          status: 'CONFIRMED',
          stripePaymentId: 'pi_existing123',
        },
      })

      expect(logAuditWithRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          action: 'update',
          entityType: 'Order',
          entityId: 'claaa1234567890abc',
          changes: expect.objectContaining({
            paymentStatus: 'PAID',
            status: 'CONFIRMED',
            orderNumber: 'JMS-20260301-1234',
            amount: 29.47,
          }),
        }),
        request
      )
    })

    it('should handle payment intent requiring action', async () => {
      const { getCurrentUser } = await import('@/lib/rbac')
      const { default: prisma } = await import('@/lib/prisma')

      vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
      vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder)

      mockPaymentIntentsConfirm.mockResolvedValue({
        id: 'pi_existing123',
        status: 'requires_action',
        client_secret: 'test_secret_123',
      })

      vi.mocked(prisma.order.update).mockResolvedValue({
        ...mockOrder,
        paymentStatus: 'PENDING',
        status: 'PENDING',
        stripePaymentId: 'pi_existing123',
      })

      const request = new NextRequest('http://localhost/api/payment', {
        method: 'POST',
        body: JSON.stringify(validPaymentData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.paymentIntent.status).toBe('requires_action')
      expect(data.order.paymentStatus).toBe('PENDING')
    })

    it('should handle canceled payment intent', async () => {
      const { getCurrentUser } = await import('@/lib/rbac')
      const { default: prisma } = await import('@/lib/prisma')

      vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
      vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder)

      mockPaymentIntentsConfirm.mockResolvedValue({
        id: 'pi_existing123',
        status: 'canceled',
        client_secret: 'test_secret_123',
      })

      vi.mocked(prisma.order.update).mockResolvedValue({
        ...mockOrder,
        paymentStatus: 'FAILED',
        status: 'PENDING',
        stripePaymentId: 'pi_existing123',
      })

      const request = new NextRequest('http://localhost/api/payment', {
        method: 'POST',
        body: JSON.stringify(validPaymentData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.paymentIntent.status).toBe('canceled')
      expect(data.order.paymentStatus).toBe('FAILED')
    })

    it('should return 402 when card is declined', async () => {
      const { getCurrentUser } = await import('@/lib/rbac')
      const { default: prisma } = await import('@/lib/prisma')

      vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
      vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder)

      const cardError = {
        type: 'StripeCardError',
        message: 'Your card was declined',
      }
      mockPaymentIntentsConfirm.mockRejectedValue(cardError)

      const request = new NextRequest('http://localhost/api/payment', {
        method: 'POST',
        body: JSON.stringify(validPaymentData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(402)
      expect(data.error).toBe('Your card was declined')
    })

    it('should handle Stripe card error without message', async () => {
      const { getCurrentUser } = await import('@/lib/rbac')
      const { default: prisma } = await import('@/lib/prisma')

      vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
      vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder)

      const cardError = { type: 'StripeCardError' }
      mockPaymentIntentsConfirm.mockRejectedValue(cardError)

      const request = new NextRequest('http://localhost/api/payment', {
        method: 'POST',
        body: JSON.stringify(validPaymentData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(402)
      expect(data.error).toBe('Your card was declined')
    })

    it('should handle database errors gracefully', async () => {
      const { getCurrentUser } = await import('@/lib/rbac')
      const { default: prisma } = await import('@/lib/prisma')

      vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
      vi.mocked(prisma.order.findUnique).mockRejectedValue(
        new Error('Database error')
      )

      const request = new NextRequest('http://localhost/api/payment', {
        method: 'POST',
        body: JSON.stringify(validPaymentData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Unable to process payment. Please try again.')
    })

    it('should handle Stripe API errors gracefully', async () => {
      const { getCurrentUser } = await import('@/lib/rbac')
      const { default: prisma } = await import('@/lib/prisma')

      vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
      vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder)

      const stripeError = new Error('Stripe API error')
      mockPaymentIntentsConfirm.mockRejectedValue(stripeError)

      const request = new NextRequest('http://localhost/api/payment', {
        method: 'POST',
        body: JSON.stringify(validPaymentData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Unable to process payment. Please try again.')
    })
  })
})
