import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/checkout/complete/route'

// Mock dependencies
vi.mock('@/lib/prisma', () => {
  const createMockPrisma = () => ({
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    abandonedCart: {
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    inventoryTransaction: {
      create: vi.fn(),
    },
  })

  return {
    default: {
      ...createMockPrisma(),
      $transaction: vi.fn((callback) => {
        if (typeof callback === 'function') {
          return callback(createMockPrisma())
        }
        return Promise.all(callback)
      }),
    },
  }
})

// The route reads the abandonedCartId attribution cookie via next/headers.
const mockCookieGet = vi.fn<(name: string) => { value: string } | undefined>(() => undefined)
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: mockCookieGet,
  })),
}))

// The route confirms payment through the provider adapter's confirmPayment().
const mockConfirmPayment = vi.fn(() => Promise.resolve({ status: 'SUCCEEDED' }))

vi.mock('@/lib/payments', () => ({
  getProvider: vi.fn(() => ({
    confirmPayment: mockConfirmPayment,
  })),
}))

// Inventory is deducted inside the transaction and alerts fire afterwards.
const mockDeductReservedInventoryInTx = vi.fn(() =>
  Promise.resolve({ newInventory: 10, product: { lowStockThreshold: 5 } })
)

vi.mock('@/lib/inventory-manager', () => ({
  deductReservedInventoryInTx: (...args: unknown[]) => mockDeductReservedInventoryInTx(...args),
  releaseInventory: vi.fn(() => Promise.resolve()),
  checkAndUpdateAlerts: vi.fn(() => Promise.resolve()),
}))

