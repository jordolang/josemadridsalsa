import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/checkout/route'

// Mock dependencies
vi.mock('@/lib/rbac', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/prisma', () => {
  const mockPrisma = {
    product: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    order: {
      create: vi.fn(),
    },
    abandonedCart: {
      updateMany: vi.fn(),
    },
    inventoryTransaction: {
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    storeSettings: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((callback) => {
      if (typeof callback === 'function') {
        return callback(mockPrisma)
      }
      // Handle array form: prisma.$transaction([query1, query2])
      return Promise.all(callback)
    }),
  }
  return {
    default: mockPrisma,
  }
})

vi.mock('@/lib/audit', () => ({
  logAuditWithRequest: vi.fn(),
}))

const mockCreatePayment = vi.fn(() =>
  Promise.resolve({
    success: true,
    clientSecret: 'test_secret_pi_test123',
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
    createPayment: mockCreatePayment,
    createCustomer: mockCreateCustomer,
  })),
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
      taxBreakdown: [
        {
          jurisdiction: 'Oregon',
          rate: 0.08,
          amount: 2.5,
        },
      ],
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

vi.mock('@/lib/inventory-manager', () => ({
  reserveMultipleProducts: vi.fn(() => Promise.resolve([
    {
      productId: 'clxxx1234567890abc',
      quantity: 2,
      reservedAt: new Date(),
    },
  ])),
  releaseInventory: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/lib/fundraising/referral-tracker', () => ({
  getReferralFromCode: vi.fn(() => Promise.resolve(null)),
}))

