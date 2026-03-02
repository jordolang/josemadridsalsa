import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/cart/recover/route'

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    abandonedCart: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

describe('Cart Recover API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/cart/recover', () => {
    const mockCartData = {
      items: [
        {
          id: 'prod-123',
          name: 'Test Salsa',
          slug: 'test-salsa',
          price: 8.99,
          image: '/images/test.jpg',
          quantity: 2,
          sku: 'TEST-001',
          heatLevel: 'MEDIUM',
        },
      ],
      totalItems: 2,
      totalPrice: 17.98,
    }

    it('should require recovery token', async () => {
      const request = new NextRequest('http://localhost/api/cart/recover')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Recovery token required')
    })

    it('should return 404 for invalid token', async () => {
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(prisma.abandonedCart.findUnique).mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/cart/recover?token=invalid')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Invalid recovery token')
    })

    it('should return 410 for already recovered cart', async () => {
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(prisma.abandonedCart.findUnique).mockResolvedValue({
        id: 'cart-123',
        userId: 'user-123',
        guestEmail: null,
        cartData: mockCartData,
        recoveryToken: 'token-123',
        emailSent: true,
        emailSentAt: new Date(),
        recoveredAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const request = new NextRequest('http://localhost/api/cart/recover?token=token-123')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(410)
      expect(data.error).toBe('Cart has already been recovered')
    })

    it('should return 410 for expired cart (>30 days)', async () => {
      const { prisma } = await import('@/lib/prisma')

      const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)

      vi.mocked(prisma.abandonedCart.findUnique).mockResolvedValue({
        id: 'cart-123',
        userId: 'user-123',
        guestEmail: null,
        cartData: mockCartData,
        recoveryToken: 'token-123',
        emailSent: true,
        emailSentAt: new Date(),
        recoveredAt: null,
        createdAt: thirtyOneDaysAgo,
        updatedAt: thirtyOneDaysAgo,
      })

      const request = new NextRequest('http://localhost/api/cart/recover?token=token-123')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(410)
      expect(data.error).toBe('Cart recovery link has expired')
    })

    it('should successfully recover cart and return data', async () => {
      const { prisma } = await import('@/lib/prisma')

      const cart = {
        id: 'cart-123',
        userId: 'user-123',
        guestEmail: null,
        cartData: mockCartData,
        recoveryToken: 'token-123',
        emailSent: true,
        emailSentAt: new Date(),
        recoveredAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.abandonedCart.findUnique).mockResolvedValue(cart)
      vi.mocked(prisma.abandonedCart.update).mockResolvedValue({
        ...cart,
        recoveredAt: new Date(),
      })

      const request = new NextRequest('http://localhost/api/cart/recover?token=token-123')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.cart).toEqual(mockCartData)
      expect(prisma.abandonedCart.update).toHaveBeenCalledWith({
        where: { id: 'cart-123' },
        data: { recoveredAt: expect.any(Date) },
      })
    })
  })
})
