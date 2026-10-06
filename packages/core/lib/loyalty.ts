import { randomBytes } from 'crypto'
import type { LoyaltyTier, Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { emitDomainEvent } from '@/lib/domain-events/emit'

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

export interface PurchasePointsCredit {
  awarded: boolean
  /** Zero unless this call is the one that awarded. */
  points: number
  reason?: 'guest-order' | 'no-points' | 'already-awarded'
}

/**
 * Award purchase loyalty points for an order that was just marked paid. Exactly once.
 *
 * The same six paths that credit fundraiser commission mark an order paid — three completion
 * routes and three payment webhooks — and each pair races the other. Points are earned from
 * whichever wins, so the award claims `Order.loyaltyPointsAwardedAt` before it touches the
 * loyalty account, exactly as `creditFundraiserCommission` claims `commissionCreditedAt`. The
 * claim is a conditional `updateMany`, not a read-then-write: two callers arriving together
 * both see a null column, but only one update matches, and the loser stops with a count of
 * zero. Points then accrue by increment, so a concurrent redemption cannot be overwritten.
 *
 * Points are earned on the merchandise actually paid for — `subtotal - discountAmount`,
 * excluding tax and shipping — mirroring the base the fundraiser commission is figured on.
 *
 * Only registered customers earn: the loyalty account is keyed by `User`, so a guest order
 * (`userId` null) earns nothing and creates no account.
 *
 * Call inside the same transaction that marks the order paid, on that transaction's client. A
 * rolled-back payment must take its points with it. The account is upserted on that client too
 * — never through `getOrCreateLoyaltyAccount`, which uses the singleton and would not roll back.
 */
export async function creditPurchaseLoyaltyPoints(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<PurchasePointsCredit> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      userId: true,
      subtotal: true,
      discountAmount: true,
      loyaltyPointsAwardedAt: true,
    },
  })

  if (!order?.userId) {
    return { awarded: false, points: 0, reason: 'guest-order' }
  }

  if (order.loyaltyPointsAwardedAt) {
    return { awarded: false, points: 0, reason: 'already-awarded' }
  }

  const spent = Number(order.subtotal) - Number(order.discountAmount)
  const points = Math.floor(spent * POINTS_PER_DOLLAR)

  // A fully discounted order buys nothing and earns nothing; skip before claiming so it does
  // not leave a zero-point transaction behind.
  if (points <= 0) {
    return { awarded: false, points: 0, reason: 'no-points' }
  }

  // Claim the order in one write. Only the caller whose update matches a still-null column
  // proceeds, which is what makes this safe to run from a webhook and a completion route at
  // once.
  const claim = await tx.order.updateMany({
    where: { id: orderId, loyaltyPointsAwardedAt: null },
    data: { loyaltyPointsAwardedAt: new Date() },
  })

  if (claim.count === 0) {
    return { awarded: false, points: 0, reason: 'already-awarded' }
  }

  // Upsert on the transaction client so the account is created and credited atomically with the
  // claim, and rolls back with a failed payment. The unique `userId` makes this race-safe.
  const account = await tx.loyaltyAccount.upsert({
    where: { userId: order.userId },
    create: { userId: order.userId },
    update: {},
  })

  await tx.pointTransaction.create({
    data: {
      accountId: account.id,
      type: 'EARNED_PURCHASE',
      points,
      description: `Earned ${points} points from order`,
      orderId,
    },
  })

  const newLifetimePoints = account.lifetimePoints + points
  const newTier = (await calculateTier(newLifetimePoints)) as LoyaltyTier
  const tierChanged = newTier !== account.tier

  await tx.loyaltyAccount.update({
    where: { id: account.id },
    data: {
      pointsBalance: { increment: points },
      lifetimePoints: { increment: points },
      tier: newTier,
      ...(tierChanged && { tierUpdatedAt: new Date() }),
    },
  })

  // Recorded here, behind the claim, so a payment completed on two racing paths earns — and
  // announces — its points exactly once. Keyed on the order: it is the fact that earned them.
  await emitDomainEvent(
    {
      type: 'loyalty.points_earned',
      entityType: 'order',
      entityId: orderId,
      payload: { points, pointsBalance: account.pointsBalance + points, tier: newTier },
    },
    tx
  )
  // Tiers only climb on an earn (lifetime points never fall), so a change here is an upgrade.
  if (tierChanged) {
    await emitDomainEvent(
      {
        type: 'loyalty.tier_upgraded',
        entityType: 'order',
        entityId: orderId,
        payload: { tier: newTier, previousTier: account.tier },
      },
      tx
    )
  }

  return { awarded: true, points }
}

