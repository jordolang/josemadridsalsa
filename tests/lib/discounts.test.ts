import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateDiscountCode, recordDiscountUsage } from '@/lib/discounts'

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    discountCode: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    discountUsage: {
      create: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback({
      discountUsage: { create: vi.fn() },
      discountCode: { update: vi.fn() },
    })),
  },
}))

describe('Discount Code Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('validateDiscountCode', () => {
    it('should reject invalid discount code', async () => {
      const { prisma } = await import('@/lib/prisma')
      vi.mocked(prisma.discountCode.findUnique).mockResolvedValue(null)

      const result = await validateDiscountCode('INVALID', 100)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid discount code')
    })

    it('should reject inactive discount code', async () => {
      const { prisma } = await import('@/lib/prisma')
      vi.mocked(prisma.discountCode.findUnique).mockResolvedValue({
        id: 'disc-1',
        code: 'TEST10',
        description: 'Test discount',
        type: 'PERCENTAGE',
        value: 10,
        maxUses: null,
        usedCount: 0,
        maxUsesPerUser: null,
        minPurchase: null,
        startsAt: null,
        expiresAt: null,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: null,
        usages: [],
      })

      const result = await validateDiscountCode('TEST10', 100)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('This discount code is no longer active')
    })

    it('should reject expired discount code', async () => {
      const { prisma } = await import('@/lib/prisma')
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)

      vi.mocked(prisma.discountCode.findUnique).mockResolvedValue({
        id: 'disc-1',
        code: 'TEST10',
        description: 'Test discount',
        type: 'PERCENTAGE',
        value: 10,
        maxUses: null,
        usedCount: 0,
        maxUsesPerUser: null,
        minPurchase: null,
        startsAt: null,
        expiresAt: yesterday,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: null,
        usages: [],
      })

      const result = await validateDiscountCode('TEST10', 100)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('This discount code has expired')
    })

    it('should reject if minimum purchase not met', async () => {
      const { prisma } = await import('@/lib/prisma')
      vi.mocked(prisma.discountCode.findUnique).mockResolvedValue({
        id: 'disc-1',
        code: 'TEST10',
        description: 'Test discount',
        type: 'PERCENTAGE',
        value: 10,
        maxUses: null,
        usedCount: 0,
        maxUsesPerUser: null,
        minPurchase: 50,
        startsAt: null,
        expiresAt: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: null,
        usages: [],
      })

      const result = await validateDiscountCode('TEST10', 25)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Minimum purchase of $50.00 required')
    })

    it('should calculate percentage discount correctly', async () => {
      const { prisma } = await import('@/lib/prisma')
      vi.mocked(prisma.discountCode.findUnique).mockResolvedValue({
        id: 'disc-1',
        code: 'TEST10',
        description: 'Test discount',
        type: 'PERCENTAGE',
        value: 10,
        maxUses: null,
        usedCount: 0,
        maxUsesPerUser: null,
        minPurchase: null,
        startsAt: null,
        expiresAt: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: null,
        usages: [],
      })

      const result = await validateDiscountCode('TEST10', 100)

      expect(result.valid).toBe(true)
      expect(result.discountAmount).toBe(10) // 10% of 100
    })

    it('should calculate fixed amount discount correctly', async () => {
      const { prisma } = await import('@/lib/prisma')
      vi.mocked(prisma.discountCode.findUnique).mockResolvedValue({
        id: 'disc-1',
        code: 'SAVE20',
        description: 'Test discount',
        type: 'FIXED_AMOUNT',
        value: 20,
        maxUses: null,
        usedCount: 0,
        maxUsesPerUser: null,
        minPurchase: null,
        startsAt: null,
        expiresAt: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: null,
        usages: [],
      })

      const result = await validateDiscountCode('SAVE20', 100)

      expect(result.valid).toBe(true)
      expect(result.discountAmount).toBe(20)
    })

    it('should not exceed cart total for fixed amount', async () => {
      const { prisma } = await import('@/lib/prisma')
      vi.mocked(prisma.discountCode.findUnique).mockResolvedValue({
        id: 'disc-1',
        code: 'SAVE20',
        description: 'Test discount',
        type: 'FIXED_AMOUNT',
        value: 20,
        maxUses: null,
        usedCount: 0,
        maxUsesPerUser: null,
        minPurchase: null,
        startsAt: null,
        expiresAt: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: null,
        usages: [],
      })

      const result = await validateDiscountCode('SAVE20', 15)

      expect(result.valid).toBe(true)
      expect(result.discountAmount).toBe(15) // Capped at cart total
    })

    it('should reject if max uses reached', async () => {
      const { prisma } = await import('@/lib/prisma')
      vi.mocked(prisma.discountCode.findUnique).mockResolvedValue({
        id: 'disc-1',
        code: 'LIMITED',
        description: 'Test discount',
        type: 'PERCENTAGE',
        value: 10,
        maxUses: 100,
        usedCount: 100,
        maxUsesPerUser: null,
        minPurchase: null,
        startsAt: null,
        expiresAt: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: null,
        usages: [],
      })

      const result = await validateDiscountCode('LIMITED', 100)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('This discount code has reached its usage limit')
    })
  })
})
