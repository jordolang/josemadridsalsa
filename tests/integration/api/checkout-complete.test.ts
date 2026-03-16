import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/checkout/complete/route'

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  default: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    product: {
      update: vi.fn(),
    },
    abandonedCart: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback({
      order: {
        update: vi.fn(),
      },
      product: {
        update: vi.fn(),
      },
      abandonedCart: {
        updateMany: vi.fn(),
      },
    })),
  },
}))

const mockPaymentIntentRetrieve = vi.fn()

vi.mock('@/lib/stripe', () => ({
  getStripe: vi.fn(() => ({
    paymentIntents: {
      retrieve: mockPaymentIntentRetrieve,
    },
  })),
}))

describe('Checkout Complete API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPaymentIntentRetrieve.mockClear()
  })

  const mockOrder = {
    id: 'clxxx1234567890order',
    orderNumber: 'JMS-20260105-1234',
    userId: null,
    guestEmail: 'test@example.com',
    guestPhone: '555-1234',
    paymentStatus: 'PENDING',
    status: 'PENDING',
    items: [
      {
        id: 'clxxx1234567890item1',
        productId: 'clxxx1234567890prod',
        quantity: 2,
        unitPrice: 8.99,
        totalPrice: 17.98,
        productName: 'Test Salsa',
        productSku: 'TEST-001',
      },
      {
        id: 'clxxx1234567890item2',
        productId: 'clxxx1234567890prd2',
        quantity: 1,
        unitPrice: 12.99,
        totalPrice: 12.99,
        productName: 'Spicy Salsa',
        productSku: 'TEST-002',
      },
    ],
  }

  const mockPaymentIntent = {
    id: 'pi_test123',
    status: 'succeeded',
    amount: 2947,
    currency: 'usd',
  }

  describe('Payment Completion Flow', () => {
    it('should complete payment and update order status', async () => {
      const { default: prisma } = await import('@/lib/prisma')

      mockPaymentIntentRetrieve.mockResolvedValue(mockPaymentIntent)
      vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)

      const mockTx = {
        order: {
          update: vi.fn().mockResolvedValue({ ...mockOrder, paymentStatus: 'PAID', status: 'CONFIRMED' }),
        },
        product: {
          update: vi.fn().mockResolvedValue({}),
        },
        abandonedCart: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      }

      vi.mocked(prisma.$transaction).mockImplementation((callback: any) => callback(mockTx))

      const request = new Request('http://localhost/api/checkout/complete', {
        method: 'POST',
        body: JSON.stringify({
          orderId: 'clxxx1234567890order',
          paymentIntentId: 'pi_test123',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // Verify payment intent was retrieved
      expect(mockPaymentIntentRetrieve).toHaveBeenCalledWith('pi_test123')

      // Verify order was found
      expect(prisma.order.findUnique).toHaveBeenCalledWith({
        where: { id: 'clxxx1234567890order' },
        include: { items: true },
      })

      // Verify order status was updated
      expect(mockTx.order.update).toHaveBeenCalledWith({
        where: { id: 'clxxx1234567890order' },
        data: {
          paymentStatus: 'PAID',
          status: 'CONFIRMED',
          stripePaymentId: 'pi_test123',
        },
      })

      // Verify inventory was decremented for all items
      expect(mockTx.product.update).toHaveBeenCalledWith({
        where: { id: 'clxxx1234567890prod' },
        data: {
          inventory: {
            decrement: 2,
          },
        },
      })

      expect(mockTx.product.update).toHaveBeenCalledWith({
        where: { id: 'clxxx1234567890prd2' },
        data: {
          inventory: {
            decrement: 1,
          },
        },
      })

      // Verify abandoned cart was marked as recovered
      expect(mockTx.abandonedCart.updateMany).toHaveBeenCalledWith({
        where: {
          guestEmail: 'test@example.com',
          recoveredAt: null,
        },
        data: {
          recoveredAt: expect.any(Date),
        },
      })
    })

    it('should handle authenticated user abandoned cart recovery', async () => {
      const { default: prisma } = await import('@/lib/prisma')

      const authenticatedOrder = {
        ...mockOrder,
        userId: 'clxxx1234567890user1',
        guestEmail: null,
      }

      mockPaymentIntentRetrieve.mockResolvedValue(mockPaymentIntent)
      vi.mocked(prisma.order.findUnique).mockResolvedValue(authenticatedOrder as any)

      const mockTx = {
        order: {
          update: vi.fn().mockResolvedValue({ ...authenticatedOrder, paymentStatus: 'PAID' }),
        },
        product: {
          update: vi.fn().mockResolvedValue({}),
        },
        abandonedCart: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      }

      vi.mocked(prisma.$transaction).mockImplementation((callback: any) => callback(mockTx))

      const request = new Request('http://localhost/api/checkout/complete', {
        method: 'POST',
        body: JSON.stringify({
          orderId: 'clxxx1234567890order',
          paymentIntentId: 'pi_test123',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // Verify abandoned cart recovery by userId
      expect(mockTx.abandonedCart.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'clxxx1234567890user1',
          recoveredAt: null,
        },
        data: {
          recoveredAt: expect.any(Date),
        },
      })
    })

    it('should handle already paid orders idempotently', async () => {
      const { default: prisma } = await import('@/lib/prisma')

      const paidOrder = {
        ...mockOrder,
        paymentStatus: 'PAID',
        status: 'CONFIRMED',
      }

      mockPaymentIntentRetrieve.mockResolvedValue(mockPaymentIntent)
      vi.mocked(prisma.order.findUnique).mockResolvedValue(paidOrder as any)

      const request = new Request('http://localhost/api/checkout/complete', {
        method: 'POST',
        body: JSON.stringify({
          orderId: 'clxxx1234567890order',
          paymentIntentId: 'pi_test123',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // Verify transaction was not executed
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('should validate completion payload', async () => {
      const invalidPayloads = [
        {},
        { orderId: 'invalid-id' }, // Missing paymentIntentId
        { paymentIntentId: 'pi_test' }, // Missing orderId
        { orderId: 'not-a-cuid', paymentIntentId: 'pi_test' }, // Invalid CUID
        { orderId: 'clxxx1234567890abc', paymentIntentId: '' }, // Empty paymentIntentId
      ]

      for (const payload of invalidPayloads) {
        const request = new Request('http://localhost/api/checkout/complete', {
          method: 'POST',
          body: JSON.stringify(payload),
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Invalid completion payload.')
      }
    })

    it('should handle order not found', async () => {
      const { default: prisma } = await import('@/lib/prisma')

      mockPaymentIntentRetrieve.mockResolvedValue(mockPaymentIntent)
      vi.mocked(prisma.order.findUnique).mockResolvedValue(null)

      const request = new Request('http://localhost/api/checkout/complete', {
        method: 'POST',
        body: JSON.stringify({
          orderId: 'clxxx9999999999none',
          paymentIntentId: 'pi_test123',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Order could not be found.')
    })

    it('should handle payment not succeeded', async () => {
      const { default: prisma } = await import('@/lib/prisma')

      const pendingPaymentIntent = {
        ...mockPaymentIntent,
        status: 'processing',
      }

      mockPaymentIntentRetrieve.mockResolvedValue(pendingPaymentIntent)
      vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)

      const request = new Request('http://localhost/api/checkout/complete', {
        method: 'POST',
        body: JSON.stringify({
          orderId: 'clxxx1234567890order',
          paymentIntentId: 'pi_test123',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Payment has not been confirmed.')
    })

    it('should handle payment intent not found', async () => {
      const { default: prisma } = await import('@/lib/prisma')

      mockPaymentIntentRetrieve.mockResolvedValue(null)
      vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)

      const request = new Request('http://localhost/api/checkout/complete', {
        method: 'POST',
        body: JSON.stringify({
          orderId: 'clxxx1234567890order',
          paymentIntentId: 'pi_invalid',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Payment has not been confirmed.')
    })

    it('should handle Stripe API errors', async () => {
      const { default: prisma } = await import('@/lib/prisma')

      mockPaymentIntentRetrieve.mockRejectedValue(new Error('Stripe API error'))
      vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)

      const request = new Request('http://localhost/api/checkout/complete', {
        method: 'POST',
        body: JSON.stringify({
          orderId: 'clxxx1234567890order',
          paymentIntentId: 'pi_test123',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Unable to finalize checkout.')
    })

    it('should handle database transaction errors', async () => {
      const { default: prisma } = await import('@/lib/prisma')

      mockPaymentIntentRetrieve.mockResolvedValue(mockPaymentIntent)
      vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)
      vi.mocked(prisma.$transaction).mockRejectedValue(new Error('Database error'))

      const request = new Request('http://localhost/api/checkout/complete', {
        method: 'POST',
        body: JSON.stringify({
          orderId: 'clxxx1234567890order',
          paymentIntentId: 'pi_test123',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Unable to finalize checkout.')
    })

    it('should properly decrement inventory for large quantities', async () => {
      const { default: prisma } = await import('@/lib/prisma')

      const largeQuantityOrder = {
        ...mockOrder,
        items: [
          {
            ...mockOrder.items[0],
            quantity: 50, // Large quantity
          },
        ],
      }

      mockPaymentIntentRetrieve.mockResolvedValue(mockPaymentIntent)
      vi.mocked(prisma.order.findUnique).mockResolvedValue(largeQuantityOrder as any)

      const mockTx = {
        order: {
          update: vi.fn().mockResolvedValue({ ...largeQuantityOrder, paymentStatus: 'PAID' }),
        },
        product: {
          update: vi.fn().mockResolvedValue({}),
        },
        abandonedCart: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      }

      vi.mocked(prisma.$transaction).mockImplementation((callback: any) => callback(mockTx))

      const request = new Request('http://localhost/api/checkout/complete', {
        method: 'POST',
        body: JSON.stringify({
          orderId: 'clxxx1234567890order',
          paymentIntentId: 'pi_test123',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // Verify large quantity was decremented correctly
      expect(mockTx.product.update).toHaveBeenCalledWith({
        where: { id: 'clxxx1234567890prod' },
        data: {
          inventory: {
            decrement: 50,
          },
        },
      })
    })

    it('should handle orders with no abandoned carts to recover', async () => {
      const { default: prisma } = await import('@/lib/prisma')

      const orderNoRecovery = {
        ...mockOrder,
        userId: null,
        guestEmail: null, // No email to match abandoned carts
      }

      mockPaymentIntentRetrieve.mockResolvedValue(mockPaymentIntent)
      vi.mocked(prisma.order.findUnique).mockResolvedValue(orderNoRecovery as any)

      const mockTx = {
        order: {
          update: vi.fn().mockResolvedValue({ ...orderNoRecovery, paymentStatus: 'PAID' }),
        },
        product: {
          update: vi.fn().mockResolvedValue({}),
        },
        abandonedCart: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      }

      vi.mocked(prisma.$transaction).mockImplementation((callback: any) => callback(mockTx))

      const request = new Request('http://localhost/api/checkout/complete', {
        method: 'POST',
        body: JSON.stringify({
          orderId: 'clxxx1234567890order',
          paymentIntentId: 'pi_test123',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // Abandoned cart update should not be called if no userId or guestEmail
      expect(mockTx.abandonedCart.updateMany).not.toHaveBeenCalled()
    })
  })
})
