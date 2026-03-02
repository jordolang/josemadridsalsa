import { prisma } from '@/lib/prisma'

// Points earning rates
export const POINTS_PER_DOLLAR = 10 // 10 points per $1 spent
export const REFERRAL_POINTS = 500
export const REVIEW_POINTS = 50
export const BIRTHDAY_POINTS = 250

// Tier thresholds
export const TIER_THRESHOLDS = {
  BRONZE: 0,
  SILVER: 500,
  GOLD: 1000,
  PLATINUM: 2500,
}

// Tier benefits (discount percentages)
export const TIER_BENEFITS = {
  BRONZE: 0,
  SILVER: 5,
  GOLD: 10,
  PLATINUM: 15,
}

export async function getOrCreateLoyaltyAccount(userId: string) {
  let account = await prisma.loyaltyAccount.findUnique({
    where: { userId },
    include: {
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  })

  if (!account) {
    account = await prisma.loyaltyAccount.create({
      data: { userId },
      include: {
        transactions: true,
      },
    })
  }

  return account
}

export async function calculateTier(lifetimePoints: number) {
  if (lifetimePoints >= TIER_THRESHOLDS.PLATINUM) return 'PLATINUM'
  if (lifetimePoints >= TIER_THRESHOLDS.GOLD) return 'GOLD'
  if (lifetimePoints >= TIER_THRESHOLDS.SILVER) return 'SILVER'
  return 'BRONZE'
}

export async function awardPoints(
  userId: string,
  points: number,
  type: string,
  description: string,
  orderId?: string
) {
  try {
    const account = await getOrCreateLoyaltyAccount(userId)

    const result = await prisma.$transaction(async (tx) => {
      // Create transaction
      const transaction = await tx.pointTransaction.create({
        data: {
          accountId: account.id,
          type: type as any,
          points,
          description,
          orderId,
        },
      })

      // Update balance and lifetime points
      const newBalance = account.pointsBalance + points
      const newLifetimePoints = account.lifetimePoints + (points > 0 ? points : 0)

      // Calculate new tier
      const newTier = await calculateTier(newLifetimePoints)
      const tierChanged = newTier !== account.tier

      const updatedAccount = await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          pointsBalance: newBalance,
          lifetimePoints: newLifetimePoints,
          tier: newTier as any,
          ...(tierChanged && { tierUpdatedAt: new Date() }),
        },
      })

      return { transaction, account: updatedAccount, tierChanged }
    })

    return { success: true, ...result }
  } catch (error) {
    console.error('Award points error:', error)
    return { success: false, error: 'Failed to award points' }
  }
}

export async function awardPurchasePoints(userId: string, orderTotal: number, orderId: string) {
  const points = Math.floor(orderTotal * POINTS_PER_DOLLAR)
  return awardPoints(
    userId,
    points,
    'EARNED_PURCHASE',
    `Earned ${points} points from order`,
    orderId
  )
}

export async function redeemReward(
  userId: string,
  rewardId: string
): Promise<{ success: boolean; error?: string; redemption?: any }> {
  try {
    const account = await getOrCreateLoyaltyAccount(userId)

    const reward = await prisma.loyaltyReward.findUnique({
      where: { id: rewardId },
    })

    if (!reward || !reward.isActive) {
      return { success: false, error: 'Reward not available' }
    }

    // Check tier requirement
    const tierOrder = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']
    const userTierLevel = tierOrder.indexOf(account.tier)
    const requiredTierLevel = tierOrder.indexOf(reward.minimumTier)

    if (userTierLevel < requiredTierLevel) {
      return { success: false, error: `Requires ${reward.minimumTier} tier or higher` }
    }

    // Check points balance
    if (account.pointsBalance < reward.pointsCost) {
      return { success: false, error: 'Insufficient points' }
    }

    // Check redemption limit
    if (reward.maxRedemptions && reward.usedCount >= reward.maxRedemptions) {
      return { success: false, error: 'Reward redemption limit reached' }
    }

    // Create redemption
    const result = await prisma.$transaction(async (tx) => {
      const redemption = await tx.rewardRedemption.create({
        data: {
          accountId: account.id,
          rewardId: reward.id,
          pointsSpent: reward.pointsCost,
          status: 'ACTIVE',
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        },
      })

      // Deduct points
      await awardPoints(
        userId,
        -reward.pointsCost,
        'REDEEMED_REWARD',
        `Redeemed: ${reward.name}`
      )

      // Increment usage count
      await tx.loyaltyReward.update({
        where: { id: reward.id },
        data: { usedCount: { increment: 1 } },
      })

      return redemption
    })

    return { success: true, redemption: result }
  } catch (error) {
    console.error('Redeem reward error:', error)
    return { success: false, error: 'Failed to redeem reward' }
  }
}

export async function createDefaultRewards() {
  const rewards = [
    {
      name: '$5 Off',
      description: 'Get $5 off your next order',
      pointsCost: 500,
      rewardType: 'DISCOUNT',
      rewardValue: 5,
      minimumTier: 'BRONZE' as any,
    },
    {
      name: '$10 Off',
      description: 'Get $10 off your next order',
      pointsCost: 1000,
      rewardType: 'DISCOUNT',
      rewardValue: 10,
      minimumTier: 'SILVER' as any,
    },
    {
      name: 'Free Shipping',
      description: 'Free shipping on your next order',
      pointsCost: 300,
      rewardType: 'FREE_SHIPPING',
      minimumTier: 'BRONZE' as any,
    },
    {
      name: '$25 Off',
      description: 'Get $25 off your next order',
      pointsCost: 2500,
      rewardType: 'DISCOUNT',
      rewardValue: 25,
      minimumTier: 'GOLD' as any,
    },
  ]

  for (const reward of rewards) {
    const existing = await prisma.loyaltyReward.findFirst({
      where: { name: reward.name },
    })

    if (!existing) {
      await prisma.loyaltyReward.create({
        data: reward,
      })
    }
  }

  console.log('Default loyalty rewards created')
}