describe('Checkout API Integration Tests', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockCreatePayment.mockClear()
    mockCreateCustomer.mockClear()

    // Reset mocks to default successful implementations
    const { reserveMultipleProducts } = await import('@/lib/inventory-manager')
    const { calculateTax } = await import('@/lib/tax-calculator')
    const { calculateShipping } = await import('@/lib/shipping-calculator')

    vi.mocked(reserveMultipleProducts).mockResolvedValue([
      {
        id: 'reservation-123',
        productId: 'clxxx1234567890abc',
        quantity: 2,
        reservedAt: new Date(),
      },
    ] as any)

    vi.mocked(calculateTax).mockResolvedValue({
      taxAmountDecimal: 2.5,
      taxRate: 0.08,
      taxBreakdown: [
        {
          jurisdiction: 'Oregon',
          rate: 0.08,
          amount: 2.5,
        },
      ],
    } as any)

    vi.mocked(calculateShipping).mockReturnValue({
      shippingCost: 8.99,
      shippingMethod: 'Standard Shipping',
      estimatedDelivery: '5-7 business days',
    } as any)
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
    inventory: 100,
    lowStockThreshold: 5,
    weight: 1.5,
    status: 'ACTIVE',
    featuredImage: 'https://example.com/image.jpg',
    createdAt: new Date(),
    updatedAt: new Date(),
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
    userId: null,
    guestEmail: 'test@example.com',
    guestPhone: '555-1234',
    shippingMethod: '123 Main St, Apt 4\nPortland, OR 97201',
    customerNotes: 'Please handle with care',
    subtotal: 17.98,
    shippingCost: 8.99,
    tax: 2.5,
    discountAmount: 0,
    total: 29.47,
    paymentStatus: 'PENDING',
    status: 'PENDING',
    items: [
      {
        productId: 'clxxx1234567890abc',
        quantity: 2,
        unitPrice: 8.99,
        totalPrice: 17.98,
        productName: 'Test Salsa',
        productSku: 'TEST-001',
        productImage: 'https://example.com/image.jpg',
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  describe('Full Checkout Flow Integration', () => {
    it('should complete full checkout flow for guest user with tax and shipping', async () => {
      const { default: prisma } = await import('@/lib/prisma')
      const { getCurrentUser } = await import('@/lib/rbac')
      const { calculateTax } = await import('@/lib/tax-calculator')
      const { calculateShipping } = await import('@/lib/shipping-calculator')
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
      expect(data.clientSecret).toBe('test_secret_pi_test123')
      expect(data.orderId).toBe('order-123')
      expect(data.amount).toBeGreaterThan(0)

      // Verify tax calculation was called with correct parameters
      expect(calculateTax).toHaveBeenCalledWith(
        expect.objectContaining({
          lineItems: expect.arrayContaining([
            expect.objectContaining({
              amount: 1798, // $17.98 in cents
              reference: 'clxxx1234567890abc',
              taxCode: 'txcd_30011000',
            }),
          ]),
          shippingAddress: expect.objectContaining({
            line1: '123 Main St',
            city: 'Portland',
            state: 'OR',
            postalCode: '97201',
          }),
          customerEmail: 'test@example.com',
        })
      )

      // Verify shipping calculation was called
      expect(calculateShipping).toHaveBeenCalledWith(
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              weightOz: 1.5,
              quantity: 2,
            }),
          ]),
          shippingAddress: expect.objectContaining({
            state: 'OR',
            postalCode: '97201',
          }),
        })
      )

      // Verify order was created in database
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            guestEmail: 'test@example.com',
            shippingMethod: 'Standard Shipping',
            paymentStatus: 'PENDING',
            status: 'PENDING',
          }),
        })
      )

      // Verify payment was created via payment adapter
      expect(mockCreatePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: expect.any(Number),
          currency: 'usd',
          orderId: 'order-123',
          orderNumber: expect.stringContaining('JMS-'),
          customerEmail: 'test@example.com',
          customerName: 'John Doe',
          customerPhone: '555-1234',
          shippingAddress: expect.objectContaining({
            line1: '123 Main St',
            city: 'Portland',
            state: 'OR',
            postalCode: '97201',
          }),
        })
      )

      // Verify audit log was created
      expect(logAuditWithRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'create',
          entityType: 'Order',
          entityId: 'order-123',
        }),
        request
      )
    })

    it('should complete checkout for authenticated user', async () => {
      const { default: prisma } = await import('@/lib/prisma')
      const { getCurrentUser } = await import('@/lib/rbac')

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'CUSTOMER' as const,
      }

      vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct])
      vi.mocked(prisma.order.create).mockResolvedValue({
        ...mockOrder,
        userId: 'user-123',
        guestEmail: null,
      } as any)

      const request = new NextRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify(validCheckoutData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.clientSecret).toBeDefined()

      // Verify order was created with userId
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
          }),
        })
      )
    })

    it('should handle abandoned cart recovery', async () => {
      const { default: prisma } = await import('@/lib/prisma')
      const { getCurrentUser } = await import('@/lib/rbac')

      vi.mocked(getCurrentUser).mockResolvedValue(null)
      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct])
      vi.mocked(prisma.order.create).mockResolvedValue(mockOrder as any)
      vi.mocked(prisma.abandonedCart.updateMany).mockResolvedValue({ count: 1 } as any)

      const checkoutDataWithRecovery = {
        ...validCheckoutData,
        recoveryToken: 'recovery-token-123',
      }

      const request = new NextRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify(checkoutDataWithRecovery),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.orderId).toBeDefined()

      // Verify abandoned cart was marked as recovered
      expect(prisma.abandonedCart.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            recoveryToken: 'recovery-token-123',
            recoveredAt: null,
          },
          data: {
            recoveredAt: expect.any(Date),
          },
        })
      )
    })

    it('should handle abandoned cart recovery failure gracefully', async () => {
      const { default: prisma } = await import('@/lib/prisma')
      const { getCurrentUser } = await import('@/lib/rbac')

      vi.mocked(getCurrentUser).mockResolvedValue(null)
      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct])
      vi.mocked(prisma.order.create).mockResolvedValue(mockOrder as any)

      // Mock abandonedCart.updateMany to throw an error
      vi.mocked(prisma.abandonedCart.updateMany).mockRejectedValue(
        new Error('Database error updating cart')
      )

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const checkoutDataWithRecovery = {
        ...validCheckoutData,
        recoveryToken: 'recovery-token-fail',
      }

      const request = new NextRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify(checkoutDataWithRecovery),
      })

      const response = await POST(request)
      const data = await response.json()

      // Should still succeed despite cart recovery failure
      expect(response.status).toBe(200)
      expect(data.orderId).toBeDefined()

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Checkout] Failed to mark cart as recovered:',
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })

    it('should handle tax calculation failure gracefully', async () => {
      const { default: prisma } = await import('@/lib/prisma')
      const { getCurrentUser } = await import('@/lib/rbac')
      const { calculateTax } = await import('@/lib/tax-calculator')

      vi.mocked(getCurrentUser).mockResolvedValue(null)
      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct])
      vi.mocked(prisma.order.create).mockResolvedValue(mockOrder as any)
      vi.mocked(calculateTax).mockRejectedValue(new Error('Tax service unavailable'))

      const request = new NextRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify(validCheckoutData),
      })

      const response = await POST(request)
      const data = await response.json()

      // Should still succeed with $0 tax
      expect(response.status).toBe(200)
      expect(data.clientSecret).toBeDefined()

      // Order should be created with 0 tax
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tax: expect.any(Object), // Prisma Decimal with value 0
          }),
        })
      )
    })

    it('should return error and release the reservation when shipping calculation fails', async () => {
      const { default: prisma } = await import('@/lib/prisma')
      const { getCurrentUser } = await import('@/lib/rbac')
      const { calculateShipping } = await import('@/lib/shipping-calculator')
      const { releaseInventory } = await import('@/lib/inventory-manager')

      vi.mocked(getCurrentUser).mockResolvedValue(null)
      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct])
      vi.mocked(calculateShipping).mockImplementation(() => {
        throw new Error('Shipping service unavailable')
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

      // Regression: this branch used to `return` from inside the post-reservation block, so
      // the release below never ran and the stock this request reserved was stranded until
      // someone noticed. It throws now, which is what routes the failure into the release.
      expect(releaseInventory).toHaveBeenCalled()
    })

    it('should validate required fields', async () => {
      const invalidData = {
        items: [],
        customer: {
          email: 'invalid-email',
          firstName: '',
          lastName: 'Doe',
        },
        shipping: {
          address1: '',
          city: 'Portland',
          state: 'OR',
          postalCode: '97201',
        },
      }

      const request = new NextRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify(invalidData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid checkout payload')
      expect(data.details).toBeDefined()
    })

    it('should check product availability', async () => {
      const { default: prisma } = await import('@/lib/prisma')
      const { getCurrentUser } = await import('@/lib/rbac')

      vi.mocked(getCurrentUser).mockResolvedValue(null)
      vi.mocked(prisma.product.findMany).mockResolvedValue([]) // No products found

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
      const { getCurrentUser } = await import('@/lib/rbac')
      const { reserveMultipleProducts } = await import('@/lib/inventory-manager')

      vi.mocked(getCurrentUser).mockResolvedValue(null)
      vi.mocked(prisma.product.findMany).mockResolvedValue([
        { ...mockProduct, inventory: 1 } as any, // Not enough inventory
      ])
      // Mock reservation to fail due to insufficient inventory
      vi.mocked(reserveMultipleProducts).mockRejectedValue(
        new Error('Insufficient inventory for product Test Salsa')
      )

      // Mock reservation failure due to insufficient inventory
      vi.mocked(reserveMultipleProducts).mockRejectedValue(
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

    it('should handle multiple items in cart', async () => {
      const { default: prisma } = await import('@/lib/prisma')
      const { getCurrentUser } = await import('@/lib/rbac')

      const mockProduct2 = {
        ...mockProduct,
        id: 'clxxx0987654321xyz',
        name: 'Spicy Salsa',
        sku: 'TEST-002',
        price: 12.99,
        weight: 2.0,
      }

      const multiItemCheckout = {
        ...validCheckoutData,
        items: [
          { productId: 'clxxx1234567890abc', quantity: 2 },
          { productId: 'clxxx0987654321xyz', quantity: 1 },
        ],
      }

      vi.mocked(getCurrentUser).mockResolvedValue(null)
      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct, mockProduct2] as any)
      vi.mocked(prisma.order.create).mockResolvedValue({
        ...mockOrder,
        items: [
          { ...mockOrder.items[0] },
          {
            productId: 'clxxx0987654321xyz',
            quantity: 1,
            unitPrice: 12.99,
            totalPrice: 12.99,
            productName: 'Spicy Salsa',
            productSku: 'TEST-002',
          },
        ],
      } as any)

      const request = new NextRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify(multiItemCheckout),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.clientSecret).toBeDefined()

      // Verify order was created with multiple items
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            items: {
              create: expect.arrayContaining([
                expect.objectContaining({ productId: 'clxxx1234567890abc' }),
                expect.objectContaining({ productId: 'clxxx0987654321xyz' }),
              ]),
            },
          }),
        })
      )
    })

    it('should handle server errors gracefully', async () => {
      const { default: prisma } = await import('@/lib/prisma')
      const { getCurrentUser } = await import('@/lib/rbac')

      vi.mocked(getCurrentUser).mockResolvedValue(null)
      vi.mocked(prisma.product.findMany).mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify(validCheckoutData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Unable to initiate checkout. Please try again.')
    })

    it('should handle products without weight using default', async () => {
      const { default: prisma } = await import('@/lib/prisma')
      const { getCurrentUser } = await import('@/lib/rbac')
      const { calculateShipping } = await import('@/lib/shipping-calculator')

      const productNoWeight = {
        ...mockProduct,
        weight: null,
      }

      vi.mocked(getCurrentUser).mockResolvedValue(null)
      vi.mocked(prisma.product.findMany).mockResolvedValue([productNoWeight] as any)
      vi.mocked(prisma.order.create).mockResolvedValue(mockOrder as any)

      const request = new NextRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify(validCheckoutData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.clientSecret).toBeDefined()

      // Verify shipping was calculated with default weight of 1.0 lb
      expect(calculateShipping).toHaveBeenCalledWith(
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              weightOz: undefined, // no catalogue weight; the calculator applies the documented default
              quantity: 2,
            }),
          ]),
        })
      )
    })

    it('should handle payment creation failure', async () => {
      const { default: prisma } = await import('@/lib/prisma')
      const { getCurrentUser } = await import('@/lib/rbac')
      const { calculateTax } = await import('@/lib/tax-calculator')
      const { calculateShipping } = await import('@/lib/shipping-calculator')

      vi.mocked(getCurrentUser).mockResolvedValue(null)
      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct])
      vi.mocked(prisma.order.create).mockResolvedValue(mockOrder as any)

      // Ensure tax and shipping calculations succeed
      vi.mocked(calculateTax).mockResolvedValue({
        taxAmountDecimal: 2.5,
        taxRate: 0.08,
        taxBreakdown: [{ jurisdiction: 'Oregon', rate: 0.08, amount: 2.5 }],
      })
      vi.mocked(calculateShipping).mockReturnValue({
        shippingCost: 8.99,
        shippingMethod: 'Standard Shipping',
        estimatedDelivery: '5-7 business days',
      })

      // Mock payment creation failure
      mockCreatePayment.mockResolvedValueOnce({
        success: false,
        error: 'Stripe API error',
      })

      const request = new NextRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify(validCheckoutData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Unable to initiate checkout. Please try again.')
    })

    it('should handle audit logging failure gracefully', async () => {
      const { default: prisma } = await import('@/lib/prisma')
      const { getCurrentUser } = await import('@/lib/rbac')
      const { logAuditWithRequest } = await import('@/lib/audit')

      vi.mocked(getCurrentUser).mockResolvedValue(null)
      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct])
      vi.mocked(prisma.order.create).mockResolvedValue(mockOrder as any)

      // Mock audit logging failure
      vi.mocked(logAuditWithRequest).mockRejectedValue(new Error('Audit log error'))

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const request = new NextRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify(validCheckoutData),
      })

      const response = await POST(request)
      const data = await response.json()

      // Should still succeed despite audit logging failure
      expect(response.status).toBe(200)
      expect(data.clientSecret).toBeDefined()

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Checkout] Failed to log audit:',
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })

    it('should handle different shipping states correctly', async () => {
      const { default: prisma } = await import('@/lib/prisma')
      const { getCurrentUser } = await import('@/lib/rbac')
      const { calculateTax } = await import('@/lib/tax-calculator')
      const { calculateShipping } = await import('@/lib/shipping-calculator')

      const californiaCheckout = {
        ...validCheckoutData,
        shipping: {
          address1: '456 Oak Ave',
          city: 'Los Angeles',
          state: 'CA',
          postalCode: '90001',
        },
      }

      vi.mocked(getCurrentUser).mockResolvedValue(null)
      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct])
      vi.mocked(prisma.order.create).mockResolvedValue(mockOrder as any)

      // Mock higher tax rate for California
      vi.mocked(calculateTax).mockResolvedValue({
        taxAmountDecimal: 1.8,
        taxRate: 0.1,
        taxBreakdown: [
          {
            jurisdiction: 'California',
            rate: 0.1,
            amount: 1.8,
          },
        ],
      })

      // Mock different shipping cost for California
      vi.mocked(calculateShipping).mockReturnValue({
        shippingCost: 12.99,
        shippingMethod: 'Standard Shipping',
        estimatedDelivery: '5-7 business days',
      })

      const request = new NextRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify(californiaCheckout),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.clientSecret).toBeDefined()

      // Verify tax calculator was called with CA address
      expect(calculateTax).toHaveBeenCalledWith(
        expect.objectContaining({
          shippingAddress: expect.objectContaining({
            line1: '456 Oak Ave',
            city: 'Los Angeles',
            state: 'CA',
            postalCode: '90001',
          }),
        })
      )

      // Verify shipping calculator was called with CA address
      expect(calculateShipping).toHaveBeenCalledWith(
        expect.objectContaining({
          shippingAddress: expect.objectContaining({
            state: 'CA',
            postalCode: '90001',
          }),
        })
      )
    })

    it('should handle Alaska shipping addresses', async () => {
      const { default: prisma } = await import('@/lib/prisma')
      const { getCurrentUser } = await import('@/lib/rbac')
      const { calculateShipping } = await import('@/lib/shipping-calculator')

      const alaskaCheckout = {
        ...validCheckoutData,
        shipping: {
          address1: '123 Main St',
          city: 'Anchorage',
          state: 'AK',
          postalCode: '99501',
        },
      }

      vi.mocked(getCurrentUser).mockResolvedValue(null)
      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct])
      vi.mocked(prisma.order.create).mockResolvedValue(mockOrder as any)

      // Mock Alaska shipping with higher cost
      vi.mocked(calculateShipping).mockReturnValue({
        shippingCost: 19.99,
        shippingMethod: 'Standard Shipping',
        estimatedDelivery: '7-10 business days',
      })

      const request = new NextRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify(alaskaCheckout),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.clientSecret).toBeDefined()

      // Verify shipping calculator was called with Alaska address
      expect(calculateShipping).toHaveBeenCalledWith(
        expect.objectContaining({
          shippingAddress: expect.objectContaining({
            state: 'AK',
            postalCode: '99501',
          }),
        })
      )

      // Verify payment includes Alaska shipping address
      expect(mockCreatePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          shippingAddress: expect.objectContaining({
            line1: '123 Main St',
            city: 'Anchorage',
            state: 'AK',
            postalCode: '99501',
          }),
        })
      )
    })

    it('should validate quantity is positive', async () => {
      const invalidQuantityData = {
        ...validCheckoutData,
        items: [
          {
            productId: 'clxxx1234567890abc',
            quantity: -1, // Invalid negative quantity
          },
        ],
      }

      const request = new NextRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify(invalidQuantityData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid checkout payload')
      expect(data.details).toBeDefined()
    })

    it('should validate postal code is required', async () => {
      const invalidPostalCodeData = {
        ...validCheckoutData,
        shipping: {
          ...validCheckoutData.shipping,
          postalCode: '', // Empty postal code
        },
      }

      const request = new NextRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify(invalidPostalCodeData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid checkout payload')
      expect(data.details).toBeDefined()
    })

    it('should validate state is required', async () => {
      const invalidStateData = {
        ...validCheckoutData,
        shipping: {
          ...validCheckoutData.shipping,
          state: '', // Empty state
        },
      }

      const request = new NextRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify(invalidStateData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid checkout payload')
      expect(data.details).toBeDefined()
    })

    it('should handle combined weight calculation for multiple items', async () => {
      const { default: prisma } = await import('@/lib/prisma')
      const { getCurrentUser } = await import('@/lib/rbac')
      const { calculateShipping } = await import('@/lib/shipping-calculator')

      const mockProduct2 = {
        ...mockProduct,
        id: 'clxxx0987654321xyz',
        weight: 2.0,
      }

      const multiItemCheckout = {
        ...validCheckoutData,
        items: [
          { productId: 'clxxx1234567890abc', quantity: 2 }, // 1.5 lb each
          { productId: 'clxxx0987654321xyz', quantity: 1 }, // 2.0 lb each
        ],
      }

      vi.mocked(getCurrentUser).mockResolvedValue(null)
      vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct, mockProduct2] as any)
      vi.mocked(prisma.order.create).mockResolvedValue(mockOrder as any)

      const request = new NextRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify(multiItemCheckout),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.clientSecret).toBeDefined()

      // Verify shipping was calculated with combined weights
      expect(calculateShipping).toHaveBeenCalledWith(
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              weightOz: 1.5,
              quantity: 2,
            }),
            expect.objectContaining({
              weightOz: 2.0,
              quantity: 1,
            }),
          ]),
        })
      )
    })
  })
})
