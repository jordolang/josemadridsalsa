import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/cart/route'
import { PUT, DELETE } from '@/app/api/cart/[id]/route'

// Mock dependencies
vi.mock('next-auth')

vi.mock('@/lib/prisma', () => {
  const mockPrismaClient = {
    product: {
      findUnique: vi.fn(),
    },
    cartItem: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
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

describe('Cart API', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
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
  }

  const mockProduct: any = {
    id: 'prod-123',
    name: 'Test Salsa',
    slug: 'test-salsa',
    price: 8.99,
    compareAtPrice: null,
    featuredImage: '/images/test.jpg',
    heatLevel: 'MEDIUM',
    inventory: 100,
    sku: 'TEST-001',
    description: 'Test description',
    categoryId: 'category-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockCartItem: any = {
    id: 'cart-item-123',
    userId: 'user-123',
    productId: 'prod-123',
    quantity: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
    product: mockProduct,
  }

  describe('GET /api/cart', () => {
    it('should return 401 when user is not authenticated', async () => {
      const { getServerSession } = await import('next-auth')
      vi.mocked(getServerSession).mockResolvedValueOnce(null)

      const request = new NextRequest('http://localhost/api/cart', {
        method: 'GET',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized - authentication required')
    })

    it('should return empty cart for authenticated user with no items', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.cartItem.findMany).mockResolvedValue([])

      const request = new NextRequest('http://localhost/api/cart', {
        method: 'GET',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.items).toEqual([])
      expect(data.itemCount).toBe(0)
      expect(data.totalQuantity).toBe(0)
      expect(data.subtotal).toBe(0)
    })

    it('should return cart items with serialized prices', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.cartItem.findMany).mockResolvedValue([mockCartItem])

      const request = new NextRequest('http://localhost/api/cart', {
        method: 'GET',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.items).toHaveLength(1)
      expect(data.items[0].id).toBe('cart-item-123')
      expect(data.items[0].quantity).toBe(2)
      expect(data.items[0].product.name).toBe('Test Salsa')
      // Price must be a number, not a Prisma Decimal object
      expect(typeof data.items[0].product.price).toBe('number')
      expect(data.items[0].product.price).toBe(8.99)
      expect(data.itemCount).toBe(1)
      expect(data.totalQuantity).toBe(2)
      expect(data.subtotal).toBe(17.98)
    })

    it('should calculate cart totals correctly with multiple items', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      const cartItems = [
        { ...mockCartItem, id: 'item-1', quantity: 2 },
        {
          ...mockCartItem,
          id: 'item-2',
          quantity: 3,
          product: { ...mockProduct, price: 12.99 },
        },
      ]

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.cartItem.findMany).mockResolvedValue(cartItems)

      const request = new NextRequest('http://localhost/api/cart', {
        method: 'GET',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.itemCount).toBe(2)
      expect(data.totalQuantity).toBe(5)
      expect(data.subtotal).toBe(56.95) // (2 * 8.99) + (3 * 12.99)
    })

    it('should handle database errors gracefully', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.cartItem.findMany).mockRejectedValue(
        new Error('Database error')
      )

      const request = new NextRequest('http://localhost/api/cart', {
        method: 'GET',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })

  describe('POST /api/cart', () => {
    it('should return 401 when user is not authenticated', async () => {
      const { getServerSession } = await import('next-auth')
      vi.mocked(getServerSession).mockResolvedValueOnce(null)

      const request = new NextRequest('http://localhost/api/cart', {
        method: 'POST',
        body: JSON.stringify({ productId: 'clxxx1234567890abc', quantity: 1 }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized - authentication required')
    })

    it('should return 400 when payload is invalid', async () => {
      // getServerSession already mocked as authenticated in beforeEach

      const request = new NextRequest('http://localhost/api/cart', {
        method: 'POST',
        body: JSON.stringify({ productId: 'invalid', quantity: -1 }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(422)
      expect(data.error).toBe('Invalid request')
    })

    it('should return 404 when product does not exist', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.product.findUnique).mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/cart', {
        method: 'POST',
        body: JSON.stringify({ productId: 'clxxx1234567890abc', quantity: 1 }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Product not found')
    })

    it('should return 400 when inventory is insufficient for new item', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.product.findUnique).mockResolvedValue({
        ...mockProduct,
        inventory: 5,
      })
      vi.mocked(prisma.cartItem.findFirst).mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/cart', {
        method: 'POST',
        body: JSON.stringify({ productId: 'clxxx1234567890abc', quantity: 10 }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Insufficient inventory')
      expect(data.error).toContain('Available: 5')
    })

    it('should return 400 when accumulated quantity exceeds inventory', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.product.findUnique).mockResolvedValue({
        ...mockProduct,
        inventory: 5,
      })
      // Existing item already has quantity 4
      vi.mocked(prisma.cartItem.findFirst).mockResolvedValue({
        ...mockCartItem,
        quantity: 4,
      })

      const request = new NextRequest('http://localhost/api/cart', {
        method: 'POST',
        body: JSON.stringify({ productId: 'clxxx1234567890abc', quantity: 3 }),
      })

      const response = await POST(request)
      const data = await response.json()

      // 4 existing + 3 requested = 7, inventory = 5 → should fail
      expect(response.status).toBe(400)
      expect(data.error).toContain('Insufficient inventory')
      expect(data.error).toContain('Available: 5')
    })

    it('should create new cart item when product not in cart', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')
      const { logAuditWithRequest } = await import('@/lib/audit')

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.product.findUnique).mockResolvedValue(mockProduct)
      vi.mocked(prisma.cartItem.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.cartItem.create).mockResolvedValue(mockCartItem)

      const request = new NextRequest('http://localhost/api/cart', {
        method: 'POST',
        body: JSON.stringify({ productId: 'clxxx1234567890abc', quantity: 2 }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.cartItem.id).toBe('cart-item-123')
      expect(data.cartItem.quantity).toBe(2)
      expect(prisma.cartItem.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          productId: 'clxxx1234567890abc',
          quantity: 2,
        },
        include: {
          product: true,
        },
      })
      expect(logAuditWithRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          action: 'create',
          entityType: 'CartItem',
          entityId: 'cart-item-123',
        }),
        request
      )
    })

    it('should update existing cart item with accumulated quantity', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      const existingCartItem = { ...mockCartItem, quantity: 1 }

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.product.findUnique).mockResolvedValue(mockProduct)
      vi.mocked(prisma.cartItem.findFirst).mockResolvedValue(existingCartItem)
      vi.mocked(prisma.cartItem.update).mockResolvedValue({
        ...mockCartItem,
        quantity: 3,
      })

      const request = new NextRequest('http://localhost/api/cart', {
        method: 'POST',
        body: JSON.stringify({ productId: 'clxxx1234567890abc', quantity: 2 }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.cartItem.quantity).toBe(3)
      expect(prisma.cartItem.update).toHaveBeenCalledWith({
        where: { id: 'cart-item-123' },
        data: {
          quantity: 3, // 1 existing + 2 new
        },
        include: {
          product: true,
        },
      })
    })

    it('should handle database errors gracefully', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.product.findUnique).mockRejectedValue(
        new Error('Database error')
      )

      const request = new NextRequest('http://localhost/api/cart', {
        method: 'POST',
        body: JSON.stringify({ productId: 'clxxx1234567890abc', quantity: 1 }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })

  describe('PUT /api/cart/[id]', () => {
    it('should return 401 when user is not authenticated', async () => {
      const { getServerSession } = await import('next-auth')
      vi.mocked(getServerSession).mockResolvedValueOnce(null)

      const request = new NextRequest(
        'http://localhost/api/cart/cart-item-123',
        {
          method: 'PUT',
          body: JSON.stringify({ quantity: 3 }),
        }
      )

      const response = await PUT(request, { params: Promise.resolve({ id: 'cart-item-123' }) })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized - authentication required')
    })

    it('should return 400 when payload is invalid', async () => {
      // getServerSession already mocked as authenticated in beforeEach

      const request = new NextRequest(
        'http://localhost/api/cart/cart-item-123',
        {
          method: 'PUT',
          body: JSON.stringify({ quantity: -1 }),
        }
      )

      const response = await PUT(request, { params: Promise.resolve({ id: 'cart-item-123' }) })
      const data = await response.json()

      expect(response.status).toBe(422)
      expect(data.error).toBe('Invalid request')
    })

    it('should return 404 when cart item does not exist', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.cartItem.findUnique).mockResolvedValue(null)

      const request = new NextRequest(
        'http://localhost/api/cart/cart-item-123',
        {
          method: 'PUT',
          body: JSON.stringify({ quantity: 3 }),
        }
      )

      const response = await PUT(request, { params: Promise.resolve({ id: 'cart-item-123' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Cart item not found')
    })

    it('should return 403 when cart item belongs to different user', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.cartItem.findUnique).mockResolvedValue({
        ...mockCartItem,
        userId: 'different-user',
      })

      const request = new NextRequest(
        'http://localhost/api/cart/cart-item-123',
        {
          method: 'PUT',
          body: JSON.stringify({ quantity: 3 }),
        }
      )

      const response = await PUT(request, { params: Promise.resolve({ id: 'cart-item-123' }) })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toContain('Cannot update another user')
    })

    it('should return 400 when inventory is insufficient', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.cartItem.findUnique).mockResolvedValue({
        ...mockCartItem,
        product: { ...mockProduct, inventory: 2 },
      })

      const request = new NextRequest(
        'http://localhost/api/cart/cart-item-123',
        {
          method: 'PUT',
          body: JSON.stringify({ quantity: 5 }),
        }
      )

      const response = await PUT(request, { params: Promise.resolve({ id: 'cart-item-123' }) })
      const data = await response.json()

      expect(response.status).toBe(422)
      expect(data.error).toContain('Insufficient inventory')
      expect(data.error).toContain('Available: 2')
    })

    it('should update cart item quantity successfully', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')
      const { logAuditWithRequest } = await import('@/lib/audit')

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.cartItem.findUnique).mockResolvedValue(mockCartItem)
      vi.mocked(prisma.cartItem.update).mockResolvedValue({
        ...mockCartItem,
        quantity: 5,
      })

      const request = new NextRequest(
        'http://localhost/api/cart/cart-item-123',
        {
          method: 'PUT',
          body: JSON.stringify({ quantity: 5 }),
        }
      )

      const response = await PUT(request, { params: Promise.resolve({ id: 'cart-item-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.cartItem.quantity).toBe(5)
      expect(prisma.cartItem.update).toHaveBeenCalledWith({
        where: { id: 'cart-item-123' },
        data: {
          quantity: 5,
        },
        include: {
          product: true,
        },
      })
      expect(logAuditWithRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          action: 'update',
          entityType: 'CartItem',
          entityId: 'cart-item-123',
          changes: expect.objectContaining({
            quantity: {
              from: 2,
              to: 5,
            },
          }),
        }),
        request
      )
    })

    it('should handle database errors gracefully', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.cartItem.findUnique).mockRejectedValue(
        new Error('Database error')
      )

      const request = new NextRequest(
        'http://localhost/api/cart/cart-item-123',
        {
          method: 'PUT',
          body: JSON.stringify({ quantity: 3 }),
        }
      )

      const response = await PUT(request, { params: Promise.resolve({ id: 'cart-item-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })

  describe('DELETE /api/cart/[id]', () => {
    it('should return 401 when user is not authenticated', async () => {
      const { getServerSession } = await import('next-auth')
      vi.mocked(getServerSession).mockResolvedValueOnce(null)

      const request = new NextRequest(
        'http://localhost/api/cart/cart-item-123',
        { method: 'DELETE' }
      )

      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'cart-item-123' }),
      })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized - authentication required')
    })

    it('should return 404 when cart item does not exist', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.cartItem.findUnique).mockResolvedValue(null)

      const request = new NextRequest(
        'http://localhost/api/cart/cart-item-123',
        { method: 'DELETE' }
      )

      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'cart-item-123' }),
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Cart item not found')
    })

    it('should return 403 when cart item belongs to different user', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.cartItem.findUnique).mockResolvedValue({
        ...mockCartItem,
        userId: 'different-user',
      })

      const request = new NextRequest(
        'http://localhost/api/cart/cart-item-123',
        { method: 'DELETE' }
      )

      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'cart-item-123' }),
      })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toContain('Cannot delete another user')
    })

    it('should delete cart item successfully', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')
      const { logAuditWithRequest } = await import('@/lib/audit')

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.cartItem.findUnique).mockResolvedValue(mockCartItem)
      vi.mocked(prisma.cartItem.delete).mockResolvedValue(mockCartItem)

      const request = new NextRequest(
        'http://localhost/api/cart/cart-item-123',
        { method: 'DELETE' }
      )

      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'cart-item-123' }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Cart item removed successfully')
      expect(prisma.cartItem.delete).toHaveBeenCalledWith({
        where: { id: 'cart-item-123' },
      })
      expect(logAuditWithRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          action: 'delete',
          entityType: 'CartItem',
          entityId: 'cart-item-123',
          changes: expect.objectContaining({
            productId: 'prod-123',
            productName: 'Test Salsa',
            quantity: 2,
          }),
        }),
        request
      )
    })

    it('should handle database errors gracefully', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValueOnce({ user: mockUser })
      vi.mocked(prisma.cartItem.findUnique).mockRejectedValue(
        new Error('Database error')
      )

      const request = new NextRequest(
        'http://localhost/api/cart/cart-item-123',
        { method: 'DELETE' }
      )

      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'cart-item-123' }),
      })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })
})
