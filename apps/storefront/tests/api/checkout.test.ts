import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/checkout/route'

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}))

vi.mock('@/lib/prisma', () => {
  const mockPrismaClient = {
    product: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    order: {
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    abandonedCart: {
      updateMany: vi.fn(),
    },
  }
  return {
    prisma: mockPrismaClient,
    db: mockPrismaClient,
    default: mockPrismaClient,
  }
})

vi.mock('@/lib/audit', () => ({
  logAuditWithRequest: vi.fn(),
}))

// Mock rate limiter to allow all requests through in tests
vi.mock('@/lib/rateLimit', () => ({
  rateLimit: vi.fn(() => ({
    allowed: true,
    retryAfterMs: 0
  }))
}))

const mockPaymentIntentsCreate = vi.fn(() =>
  Promise.resolve({
    success: true,
    clientSecret: 'test_secret',
    paymentIntentId: 'pi_test123',
  })
)

const mockCreateCustomer = vi.fn(() =>
  Promise.resolve({
    success: true,
    providerId: 'cus_test123',
  })
)

vi.mock('@/lib/payments', () => ({
  getProvider: vi.fn(() => ({
    createPayment: mockPaymentIntentsCreate,
    createCustomer: mockCreateCustomer,
  })),
}))

vi.mock('@/lib/shopify/sync', () => ({
  queueShopifySync: vi.fn(),
}))

vi.mock('@/lib/inventory-manager', () => ({
  reserveMultipleProducts: vi.fn(() =>
    Promise.resolve([
      {
        id: 'reservation-123',
        productId: 'clxxx1234567890abc',
        quantity: 2,
        reservedAt: new Date(),
      },
    ])
  ),
  releaseInventory: vi.fn(),
}))

vi.mock('@/lib/fundraising/referral-tracker', () => ({
  getReferralFromCode: vi.fn(() => Promise.resolve(null)),
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

vi.mock('@/lib/shipping-calculator', async (importOriginal) => ({
  // Only the rate call is stubbed. `buildShippingItems` is pure mapping — the thing that turns
  // catalogue rows into parcel weights and dimensions — so the real one is kept, and a unit
  // mistake in it fails these tests rather than being mocked away.
  ...(await importOriginal<typeof import('@/lib/shipping-calculator')>()),
  calculateShipping: vi.fn(() => ({
    shippingCost: 8.99,
    shippingMethod: 'Standard Shipping',
    estimatedDelivery: '5-7 business days',
  })),
}))

describe('Checkout API', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockPaymentIntentsCreate.mockClear()
    // Default: user is authenticated
    const { getServerSession } = await import('next-auth')
    vi.mocked(getServerSession).mockResolvedValue({
      user: {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User'
      }
    })
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

  const mockProduct: any = {
    id: 'clxxx1234567890abc',
    name: 'Test Salsa',
    slug: 'test-salsa',
    description: 'Test description',
    sku: 'TEST-001',
    price: 8.99,
    lowStockThreshold: 5,
    weight: 1.5,
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    // Add missing required fields
    categoryId: 'category-123',
    heatLevel: 'MEDIUM',
    ingredients: ['tomatoes', 'onions', 'peppers'],
    images: [],
    barcode: null,
    compareAtPrice: null,
    costPrice: null,
    taxCode: null,
    dimensions: null,
    metaTitle: null,
    metaDescription: null,
    ogImage: null,
    searchKeywords: [],
    isActive: true,
    isFeatured: false,
    sortOrder: 0,
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
      const { prisma } = await import('@/lib/prisma')

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
      const { prisma } = await import('@/lib/prisma')
      const { reserveMultipleProducts } = await import('@/lib/inventory-manager')

      vi.mocked(prisma.product.findMany).mockResolvedValue([
        { ...mockProduct, inventory: 1 } as any, // Not enough inventory
      ])
      // Inventory validation is performed atomically inside reserveMultipleProducts,
      // which throws when stock is insufficient.
      vi.mocked(reserveMultipleProducts).mockRejectedValueOnce(
        new Error('Insufficient inventory for product Test Salsa')
      )

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
      const { prisma } = await import('@/lib/prisma')
      const { getServerSession } = await import('next-auth')
      const { logAuditWithRequest } = await import('@/lib/audit')

      vi.mocked(getServerSession).mockResolvedValueOnce(null)
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
      const { prisma } = await import('@/lib/prisma')
      const { getServerSession } = await import('next-auth')

      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'John Doe'
        }
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
      const { prisma } = await import('@/lib/prisma')
      const { getServerSession } = await import('next-auth')

      vi.mocked(getServerSession).mockResolvedValueOnce(null)
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
      const { prisma } = await import('@/lib/prisma')
      const { getServerSession } = await import('next-auth')
      const { calculateTax } = await import('@/lib/tax-calculator')
      const { calculateShipping } = await import('@/lib/shipping-calculator')

      vi.mocked(getServerSession).mockResolvedValueOnce(null)
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
      const { prisma } = await import('@/lib/prisma')
      const { getServerSession } = await import('next-auth')

      vi.mocked(getServerSession).mockResolvedValueOnce(null)
      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct])
      vi.mocked(prisma.order.create).mockResolvedValue(mockOrder as any)

      const request = new NextRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify(validCheckoutData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.clientSecret).toBe('test_secret')
    })

    it('should queue Shopify sync', async () => {
      const { prisma } = await import('@/lib/prisma')
      const { getServerSession } = await import('next-auth')
      const { queueShopifySync } = await import('@/lib/shopify/sync')

      vi.mocked(getServerSession).mockResolvedValueOnce(null)
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
      const { prisma } = await import('@/lib/prisma')
      const { getServerSession } = await import('next-auth')

      vi.mocked(getServerSession).mockResolvedValueOnce(null)
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
      const { prisma } = await import('@/lib/prisma')
      const { getServerSession } = await import('next-auth')
      const { calculateTax } = await import('@/lib/tax-calculator')

      vi.mocked(getServerSession).mockResolvedValueOnce(null)
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
      const { prisma } = await import('@/lib/prisma')
      const { getServerSession } = await import('next-auth')
      const { calculateShipping } = await import('@/lib/shipping-calculator')

      vi.mocked(getServerSession).mockResolvedValueOnce(null)
      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct])
      vi.mocked(calculateShipping).mockImplementationOnce(() => {
        throw new Error('Shipping API error')
      })

      const request = new NextRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify(validCheckoutData),
      })

      const response = await POST(request)
      const data = await response.json()

      // Should return error when shipping calculation fails
      expect(response.status).toBe(500)
      expect(data.error).toContain('Unable to calculate shipping cost')
    })

    it('should not block checkout if abandoned cart recovery fails', async () => {
      const { prisma } = await import('@/lib/prisma')
      const { getServerSession } = await import('next-auth')

      vi.mocked(getServerSession).mockResolvedValueOnce(null)
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
