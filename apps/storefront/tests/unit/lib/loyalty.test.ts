/**
 * Loyalty System Tests
 * José Madrid Salsa E-commerce Platform
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getOrCreateLoyaltyAccount,
  calculateTier,
  awardPoints,
  awardPurchasePoints,
  redeemReward,
  createDefaultRewards,
  POINTS_PER_DOLLAR,
  TIER_THRESHOLDS,
  TIER_BENEFITS,
  REFERRAL_POINTS,
  REVIEW_POINTS,
  BIRTHDAY_POINTS,
} from '@/lib/loyalty'
import { prisma } from '@/lib/prisma'

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    loyaltyAccount: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    pointTransaction: {
      create: vi.fn(),
    },
    loyaltyReward: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    rewardRedemption: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

describe('Loyalty System', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Constants', () => {
    it('should have correct points earning rates', () => {
      expect(POINTS_PER_DOLLAR).toBe(10)
      expect(REFERRAL_POINTS).toBe(500)
      expect(REVIEW_POINTS).toBe(50)
      expect(BIRTHDAY_POINTS).toBe(250)
    })

    it('should have correct tier thresholds', () => {
      expect(TIER_THRESHOLDS).toEqual({
        BRONZE: 0,
        SILVER: 500,
        GOLD: 1000,
        PLATINUM: 2500,
      })
    })

    it('should have correct tier benefits', () => {
      expect(TIER_BENEFITS).toEqual({
        BRONZE: 0,
        SILVER: 5,
        GOLD: 10,
        PLATINUM: 15,
      })
    })
  })

  describe('getOrCreateLoyaltyAccount', () => {
    it('should return existing account if found', async () => {
      const mockAccount = {
        id: 'account-1',
        userId: 'user-1',
        pointsBalance: 500,
        lifetimePoints: 1000,
        tier: 'SILVER',
        transactions: [],
      }

      vi.mocked(prisma.loyaltyAccount.findUnique).mockResolvedValue(mockAccount as any)

      const result = await getOrCreateLoyaltyAccount('user-1')

      expect(result).toEqual(mockAccount)
      expect(prisma.loyaltyAccount.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        include: {
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      })
      expect(prisma.loyaltyAccount.create).not.toHaveBeenCalled()
    })

    it('should create new account if not found', async () => {
      const mockNewAccount = {
        id: 'account-2',
        userId: 'user-2',
        pointsBalance: 0,
        lifetimePoints: 0,
        tier: 'BRONZE',
        transactions: [],
      }

      vi.mocked(prisma.loyaltyAccount.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.loyaltyAccount.create).mockResolvedValue(mockNewAccount as any)

      const result = await getOrCreateLoyaltyAccount('user-2')

      expect(result).toEqual(mockNewAccount)
      expect(prisma.loyaltyAccount.create).toHaveBeenCalledWith({
        data: { userId: 'user-2' },
        include: {
          transactions: true,
        },
      })
    })
  })

  describe('calculateTier', () => {
    it('should return BRONZE for points below SILVER threshold', async () => {
      expect(await calculateTier(0)).toBe('BRONZE')
      expect(await calculateTier(100)).toBe('BRONZE')
      expect(await calculateTier(499)).toBe('BRONZE')
    })

    it('should return SILVER for points at or above SILVER threshold', async () => {
      expect(await calculateTier(500)).toBe('SILVER')
      expect(await calculateTier(750)).toBe('SILVER')
      expect(await calculateTier(999)).toBe('SILVER')
    })

    it('should return GOLD for points at or above GOLD threshold', async () => {
      expect(await calculateTier(1000)).toBe('GOLD')
      expect(await calculateTier(1500)).toBe('GOLD')
      expect(await calculateTier(2499)).toBe('GOLD')
    })

    it('should return PLATINUM for points at or above PLATINUM threshold', async () => {
      expect(await calculateTier(2500)).toBe('PLATINUM')
      expect(await calculateTier(5000)).toBe('PLATINUM')
      expect(await calculateTier(10000)).toBe('PLATINUM')
    })
  })

  describe('awardPoints', () => {
    const mockAccount = {
      id: 'account-1',
      userId: 'user-1',
      pointsBalance: 500,
      lifetimePoints: 1000,
      tier: 'SILVER',
      transactions: [],
    }

    beforeEach(() => {
      vi.mocked(prisma.loyaltyAccount.findUnique).mockResolvedValue(mockAccount as any)
    })

    it('should award points and update balance', async () => {
      const mockTransaction = {
        id: 'tx-1',
        accountId: 'account-1',
        type: 'EARNED_PURCHASE',
        points: 100,
        description: 'Test purchase',
        orderId: 'order-1',
      }

      const mockUpdatedAccount = {
        ...mockAccount,
        pointsBalance: 600,
        lifetimePoints: 1100,
        tier: 'GOLD',
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return callback({
          pointTransaction: { create: vi.fn().mockResolvedValue(mockTransaction) },
          loyaltyAccount: { update: vi.fn().mockResolvedValue(mockUpdatedAccount) },
        })
      })

      const result = await awardPoints('user-1', 100, 'EARNED_PURCHASE', 'Test purchase', 'order-1')

      expect(result.success).toBe(true)
      expect(result.account).toEqual(mockUpdatedAccount)
      expect(result.transaction).toEqual(mockTransaction)
    })

    it('should handle negative points (redemptions)', async () => {
      const mockTransaction = {
        id: 'tx-2',
        accountId: 'account-1',
        type: 'REDEEMED_REWARD',
        points: -100,
        description: 'Redeemed reward',
      }

      const mockUpdatedAccount = {
        ...mockAccount,
        pointsBalance: 400,
        lifetimePoints: 1000, // Lifetime points don't decrease
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return callback({
          pointTransaction: { create: vi.fn().mockResolvedValue(mockTransaction) },
          loyaltyAccount: { update: vi.fn().mockResolvedValue(mockUpdatedAccount) },
        })
      })

      const result = await awardPoints('user-1', -100, 'REDEEMED_REWARD', 'Redeemed reward')

      expect(result.success).toBe(true)
      expect(result.account?.lifetimePoints).toBe(1000) // Should not decrease
    })

    it('should detect tier changes', async () => {
      const mockTransaction = {
        id: 'tx-3',
        accountId: 'account-1',
        type: 'EARNED_PURCHASE',
        points: 1500,
        description: 'Large purchase',
      }

      const mockUpdatedAccount = {
        ...mockAccount,
        pointsBalance: 2000,
        lifetimePoints: 2500,
        tier: 'PLATINUM',
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return callback({
          pointTransaction: { create: vi.fn().mockResolvedValue(mockTransaction) },
          loyaltyAccount: { update: vi.fn().mockResolvedValue(mockUpdatedAccount) },
        })
      })

      const result = await awardPoints('user-1', 1500, 'EARNED_PURCHASE', 'Large purchase')

      expect(result.success).toBe(true)
      expect(result.tierChanged).toBe(true)
    })

    it('should handle errors gracefully', async () => {
      vi.mocked(prisma.$transaction).mockRejectedValue(new Error('Database error'))

      const result = await awardPoints('user-1', 100, 'EARNED_PURCHASE', 'Test')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to award points')
    })
  })

  describe('awardPurchasePoints', () => {
    it('should award correct points for purchase amount', async () => {
      const mockAccount = {
        id: 'account-1',
        userId: 'user-1',
        pointsBalance: 0,
        lifetimePoints: 0,
        tier: 'BRONZE',
        transactions: [],
      }

      vi.mocked(prisma.loyaltyAccount.findUnique).mockResolvedValue(mockAccount as any)

      const mockTransaction = {
        id: 'tx-1',
        accountId: 'account-1',
        type: 'EARNED_PURCHASE',
        points: 1000, // $100 * 10 points per dollar
        description: 'Earned 1000 points from order',
        orderId: 'order-1',
      }

      const mockUpdatedAccount = {
        ...mockAccount,
        pointsBalance: 1000,
        lifetimePoints: 1000,
        tier: 'GOLD',
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return callback({
          pointTransaction: { create: vi.fn().mockResolvedValue(mockTransaction) },
          loyaltyAccount: { update: vi.fn().mockResolvedValue(mockUpdatedAccount) },
        })
      })

      const result = await awardPurchasePoints('user-1', 100, 'order-1')

      expect(result.success).toBe(true)
      expect(result.transaction?.points).toBe(1000)
    })

    it('should floor fractional points', async () => {
      const mockAccount = {
        id: 'account-1',
        userId: 'user-1',
        pointsBalance: 0,
        lifetimePoints: 0,
        tier: 'BRONZE',
        transactions: [],
      }

      vi.mocked(prisma.loyaltyAccount.findUnique).mockResolvedValue(mockAccount as any)

      const mockTransaction = {
        id: 'tx-2',
        accountId: 'account-1',
        type: 'EARNED_PURCHASE',
        points: 155, // $15.55 * 10 = 155.5 floored to 155
        description: 'Earned 155 points from order',
        orderId: 'order-2',
      }

      const mockUpdatedAccount = {
        ...mockAccount,
        pointsBalance: 155,
        lifetimePoints: 155,
        tier: 'BRONZE',
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return callback({
          pointTransaction: { create: vi.fn().mockResolvedValue(mockTransaction) },
          loyaltyAccount: { update: vi.fn().mockResolvedValue(mockUpdatedAccount) },
        })
      })

      const result = await awardPurchasePoints('user-1', 15.55, 'order-2')

      expect(result.success).toBe(true)
      expect(result.transaction?.points).toBe(155)
    })
  })

  describe('redeemReward', () => {
    // The rules (tier, balance, cap, code issuance) are covered against a fake transaction in
    // tests/lib/loyalty.test.ts; here only the wrapper's success/refusal mapping is under test.
    const mockReward = {
      id: 'reward-1',
      name: '$10 Off',
      pointsCost: 500,
      rewardType: 'DISCOUNT',
      rewardValue: 10,
      minimumTier: 'BRONZE',
      isActive: true,
      maxRedemptions: null,
    }

    function runWith(tx: Record<string, unknown>) {
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(tx))
    }

    function fakeTx(overrides: Record<string, unknown> = {}) {
      return {
        loyaltyReward: {
          findUnique: vi.fn().mockResolvedValue(mockReward),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        loyaltyAccount: {
          upsert: vi.fn().mockResolvedValue({ id: 'account-1', tier: 'SILVER' }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        pointTransaction: { create: vi.fn() },
        discountCode: { create: vi.fn() },
        rewardRedemption: {
          create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'redemption-1', ...data })),
        },
        ...overrides,
      }
    }

    it('returns the redemption with its discount code', async () => {
      runWith(fakeTx())

      const result = await redeemReward('user-1', 'reward-1')

      expect(result.success).toBe(true)
      expect(result.redemption?.discountCode).toMatch(/^REWARD-/)
    })

    it('reports a business-rule refusal as the error message', async () => {
      runWith(
        fakeTx({
          loyaltyReward: { findUnique: vi.fn().mockResolvedValue(null), updateMany: vi.fn() },
        }),
      )

      const result = await redeemReward('user-1', 'reward-1')

      expect(result).toEqual({ success: false, error: 'Reward not available' })
    })

    it('hides unexpected database errors behind a generic message', async () => {
      vi.mocked(prisma.$transaction).mockRejectedValue(new Error('connection reset'))

      const result = await redeemReward('user-1', 'reward-1')

      expect(result).toEqual({ success: false, error: 'Failed to redeem reward' })
    })
  })

  describe('createDefaultRewards', () => {
    it('should create default rewards if they do not exist', async () => {
      vi.mocked(prisma.loyaltyReward.findFirst).mockResolvedValue(null)
      const createSpy = vi.mocked(prisma.loyaltyReward.create).mockResolvedValue({} as any)

      await createDefaultRewards()

      // Three, not four: the "Free Shipping" reward was removed along with free shipping.
      expect(createSpy).toHaveBeenCalledTimes(3)
      expect(createSpy).toHaveBeenCalledWith({
        data: {
          name: '$5 Off',
          description: 'Get $5 off your next order',
          pointsCost: 500,
          rewardType: 'DISCOUNT',
          rewardValue: 5,
          minimumTier: 'BRONZE',
        },
      })
      expect(createSpy).toHaveBeenCalledWith({
        data: {
          name: '$10 Off',
          description: 'Get $10 off your next order',
          pointsCost: 1000,
          rewardType: 'DISCOUNT',
          rewardValue: 10,
          minimumTier: 'SILVER',
        },
      })
      // No free-shipping reward: the business charges shipping on every order.
      expect(createSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ rewardType: 'FREE_SHIPPING' }),
        })
      )
      expect(createSpy).toHaveBeenCalledWith({
        data: {
          name: '$25 Off',
          description: 'Get $25 off your next order',
          pointsCost: 2500,
          rewardType: 'DISCOUNT',
          rewardValue: 25,
          minimumTier: 'GOLD',
        },
      })
    })

    it('should skip creating rewards that already exist', async () => {
      vi.mocked(prisma.loyaltyReward.findFirst).mockResolvedValue({
        id: 'existing-reward',
        name: '$5 Off',
      } as any)
      const createSpy = vi.mocked(prisma.loyaltyReward.create)

      await createDefaultRewards()

      expect(createSpy).not.toHaveBeenCalled()
    })
  })
})