const REDEMPTION_TTL_MS = 90 * 24 * 60 * 60 * 1000
const TIER_ORDER = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']

class RedemptionError extends Error {}

/**
 * Spends points on a reward inside one transaction and issues the single-use discount code
 * the customer actually enters at checkout. Every guard is a conditional write, so two
 * concurrent redemptions cannot overspend the balance or the reward's redemption cap; any
 * failure rolls back the whole redemption.
 */
export async function redeemRewardInTx(
  tx: Prisma.TransactionClient,
  userId: string,
  rewardId: string
) {
  const reward = await tx.loyaltyReward.findUnique({ where: { id: rewardId } })
  const value = reward?.rewardValue ? Number(reward.rewardValue) : 0
  // DISCOUNT is the only reward type checkout can honour (a fixed-amount code).
  if (!reward || !reward.isActive || reward.rewardType !== 'DISCOUNT' || value <= 0) {
    throw new RedemptionError('Reward not available')
  }

  const account = await tx.loyaltyAccount.upsert({
    where: { userId },
    create: { userId },
    update: {},
  })

  if (TIER_ORDER.indexOf(account.tier) < TIER_ORDER.indexOf(reward.minimumTier)) {
    throw new RedemptionError(`Requires ${reward.minimumTier} tier or higher`)
  }

  const capacity = await tx.loyaltyReward.updateMany({
    where: {
      id: reward.id,
      ...(reward.maxRedemptions != null && { usedCount: { lt: reward.maxRedemptions } }),
    },
    data: { usedCount: { increment: 1 } },
  })
  if (capacity.count === 0) {
    throw new RedemptionError('Reward redemption limit reached')
  }

  const debit = await tx.loyaltyAccount.updateMany({
    where: { id: account.id, pointsBalance: { gte: reward.pointsCost } },
    data: { pointsBalance: { decrement: reward.pointsCost } },
  })
  if (debit.count === 0) {
    throw new RedemptionError('Insufficient points')
  }

  await tx.pointTransaction.create({
    data: {
      accountId: account.id,
      type: 'REDEEMED_REWARD',
      points: -reward.pointsCost,
      description: `Redeemed: ${reward.name}`,
    },
  })

  const expiresAt = new Date(Date.now() + REDEMPTION_TTL_MS)
  const code = `REWARD-${randomBytes(5).toString('hex').toUpperCase()}`
  await tx.discountCode.create({
    data: {
      code,
      description: `Loyalty reward: ${reward.name}`,
      type: 'FIXED_AMOUNT',
      value,
      maxUses: 1,
      maxUsesPerUser: 1,
      expiresAt,
      isActive: true,
    },
  })

  return tx.rewardRedemption.create({
    data: {
      accountId: account.id,
      rewardId: reward.id,
      pointsSpent: reward.pointsCost,
      status: 'ACTIVE',
      discountCode: code,
      expiresAt,
    },
  })
}

/**
 * Redeems a reward for the user if they meet the requirements.
 * @returns The redemption (including its `discountCode`) or the reason it was refused.
 */
export async function redeemReward(
  userId: string,
  rewardId: string
): Promise<{ success: boolean; error?: string; redemption?: Awaited<ReturnType<typeof redeemRewardInTx>> }> {
  try {
    const redemption = await prisma.$transaction((tx) => redeemRewardInTx(tx, userId, rewardId))
    return { success: true, redemption }
  } catch (error) {
    if (error instanceof RedemptionError) {
      return { success: false, error: error.message }
    }
    console.error('Redeem reward error:', error)
    return { success: false, error: 'Failed to redeem reward' }
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
