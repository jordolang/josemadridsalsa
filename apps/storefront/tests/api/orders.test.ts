import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST, GET } from '@/app/api/orders/route'
import { GET as GET_BY_ID } from '@/app/api/orders/[orderId]/route'

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}))

vi.mock('@/lib/prisma', () => {
  const mockPrismaClient = {
    cartItem: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    order: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
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

vi.mock('@/lib/tax-calculator', () => ({
  calculateTax: vi.fn(() =>
    Promise.resolve({
      taxAmountDecimal: 2.5,
      taxRate: 0.08,
      taxBreakdown: [],
    })
  ),
}))

// Only the rate call is stubbed. `buildShippingItems` is pure mapping — the thing that turns
// catalogue rows into parcel weights and dimensions — so the real one is kept, and a unit
// mistake in it fails these tests rather than being mocked away.
vi.mock('@/lib/shipping-calculator', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/shipping-calculator')>()),
  calculateShipping: vi.fn(() => ({
    shippingCost: 8.99,
    shippingMethod: 'Standard Shipping',
    estimatedDelivery: '5-7 business days',
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

describe('Orders API', () => {
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

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'CUSTOMER',
    phone: '555-1234',
  }

  const mockProduct: any = {
    id: 'clyyy1234567890abc',
    name: 'Test Salsa',
    slug: 'test-salsa',
    price: 8.99,
    inventory: 100,
    sku: 'TEST-001',
    featuredImage: '/images/test.jpg',
    heatLevel: 'MEDIUM',
    weight: 1.5,
    description: 'Test description',
    categoryId: 'clzzz1234567890abc',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockCartItem: any = {
    id: 'clxxx1234567890abc',
    userId: 'user-123',
    productId: 'clyyy1234567890abc',
    quantity: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
    product: mockProduct,
  }

  const mockOrder: any = {
    id: 'claaa1234567890abc',
    orderNumber: 'JMS-20260301-1234',
    userId: 'user-123',
    status: 'PENDING',
    paymentStatus: 'PENDING',
    subtotal: 17.98,
    shippingCost: 8.99,
    tax: 2.5,
    discountAmount: 0,
    total: 29.47,
    shippingMethod: '123 Main St\nPortland, OR 97201',
    trackingNumber: null,
    customerNotes: null,
    stripePaymentId: 'pi_test123',
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [
      {
        id: 'clbbb1234567890abc',
        productId: 'clyyy1234567890abc',
        productName: 'Test Salsa',
        productSku: 'TEST-001',
        productImage: '/images/test.jpg',
        quantity: 2,
        unitPrice: 8.99,
        totalPrice: 17.98,
        product: mockProduct,
      },
    ],
  }

  const validOrderData = {
    cartItemIds: ['clxxx1234567890abc'],
    shippingAddress: {
      address1: '123 Main St',
      address2: 'Apt 4',
      city: 'Portland',
      state: 'OR',
      postalCode: '97201',
      country: 'US',
    },
    billingAddress: {
      address1: '123 Main St',
      city: 'Portland',
      state: 'OR',
      postalCode: '97201',
      country: 'US',
    },
    notes: 'Please handle with care',
  }

  describe('POST /api/orders', () => {
    it('should return 401 when user is not authenticated', async () => {
      const { getServerSession } = await import('next-auth')
      vi.mocked(getServerSession).mockResolvedValueOnce(null)

      const request = new NextRequest('http://localhost/api/orders', {
        method: 'POST',
        body: JSON.stringify(validOrderData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication required')
    })

    it('should return 400 when payload is invalid', async () => {
      const { getServerSession } = await import('next-auth')
      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })

      const request = new NextRequest('http://localhost/api/orders', {
        method: 'POST',
        body: JSON.stringify({ cartItemIds: [] }), // Invalid: empty cart
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(422)
      expect(data.error).toContain('Invalid order payload')
    })

    it('should return 400 when shipping address is missing', async () => {
      const { getServerSession } = await import('next-auth')
      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })

      const request = new NextRequest('http://localhost/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          cartItemIds: ['clxxx1234567890abc'],
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(422)
      expect(data.error).toContain('Invalid order payload')
    })

    it('should return 400 when cart items not found', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.cartItem.findMany).mockResolvedValue([])

      const request = new NextRequest('http://localhost/api/orders', {
        method: 'POST',
        body: JSON.stringify(validOrderData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(422)
      expect(data.error).toContain('could not be found')
    })

    it('should return 400 when cart items belong to different user', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.cartItem.findMany).mockResolvedValue([])

      const request = new NextRequest('http://localhost/api/orders', {
        method: 'POST',
        body: JSON.stringify(validOrderData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(422)
      expect(data.error).toContain('could not be found')
      expect(prisma.cartItem.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['clxxx1234567890abc'] },
          userId: 'user-123',
        },
        include: {
          product: true,
        },
      })
    })

    it('should return 400 when product not found for cart item', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.cartItem.findMany).mockResolvedValue([
        { ...mockCartItem, product: null },
      ])

      const request = new NextRequest('http://localhost/api/orders', {
        method: 'POST',
        body: JSON.stringify(validOrderData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(422)
      expect(data.error).toBe('Product not found for cart item')
    })

    it('should return 400 when inventory is insufficient', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.cartItem.findMany).mockResolvedValue([
        {
          ...mockCartItem,
          quantity: 10,
          product: { ...mockProduct, inventory: 5 },
        },
      ])

      const request = new NextRequest('http://localhost/api/orders', {
        method: 'POST',
        body: JSON.stringify(validOrderData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(422)
      expect(data.error).toContain('Insufficient inventory')
      expect(data.error).toContain('Available: 5')
    })

    it('should create order successfully', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')
      const { logAuditWithRequest } = await import('@/lib/audit')

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.cartItem.findMany).mockResolvedValue([mockCartItem])
      vi.mocked(prisma.order.create).mockResolvedValue(mockOrder)
      vi.mocked(prisma.cartItem.deleteMany).mockResolvedValue({ count: 1 })

      const request = new NextRequest('http://localhost/api/orders', {
        method: 'POST',
        body: JSON.stringify(validOrderData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.clientSecret).toBe('test_secret')
      expect(data.orderId).toBe('claaa1234567890abc')
      expect(data.orderNumber).toBe('JMS-20260301-1234')
      expect(data.amount).toBeGreaterThan(0)

      // Verify order creation includes stripePaymentId
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
            paymentStatus: 'PENDING',
            status: 'PENDING',
            stripePaymentId: 'pi_test123',
          }),
          include: {
            items: true,
          },
        })
      )

      // Verify cart items deleted
      expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['clxxx1234567890abc'] },
          userId: 'user-123',
        },
      })

      // Verify audit log
      expect(logAuditWithRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          action: 'create',
          entityType: 'Order',
          entityId: 'claaa1234567890abc',
        }),
        request
      )

      // Verify Stripe payment intent created
      expect(mockPaymentIntentsCreate).toHaveBeenCalled()
    })

    it('should continue with zero tax when tax calculation fails', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')
      const { calculateTax } = await import('@/lib/tax-calculator')

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.cartItem.findMany).mockResolvedValue([mockCartItem])
      vi.mocked(prisma.order.create).mockResolvedValue(mockOrder)
      vi.mocked(prisma.cartItem.deleteMany).mockResolvedValue({ count: 1 })
      vi.mocked(calculateTax).mockRejectedValue(new Error('Tax API error'))

      const request = new NextRequest('http://localhost/api/orders', {
        method: 'POST',
        body: JSON.stringify(validOrderData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.clientSecret).toBeDefined()
      expect(data.orderId).toBe('claaa1234567890abc')
    })

    it('should continue with zero shipping when shipping calculation fails', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')
      const { calculateShipping } = await import('@/lib/shipping-calculator')

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.cartItem.findMany).mockResolvedValue([mockCartItem])
      vi.mocked(prisma.order.create).mockResolvedValue(mockOrder)
      vi.mocked(prisma.cartItem.deleteMany).mockResolvedValue({ count: 1 })
      vi.mocked(calculateShipping).mockImplementation(() => {
        throw new Error('Shipping API error')
      })

      const request = new NextRequest('http://localhost/api/orders', {
        method: 'POST',
        body: JSON.stringify(validOrderData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.clientSecret).toBeDefined()
      expect(data.orderId).toBe('claaa1234567890abc')
    })

    it('should handle database errors gracefully', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.cartItem.findMany).mockRejectedValue(
        new Error('Database error')
      )

      const request = new NextRequest('http://localhost/api/orders', {
        method: 'POST',
        body: JSON.stringify(validOrderData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Unable to create order. Please try again.')
    })
  })

  describe('GET /api/orders', () => {
    it('should return 401 when user is not authenticated', async () => {
      const { getServerSession } = await import('next-auth')
      vi.mocked(getServerSession).mockResolvedValueOnce(null)

      const request = new NextRequest('http://localhost/api/orders', {
        method: 'GET',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication required')
    })

    it('should return orders for authenticated user', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.order.findMany).mockResolvedValue([mockOrder])

      const request = new NextRequest('http://localhost/api/orders', {
        method: 'GET',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveLength(1)
      expect(data[0].id).toBe('claaa1234567890abc')
      expect(data[0].orderNumber).toBe('JMS-20260301-1234')
      expect(data[0].total).toBe(29.47)
      expect(data[0].items).toHaveLength(1)

      // Verify query filters by user ID
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-123',
          }),
        })
      )
    })

    it('should return 400 for invalid status filter', async () => {
      const { getServerSession } = await import('next-auth')
      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })

      const request = new NextRequest(
        'http://localhost/api/orders?status=INVALID_STATUS',
        {
          method: 'GET',
        }
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(422)
      expect(data.error).toContain('Invalid query parameters')
    })

    it('should filter orders by valid status', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.order.findMany).mockResolvedValue([])

      const request = new NextRequest(
        'http://localhost/api/orders?status=DELIVERED',
        {
          method: 'GET',
        }
      )

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-123',
            status: 'DELIVERED',
          }),
        })
      )
    })

    it('should filter orders by payment status', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.order.findMany).mockResolvedValue([])

      const request = new NextRequest(
        'http://localhost/api/orders?paymentStatus=PAID',
        {
          method: 'GET',
        }
      )

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-123',
            paymentStatus: 'PAID',
          }),
        })
      )
    })

    it('should support pagination with skip and take', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.order.findMany).mockResolvedValue([])

      const request = new NextRequest(
        'http://localhost/api/orders?skip=10&take=5',
        {
          method: 'GET',
        }
      )

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 5,
        })
      )
    })

    it('should support sorting by createdAt', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.order.findMany).mockResolvedValue([])

      const request = new NextRequest(
        'http://localhost/api/orders?sortOrder=asc',
        {
          method: 'GET',
        }
      )

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            createdAt: 'asc',
          },
        })
      )
    })

    it('should convert Decimal prices to numbers', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.order.findMany).mockResolvedValue([mockOrder])

      const request = new NextRequest('http://localhost/api/orders', {
        method: 'GET',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(typeof data[0].subtotal).toBe('number')
      expect(typeof data[0].shippingCost).toBe('number')
      expect(typeof data[0].tax).toBe('number')
      expect(typeof data[0].total).toBe('number')
      expect(typeof data[0].items[0].unitPrice).toBe('number')
      expect(typeof data[0].items[0].totalPrice).toBe('number')
    })

    it('should handle database errors gracefully without leaking details', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.order.findMany).mockRejectedValue(
        new Error('Database error')
      )

      const request = new NextRequest('http://localhost/api/orders', {
        method: 'GET',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch orders')
      // Must NOT leak internal error details
      expect(data.details).toBeUndefined()
    })
  })

  describe('GET /api/orders/[id]', () => {
    it('should return 401 when user is not authenticated', async () => {
      const { getServerSession } = await import('next-auth')
      vi.mocked(getServerSession).mockResolvedValueOnce(null)

      const request = new NextRequest(
        'http://localhost/api/orders/claaa1234567890abc',
        {
          method: 'GET',
        }
      )

      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ orderId: 'claaa1234567890abc' }),
      })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication required')
    })

    it('should return 404 when order does not exist', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.order.findUnique).mockResolvedValue(null)

      const request = new NextRequest(
        'http://localhost/api/orders/claaa1234567890abc',
        {
          method: 'GET',
        }
      )

      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ orderId: 'claaa1234567890abc' }),
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Order not found')
    })

    it('should return 403 Forbidden when order belongs to different user', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.order.findUnique).mockResolvedValue({
        ...mockOrder,
        userId: 'different-user',
      })

      const request = new NextRequest(
        'http://localhost/api/orders/claaa1234567890abc',
        {
          method: 'GET',
        }
      )

      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ orderId: 'claaa1234567890abc' }),
      })
      const data = await response.json()

      // Must be 403, not 401 — authenticated but not the owner
      expect(response.status).toBe(403)
      expect(data.error).toBe('Access denied')
    })

    it('should return order details for authenticated user', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder)

      const request = new NextRequest(
        'http://localhost/api/orders/claaa1234567890abc',
        {
          method: 'GET',
        }
      )

      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ orderId: 'claaa1234567890abc' }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.id).toBe('claaa1234567890abc')
      expect(data.orderNumber).toBe('JMS-20260301-1234')
      expect(data.total).toBe(29.47)
      expect(data.items).toHaveLength(1)

      // Verify query includes items and products
      expect(prisma.order.findUnique).toHaveBeenCalledWith({
        where: { id: 'claaa1234567890abc' },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          shippingAddress: {
            select: {
              country: true,
            },
          },
          // A campaign sale confirms on the group's own thank-you page, so the order
          // carries the copy that page is built from.
          fundraiser: {
            select: {
              slug: true,
              name: true,
              organizationName: true,
              logoUrl: true,
              thankYouHeadline: true,
              thankYouMessage: true,
              thankYouImageUrl: true,
              thankYouCtaLabel: true,
              thankYouCtaUrl: true,
            },
          },
        },
      })
    })

    it('should convert Decimal prices to numbers', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder)

      const request = new NextRequest(
        'http://localhost/api/orders/claaa1234567890abc',
        {
          method: 'GET',
        }
      )

      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ orderId: 'claaa1234567890abc' }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(typeof data.subtotal).toBe('number')
      expect(typeof data.shippingCost).toBe('number')
      expect(typeof data.tax).toBe('number')
      expect(typeof data.total).toBe('number')
      expect(typeof data.items[0].unitPrice).toBe('number')
      expect(typeof data.items[0].totalPrice).toBe('number')
    })

    it('should handle database errors gracefully without leaking details', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.order.findUnique).mockRejectedValue(
        new Error('Database error')
      )

      const request = new NextRequest(
        'http://localhost/api/orders/claaa1234567890abc',
        {
          method: 'GET',
        }
      )

      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ orderId: 'claaa1234567890abc' }),
      })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch order')
      // Must NOT leak internal error details
      expect(data.details).toBeUndefined()
    })
  })
})
