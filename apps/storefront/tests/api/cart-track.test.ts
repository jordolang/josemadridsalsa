import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/cart/track/route'

/**
 * Cart Tracking API Tests
 *
 * Testing approach:
 * - Uses Vitest vi.mock for internal dependencies (Prisma, RBAC)
 * - MSW is available via vitest-setup.ts for external HTTP mocking if needed
 * - Tests verify cart tracking logic for both authenticated users and guests
 *
 * Note: MSW server is configured globally and resets between tests.
 * Use server.use() from 'msw/node' to add test-specific HTTP handlers.
 */

// Mock internal dependencies
vi.mock('@/lib/rbac', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/fundraising/store.server', () => ({
  resolveFundraiserStore: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    abandonedCart: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

describe('Cart Track API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/cart/track', () => {
    const validCartData = {
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
    }

    it('should validate cart data schema', async () => {
      const { getCurrentUser } = await import('@/lib/rbac')
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'CUSTOMER',
      })

      const request = new NextRequest('http://localhost/api/cart/track', {
        method: 'POST',
        body: JSON.stringify({ items: 'invalid' }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid cart data')
    })

    it('should skip tracking when no user or guest email provided', async () => {
      const { getCurrentUser } = await import('@/lib/rbac')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/cart/track', {
        method: 'POST',
        body: JSON.stringify(validCartData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Cart not tracked yet, waiting for email')
      expect(prisma.abandonedCart.create).not.toHaveBeenCalled()
    })

    it('should track cart for authenticated user', async () => {
      const { getCurrentUser } = await import('@/lib/rbac')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'CUSTOMER',
      })

      vi.mocked(prisma.abandonedCart.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.abandonedCart.create).mockResolvedValue({
        id: 'cart-123',
        userId: 'user-123',
        guestEmail: null,
        cartData: validCartData,
        recoveryToken: 'token-123',
        emailSent: false,
        emailSentAt: null,
        recoveredAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const request = new NextRequest('http://localhost/api/cart/track', {
        method: 'POST',
        body: JSON.stringify(validCartData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(prisma.abandonedCart.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          cartData: expect.objectContaining({
            items: validCartData.items,
            totalItems: 2,
            totalPrice: 17.98,
          }),
        }),
      })
    })

    it('should track cart for guest with email', async () => {
      const { getCurrentUser } = await import('@/lib/rbac')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getCurrentUser).mockResolvedValue(null)
      vi.mocked(prisma.abandonedCart.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.abandonedCart.create).mockResolvedValue({
        id: 'cart-123',
        userId: null,
        guestEmail: 'guest@example.com',
        cartData: validCartData,
        recoveryToken: 'token-123',
        emailSent: false,
        emailSentAt: null,
        recoveredAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const request = new NextRequest('http://localhost/api/cart/track', {
        method: 'POST',
        body: JSON.stringify({
          ...validCartData,
          guestEmail: 'guest@example.com',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(prisma.abandonedCart.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: undefined,
          guestEmail: 'guest@example.com',
        }),
      })
    })

    it('should update existing cart if found', async () => {
      const { getCurrentUser } = await import('@/lib/rbac')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'CUSTOMER',
      })

      const existingCart = {
        id: 'cart-123',
        userId: 'user-123',
        guestEmail: null,
        cartData: { items: [], totalItems: 0, totalPrice: 0 },
        recoveryToken: 'token-123',
        emailSent: false,
        emailSentAt: null,
        recoveredAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.abandonedCart.findFirst).mockResolvedValue(existingCart)
      vi.mocked(prisma.abandonedCart.update).mockResolvedValue({
        ...existingCart,
        cartData: validCartData,
      })

      const request = new NextRequest('http://localhost/api/cart/track', {
        method: 'POST',
        body: JSON.stringify(validCartData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(prisma.abandonedCart.update).toHaveBeenCalledWith({
        where: { id: 'cart-123' },
        data: expect.objectContaining({
          cartData: expect.objectContaining({
            items: validCartData.items,
          }),
        }),
      })
    })

    it('should not track empty carts', async () => {
      const { getCurrentUser } = await import('@/lib/rbac')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'CUSTOMER',
      })

      const request = new NextRequest('http://localhost/api/cart/track', {
        method: 'POST',
        body: JSON.stringify({ items: [] }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Empty cart, not tracked')
      expect(prisma.abandonedCart.create).not.toHaveBeenCalled()
    })

    it('should normalize guest email to lowercase', async () => {
      const { getCurrentUser } = await import('@/lib/rbac')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getCurrentUser).mockResolvedValue(null)
      vi.mocked(prisma.abandonedCart.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.abandonedCart.create).mockResolvedValue({
        id: 'cart-123',
        userId: null,
        guestEmail: 'test@example.com',
        cartData: validCartData,
        recoveryToken: 'token-123',
        emailSent: false,
        emailSentAt: null,
        recoveredAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const request = new NextRequest('http://localhost/api/cart/track', {
        method: 'POST',
        body: JSON.stringify({
          ...validCartData,
          guestEmail: 'TEST@EXAMPLE.COM',
        }),
      })

      await POST(request)

      expect(prisma.abandonedCart.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          guestEmail: 'test@example.com',
        }),
      })
    })
  })

  describe('once retail checks out in BigCommerce', () => {
    const retailCart = {
      guestEmail: 'buyer@example.com',
      items: [
        { id: 'p1', name: 'Original Hot', slug: 'original-hot', price: 8, image: '/x.jpg', quantity: 1, sku: 'OH', heatLevel: 'HOT' },
      ],
    }

    const track = (body: unknown, cookie?: string) =>
      POST(
        new NextRequest('http://localhost/api/cart/track', {
          method: 'POST',
          body: JSON.stringify(body),
          headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
        }),
      )

    beforeEach(async () => {
      vi.stubEnv('NEXT_PUBLIC_COMMERCE_BACKEND', 'bigcommerce')
      vi.stubEnv('BIGCOMMERCE_STORE_HASH', 'testhash')
      vi.stubEnv('BIGCOMMERCE_ACCESS_TOKEN', 'test-token')
      vi.stubEnv('BIGCOMMERCE_CLIENT_ID', 'test-client')
      vi.stubEnv('BIGCOMMERCE_CLIENT_SECRET', 'test-secret')
      const { getCurrentUser } = await import('@/lib/rbac')
      vi.mocked(getCurrentUser).mockResolvedValue(null)
      const { prisma } = await import('@/lib/prisma')
      vi.mocked(prisma.abandonedCart.findFirst).mockResolvedValue(null)
    })
    afterEach(() => vi.unstubAllEnvs())

    it('does not track a retail cart, so a BigCommerce buyer is never chased', async () => {
      const { prisma } = await import('@/lib/prisma')
      const res = await track(retailCart)

      expect((await res.json()).message).toBe('Checked out in BigCommerce, not tracked')
      expect(prisma.abandonedCart.create).not.toHaveBeenCalled()
    })

    it('tracks a fundraiser cart and stamps it for this site\'s checkout', async () => {
      const { prisma } = await import('@/lib/prisma')
      await track({ ...retailCart, items: [{ ...retailCart.items[0], fundraiserSlug: 'lincoln-band' }] })

      const created = vi.mocked(prisma.abandonedCart.create).mock.calls[0][0]
      expect(created.data.cartData).toMatchObject({ checkout: 'site' })
      expect((created.data.cartData as { items: Array<{ fundraiserSlug?: string }> }).items[0].fundraiserSlug).toBe('lincoln-band')
    })

    it('tracks a retail cart whose referral turns it into a fundraiser sale', async () => {
      const { resolveFundraiserStore } = await import('@/lib/fundraising/store.server')
      vi.mocked(resolveFundraiserStore).mockResolvedValue({} as Awaited<ReturnType<typeof resolveFundraiserStore>>)
      const { prisma } = await import('@/lib/prisma')

      await track(retailCart, 'fundraiser_referral_code=MAYA-123')

      expect(resolveFundraiserStore).toHaveBeenCalledWith({ referralCode: 'MAYA-123' })
      expect(prisma.abandonedCart.create).toHaveBeenCalled()
    })

    it('does not track when the referral names no open campaign, or the lookup fails', async () => {
      const { resolveFundraiserStore } = await import('@/lib/fundraising/store.server')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(resolveFundraiserStore).mockResolvedValue(null)
      await track(retailCart, 'fundraiser_referral_code=OLD')
      vi.mocked(resolveFundraiserStore).mockRejectedValue(new Error('db down'))
      await track(retailCart, 'fundraiser_referral_code=MAYA-123')

      expect(prisma.abandonedCart.create).not.toHaveBeenCalled()
    })
  })
})
