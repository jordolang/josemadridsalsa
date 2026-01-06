import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/checkout/route'

// Mock dependencies
vi.mock('@/lib/rbac', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    product: {
      findMany: vi.fn(),
    },
    order: {
      create: vi.fn(),
    },
    abandonedCart: {
      updateMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/audit', () => ({
  logAuditWithRequest: vi.fn(),
}))

const mockPaymentIntentsCreate = vi.fn(() =>
  Promise.resolve({
    client_secret: 'test_secret',
    id: 'pi_test123',
  })
)

vi.mock('@/lib/stripe', () => ({
  getStripe: vi.fn(() => ({
    paymentIntents: {
      create: mockPaymentIntentsCreate,
    },
  })),
}))

vi.mock('@/lib/shopify/sync', () => ({
  queueShopifySync: vi.fn(),
}))

vi.mock('@/lib/tax-calculator', () => ({
  calculateTax: vi.fn(() =>
    Promise.resolve({
      taxAmountDecimal: 2.5,
      taxRate: 0.08,
      taxBreakdown: [],
    })
  ),
}))

vi.mock('@/lib/shipping-calculator', () => ({
  calculateShipping: vi.fn(() => ({
    shippingCost: 8.99,
    shippingMethod: 'Standard Shipping',
    estimatedDelivery: '5-7 business days',
  })),
}))