describe('Checkout Complete API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCookieGet.mockReturnValue(undefined)
    mockConfirmPayment.mockResolvedValue({ status: 'SUCCEEDED' })
    mockDeductReservedInventoryInTx.mockResolvedValue({
      newInventory: 10,
      product: { lowStockThreshold: 5 },
    })
  })

  const mockOrder = {
    id: 'clxxx1234567890order',
    orderNumber: 'JMS-20260105-1234',
    userId: null,
    guestEmail: 'test@example.com',
    paymentStatus: 'PENDING',
    status: 'PENDING',
    total: 30.97,
    participantId: null,
    fundraiserId: null,
    items: [
      {
        id: 'clxxx1234567890item1',
        productId: 'clxxx1234567890prod',
        quantity: 2,
        unitPrice: 8.99,
        totalPrice: 17.98,
      },
      {
        id: 'clxxx1234567890item2',
        productId: 'clxxx1234567890prd2',
        quantity: 1,
        unitPrice: 12.99,
        totalPrice: 12.99,
      },
    ],
  }

  const buildTx = () => ({
    order: {
      update: vi.fn().mockResolvedValue({ ...mockOrder, paymentStatus: 'PAID', status: 'CONFIRMED' }),
    },
    abandonedCart: {
      update: vi.fn().mockResolvedValue({ count: 1 }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    fundraiser: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    fundraiserParticipant: {
      update: vi.fn().mockResolvedValue({}),
    },
  })

  const makeRequest = (body: Record<string, unknown>) =>
    new Request('http://localhost/api/checkout/complete', {
      method: 'POST',
      body: JSON.stringify(body),
    })

  describe('Payment Completion Flow', () => {
    it('should complete payment and update order status', async () => {
      const { default: prisma } = await import('@/lib/prisma')

      vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)

      const mockTx = buildTx()
      vi.mocked(prisma.$transaction).mockImplementation((callback: any) => callback(mockTx))

      const response = await POST(makeRequest({
        orderId: 'clxxx1234567890order',
        paymentIntentId: 'pi_test123',
      }))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // Payment was confirmed via the provider adapter
      expect(mockConfirmPayment).toHaveBeenCalledWith('pi_test123')

      // Order was looked up by id
      expect(prisma.order.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'clxxx1234567890order' } })
      )

      // Order was marked paid/confirmed inside the transaction
      expect(mockTx.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'clxxx1234567890order' },
          data: expect.objectContaining({
            paymentStatus: 'PAID',
            status: 'CONFIRMED',
            stripePaymentId: 'pi_test123',
          }),
        })
      )

      // Reserved inventory was deducted for every item
      expect(mockDeductReservedInventoryInTx).toHaveBeenCalledWith(
        expect.objectContaining({ productId: 'clxxx1234567890prod', quantity: 2 }),
        expect.anything()
      )
      expect(mockDeductReservedInventoryInTx).toHaveBeenCalledWith(
        expect.objectContaining({ productId: 'clxxx1234567890prd2', quantity: 1 }),
        expect.anything()
      )

      // Guest abandoned carts were marked recovered (fallback path, no cookie)
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

      vi.mocked(prisma.order.findUnique).mockResolvedValue(authenticatedOrder as any)

      const mockTx = buildTx()
      vi.mocked(prisma.$transaction).mockImplementation((callback: any) => callback(mockTx))

      const response = await POST(makeRequest({
        orderId: 'clxxx1234567890order',
        paymentIntentId: 'pi_test123',
      }))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // Abandoned cart recovery by userId (fallback path)
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

    it('should attribute a specific abandoned cart from the recovery cookie', async () => {
      const { default: prisma } = await import('@/lib/prisma')

      mockCookieGet.mockReturnValue({ value: 'clxxx1234567890cart1' })
      vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)

      const mockTx = buildTx()
      vi.mocked(prisma.$transaction).mockImplementation((callback: any) => callback(mockTx))

      const response = await POST(makeRequest({
        orderId: 'clxxx1234567890order',
        paymentIntentId: 'pi_test123',
      }))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // The specific cart from the cookie is updated, not the email fallback
      expect(mockTx.abandonedCart.update).toHaveBeenCalledWith({
        where: { id: 'clxxx1234567890cart1' },
        data: { recoveredAt: expect.any(Date) },
      })
      expect(mockTx.abandonedCart.updateMany).not.toHaveBeenCalled()
    })

    it('should handle already paid orders idempotently', async () => {
      const { default: prisma } = await import('@/lib/prisma')

      const paidOrder = {
        ...mockOrder,
        paymentStatus: 'PAID',
        status: 'CONFIRMED',
      }

      vi.mocked(prisma.order.findUnique).mockResolvedValue(paidOrder as any)

      const response = await POST(makeRequest({
        orderId: 'clxxx1234567890order',
        paymentIntentId: 'pi_test123',
      }))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // Transaction was not executed for an already-paid order
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
        const response = await POST(makeRequest(payload))
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Invalid completion payload.')
      }
    })

    it('should handle order not found', async () => {
      const { default: prisma } = await import('@/lib/prisma')

      vi.mocked(prisma.order.findUnique).mockResolvedValue(null)

      const response = await POST(makeRequest({
        orderId: 'clxxx9999999999none',
        paymentIntentId: 'pi_test123',
      }))
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Order could not be found.')
    })

    it('should handle payment not succeeded', async () => {
      const { default: prisma } = await import('@/lib/prisma')

      mockConfirmPayment.mockResolvedValue({ status: 'PROCESSING' })
      vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)

      const response = await POST(makeRequest({
        orderId: 'clxxx1234567890order',
        paymentIntentId: 'pi_test123',
      }))
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Payment has not been confirmed.')
    })

    it('should handle payment confirmation not found', async () => {
      const { default: prisma } = await import('@/lib/prisma')

      mockConfirmPayment.mockResolvedValue(null as any)
      vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)

      const response = await POST(makeRequest({
        orderId: 'clxxx1234567890order',
        paymentIntentId: 'pi_invalid',
      }))
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Payment has not been confirmed.')
    })

    it('should handle payment provider errors', async () => {
      const { default: prisma } = await import('@/lib/prisma')

      mockConfirmPayment.mockRejectedValue(new Error('Stripe API error'))
      vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)

      const response = await POST(makeRequest({
        orderId: 'clxxx1234567890order',
        paymentIntentId: 'pi_test123',
      }))
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Unable to finalize checkout.')
    })

    it('should handle database transaction errors', async () => {
      const { default: prisma } = await import('@/lib/prisma')

      vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)
      vi.mocked(prisma.$transaction).mockRejectedValue(new Error('Database error'))

      const response = await POST(makeRequest({
        orderId: 'clxxx1234567890order',
        paymentIntentId: 'pi_test123',
      }))
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Unable to finalize checkout.')
    })

    it('should deduct reserved inventory for large quantities', async () => {
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

      vi.mocked(prisma.order.findUnique).mockResolvedValue(largeQuantityOrder as any)

      const mockTx = buildTx()
      vi.mocked(prisma.$transaction).mockImplementation((callback: any) => callback(mockTx))

      const response = await POST(makeRequest({
        orderId: 'clxxx1234567890order',
        paymentIntentId: 'pi_test123',
      }))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // Large quantity was deducted correctly
      expect(mockDeductReservedInventoryInTx).toHaveBeenCalledWith(
        expect.objectContaining({ productId: 'clxxx1234567890prod', quantity: 50 }),
        expect.anything()
      )
    })

    it('should handle orders with no abandoned carts to recover', async () => {
      const { default: prisma } = await import('@/lib/prisma')

      const orderNoRecovery = {
        ...mockOrder,
        userId: null,
        guestEmail: null, // No email to match abandoned carts
      }

      vi.mocked(prisma.order.findUnique).mockResolvedValue(orderNoRecovery as any)

      const mockTx = buildTx()
      vi.mocked(prisma.$transaction).mockImplementation((callback: any) => callback(mockTx))

      const response = await POST(makeRequest({
        orderId: 'clxxx1234567890order',
        paymentIntentId: 'pi_test123',
      }))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // No cookie, no userId and no guestEmail -> no abandoned cart recovery
      expect(mockTx.abandonedCart.update).not.toHaveBeenCalled()
      expect(mockTx.abandonedCart.updateMany).not.toHaveBeenCalled()
    })
  })
})
