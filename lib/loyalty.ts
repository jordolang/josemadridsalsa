import { prisma } from '@/lib/prisma'

/**
 * Points earned per dollar spent.
 * @constant
 * @type {number}
 */
export const POINTS_PER_DOLLAR = 10; // 10 points per $1 spent

/**
 * Points awarded for referrals.
 * @constant
 * @type {number}
 */
export const REFERRAL_POINTS = 500;

/**
 * Points awarded for writing a review.
 * @constant
 * @type {number}
 */
export const REVIEW_POINTS = 50;

/**
 * Points awarded for birthdays.
 * @constant
 * @type {number}
 */
export const BIRTHDAY_POINTS = 250;

/**
 * Thresholds for loyalty tiers based on lifetime points.
 * @constant
 * @type {Object}
 * @property {number} BRONZE - Minimum points for Bronze tier.
 * @property {number} SILVER - Minimum points for Silver tier.
 * @property {number} GOLD - Minimum points for Gold tier.
 * @property {number} PLATINUM - Minimum points for Platinum tier.
 */
export const TIER_THRESHOLDS = {
  BRONZE: 0,
  SILVER: 500,
  GOLD: 1000,
  PLATINUM: 2500,
};

/**
 * Discount benefits for each loyalty tier.
 * @constant
 * @type {Object}
 * @property {number} BRONZE - Discount percentage for Bronze tier.
 * @property {number} SILVER - Discount percentage for Silver tier.
 * @property {number} GOLD - Discount percentage for Gold tier.
 * @property {number} PLATINUM - Discount percentage for Platinum tier.
 */
export const TIER_BENEFITS = {
  BRONZE: 0,
  SILVER: 5,
  GOLD: 10,
  PLATINUM: 15,
};

/**
 * Retrieves or creates a loyalty account for the given user ID, including recent transactions.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<Object>} The loyalty account object, including recent transactions.
 * @throws {Error} If there's an issue with database operations.
 */
export async function getOrCreateLoyaltyAccount(userId: string) {
  let account = await prisma.loyaltyAccount.findUnique({
    where: { userId },
    include: {
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!account) {
    account = await prisma.loyaltyAccount.create({
      data: { userId },
      include: {
        transactions: true,
      },
    });
  }

  return account;
}

/**
 * Calculates the loyalty tier based on lifetime points.
 * @param {number} lifetimePoints - The total lifetime points of the user.
 * @returns {string} The loyalty tier ('BRONZE', 'SILVER', 'GOLD', or 'PLATINUM').
 */
export async function calculateTier(lifetimePoints: number) {
  if (lifetimePoints >= TIER_THRESHOLDS.PLATINUM) return 'PLATINUM';
  if (lifetimePoints >= TIER_THRESHOLDS.GOLD) return 'GOLD';
  if (lifetimePoints >= TIER_THRESHOLDS.SILVER) return 'SILVER';
  return 'BRONZE';
}

/**
 * Awards points to a user's loyalty account and updates their tier if necessary.
 * @param {string} userId - The ID of the user.
 * @param {number} points - The number of points to award (positive for earning, negative for redemption).
 * @param {string} type - The type of points transaction (e.g., 'EARNED_PURCHASE').
 * @param {string} description - A description of the transaction.
 * @param {string} [orderId] - Optional order ID associated with the transaction.
 * @returns {Promise<{ success: boolean; transaction?: Object; account?: Object; tierChanged?: boolean; error?: string }>} An object indicating success and relevant details.
 * @throws {Error} If there's an issue with database operations.
 */
export async function awardPoints(
  userId: string,
  points: number,
  type: string,
  description: string,
  orderId?: string
) {
  try {
    const account = await getOrCreateLoyaltyAccount(userId);

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
      });

      // Update balance and lifetime points
      const newBalance = account.pointsBalance + points;
      const newLifetimePoints = account.lifetimePoints + (points > 0 ? points : 0);

      // Calculate new tier
      const newTier = await calculateTier(newLifetimePoints);
      const tierChanged = newTier !== account.tier;

      const updatedAccount = await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          pointsBalance: newBalance,
          lifetimePoints: newLifetimePoints,
          tier: newTier as any,
          ...(tierChanged && { tierUpdatedAt: new Date() }),
        },
      });

      return { transaction, account: updatedAccount, tierChanged };
    });

    return { success: true, ...result };
  } catch (error) {
    console.error('Award points error:', error);
    return { success: false, error: 'Failed to award points' };
  }
}

/**
 * Awards points based on a purchase amount.
 * @param {string} userId - The ID of the user.
 * @param {number} orderTotal - The total amount of the order.
 * @param {string} orderId - The ID of the order.
 * @returns {Promise<Object>} The result from awardPoints.
 */
export async function awardPurchasePoints(userId: string, orderTotal: number, orderId: string) {
  const points = Math.floor(orderTotal * POINTS_PER_DOLLAR);
  return awardPoints(
    userId,
    points,
    'EARNED_PURCHASE',
    `Earned ${points} points from order`,
    orderId
  );
}

/**
 * Redeems a reward for the user if they meet the requirements.
 * @param {string} userId - The ID of the user.
 * @param {string} rewardId - The ID of the reward to redeem.
 * @returns {Promise<{ success: boolean; error?: string; redemption?: Object }>} An object indicating success and redemption details.
 * @throws {Error} If there's an issue with database operations.
 */
export async function redeemReward(
  userId: string,
  rewardId: string
): Promise<{ success: boolean; error?: string; redemption?: any }> {
  try {
    const account = await getOrCreateLoyaltyAccount(userId);

    const reward = await prisma.loyaltyReward.findUnique({
      where: { id: rewardId },
    });

    if (!reward || !reward.isActive) {
      return { success: false, error: 'Reward not available' };
    }

    // Check tier requirement
    const tierOrder = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
    const userTierLevel = tierOrder.indexOf(account.tier);
    const requiredTierLevel = tierOrder.indexOf(reward.minimumTier);

    if (userTierLevel < requiredTierLevel) {
      return { success: false, error: `Requires ${reward.minimumTier} tier or higher` };
    }

    // Check points balance
    if (account.pointsBalance < reward.pointsCost) {
      return { success: false, error: 'Insufficient points' };
    }

    // Check redemption limit
    if (reward.maxRedemptions && reward.usedCount >= reward.maxRedemptions) {
      return { success: false, error: 'Reward redemption limit reached' };
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
      });

      // Deduct points
      await awardPoints(
        userId,
        -reward.pointsCost,
        'REDEEMED_REWARD',
        `Redeemed: ${reward.name}`
      );

      // Increment usage count
      await tx.loyaltyReward.update({
        where: { id: reward.id },
        data: { usedCount: { increment: 1 } },
      });

      return redemption;
    });

    return { success: true, redemption: result };
  } catch (error) {
    console.error('Redeem reward error:', error);
    return { success: false, error: 'Failed to redeem reward' };
  }
}

/**
 * Creates default loyalty rewards if they don't exist.
 */
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
  ];

  for (const reward of rewards) {
    const existing = await prisma.loyaltyReward.findFirst({
      where: { name: reward.name },
    });

    if (!existing) {
      await prisma.loyaltyReward.create({
        data: reward,
      });
    }
  }

  console.log('Default loyalty rewards created');
}