describe('Checkout API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPaymentIntentsCreate.mockClear()
  })

  const validCheckoutData = {
    items: [
      {
        productId: 'clxxx1234567890abc',
        quantity: 2,
      },
    ],
    customer: {
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      phone: '555-1234',
    },
    shipping: {
      address1: '123 Main St',
      address2: 'Apt 4',
      city: 'Portland',
      state: 'OR',
      postalCode: '97201',
    },
    notes: 'Please handle with care',
  }

  const mockProduct = {
    id: 'clxxx1234567890abc',
    name: 'Test Salsa',
    slug: 'test-salsa',
    description: 'Test description',
    sku: 'TEST-001',
    price: 8.99,
    inventory: 100,
    featuredImage: '/images/test.jpg',
    weight: 1.5,
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockOrder = {
    id: 'order-123',
    orderNumber: 'JMS-20260105-1234',
    total: 20.48,
    items: [],
    createdAt: new Date(),
  }

  describe('POST /api/checkout', () => {
    it('should validate checkout payload', async () => {
      const request = new NextRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify({ items: [] }), // Invalid: empty items
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid checkout payload')
    })

    it('should check product availability', async () => {
      const { default: prisma } = await import('@/lib/prisma')

      vi.mocked(prisma.product.findMany).mockResolvedValue([])

      const request = new NextRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify(validCheckoutData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('could not be found')
    })

    it('should check inventory availability', async () => {
      const { default: prisma } = await import('@/lib/prisma')

      vi.mocked(prisma.product.findMany).mockResolvedValue([
        { ...mockProduct, inventory: 1 }, // Not enough inventory
      ])

      const request = new NextRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify(validCheckoutData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Insufficient inventory')
    })

    it('should create order for guest user', async () => {
      const { default: prisma } = await import('@/lib/prisma')
      const { getCurrentUser } = await import('@/lib/rbac')
      const { logAuditWithRequest } = await import('@/lib/audit')

      vi.mocked(getCurrentUser).mockResolvedValue(null)
      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct])
      vi.mocked(prisma.order.create).mockResolvedValue(mockOrder as any)

      const request = new NextRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify(validCheckoutData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.clientSecret).toBe('test_secret')
      expect(data.orderId).toBe('order-123')
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            guestEmail: 'test@example.com',
            userId: undefined,
          }),
        })
      )
      expect(logAuditWithRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'create',
          entityType: 'Order',
          entityId: 'order-123',
        }),
        request
      )
    })

    it('should create order for authenticated user', async () => {
      const { default: prisma } = await import('@/lib/prisma')
      const { getCurrentUser } = await import('@/lib/rbac')

      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        name: 'John Doe',
        role: 'CUSTOMER',
      })
      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct])
      vi.mocked(prisma.order.create).mockResolvedValue(mockOrder as any)

      const request = new NextRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify(validCheckoutData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
            guestEmail: undefined,
          }),
        })
      )
    })

    it('should mark abandoned cart as recovered', async () => {
      const { default: prisma } = await import('@/lib/prisma')
      const { getCurrentUser } = await import('@/lib/rbac')

      vi.mocked(getCurrentUser).mockResolvedValue(null)
      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct])
      vi.mocked(prisma.order.create).mockResolvedValue(mockOrder as any)
      vi.mocked(prisma.abandonedCart.updateMany).mockResolvedValue({ count: 1 })

      const checkoutWithRecovery = {
        ...validCheckoutData,
        recoveryToken: 'recovery-token-123',
      }

      const request = new NextRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify(checkoutWithRecovery),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(prisma.abandonedCart.updateMany).toHaveBeenCalledWith({
        where: {
          recoveryToken: 'recovery-token-123',
          recoveredAt: null,
        },
        data: {
          recoveredAt: expect.any(Date),
        },
      })
    })

    it('should calculate tax and shipping', async () => {
      const { default: prisma } = await import('@/lib/prisma')
      const { getCurrentUser } = await import('@/lib/rbac')
      const { calculateTax } = await import('@/lib/tax-calculator')
      const { calculateShipping } = await import('@/lib/shipping-calculator')

      vi.mocked(getCurrentUser).mockResolvedValue(null)
      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct])
      vi.mocked(prisma.order.create).mockResolvedValue(mockOrder as any)

      const request = new NextRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify(validCheckoutData),
      })

      await POST(request)

      expect(calculateTax).toHaveBeenCalledWith(
        expect.objectContaining({
          customerEmail: 'test@example.com',
          shippingAddress: expect.objectContaining({
            line1: '123 Main St',
            city: 'Portland',
            state: 'OR',
          }),
        })
      )

      expect(calculateShipping).toHaveBeenCalledWith(
        expect.objectContaining({
          shippingAddress: expect.objectContaining({
            state: 'OR',
            postalCode: '97201',
          }),
        })
      )
    })

    it('should create Stripe payment intent', async () => {
      const { default: prisma } = await import('@/lib/prisma')
      const { getCurrentUser } = await import('@/lib/rbac')

      vi.mocked(getCurrentUser).mockResolvedValue(null)
      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct])
      vi.mocked(prisma.order.create).mockResolvedValue(mockOrder as any)

      const request = new NextRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify(validCheckoutData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: 'usd',
          receipt_email: 'test@example.com',
          metadata: expect.objectContaining({
            orderId: 'order-123',
            orderNumber: 'JMS-20260105-1234',
          }),
          shipping: expect.objectContaining({
            name: 'John Doe',
            address: expect.objectContaining({
              line1: '123 Main St',
              city: 'Portland',
            }),
          }),
        })
      )

      expect(data.clientSecret).toBe('test_secret')
    })

    it('should queue Shopify sync', async () => {
      const { default: prisma } = await import('@/lib/prisma')
      const { getCurrentUser } = await import('@/lib/rbac')
      const { queueShopifySync } = await import('@/lib/shopify/sync')

      vi.mocked(getCurrentUser).mockResolvedValue(null)
      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct])
      vi.mocked(prisma.order.create).mockResolvedValue(mockOrder as any)

      const request = new NextRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify(validCheckoutData),
      })

      await POST(request)

      expect(queueShopifySync).toHaveBeenCalledWith('order-123')
    })

    it('should handle errors gracefully', async () => {
      const { default: prisma } = await import('@/lib/prisma')
      const { getCurrentUser } = await import('@/lib/rbac')

      vi.mocked(getCurrentUser).mockResolvedValue(null)
      vi.mocked(prisma.product.findMany).mockRejectedValue(
        new Error('Database error')
      )

      const request = new NextRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify(validCheckoutData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Unable to initiate checkout. Please try again.')
    })

    it('should continue checkout if tax calculation fails', async () => {
      const { default: prisma } = await import('@/lib/prisma')
      const { getCurrentUser } = await import('@/lib/rbac')
      const { calculateTax } = await import('@/lib/tax-calculator')

      vi.mocked(getCurrentUser).mockResolvedValue(null)
      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct])
      vi.mocked(prisma.order.create).mockResolvedValue(mockOrder as any)
      vi.mocked(calculateTax).mockRejectedValue(new Error('Tax API error'))

      const request = new NextRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify(validCheckoutData),
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tax: expect.any(Object), // Should use 0 tax
          }),
        })
      )
    })

    it('should continue checkout if shipping calculation fails', async () => {
      const { default: prisma } = await import('@/lib/prisma')
      const { getCurrentUser } = await import('@/lib/rbac')
      const { calculateShipping } = await import('@/lib/shipping-calculator')

      vi.mocked(getCurrentUser).mockResolvedValue(null)
      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct])
      vi.mocked(prisma.order.create).mockResolvedValue(mockOrder as any)
      vi.mocked(calculateShipping).mockImplementation(() => {
        throw new Error('Shipping API error')
      })

      const request = new NextRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify(validCheckoutData),
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shippingCost: expect.any(Object), // Should use 0 shipping
          }),
        })
      )
    })

    it('should not block checkout if abandoned cart recovery fails', async () => {
      const { default: prisma } = await import('@/lib/prisma')
      const { getCurrentUser } = await import('@/lib/rbac')

      vi.mocked(getCurrentUser).mockResolvedValue(null)
      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct])
      vi.mocked(prisma.order.create).mockResolvedValue(mockOrder as any)
      vi.mocked(prisma.abandonedCart.updateMany).mockRejectedValue(
        new Error('Database error')
      )

      const checkoutWithRecovery = {
        ...validCheckoutData,
        recoveryToken: 'recovery-token-123',
      }

      const request = new NextRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify(checkoutWithRecovery),
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
    })
  })
})
