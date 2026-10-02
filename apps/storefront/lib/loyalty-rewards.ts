/**
 * Admin management of the loyalty reward catalog.
 *
 * Shared by the web screen (`/admin/settings/loyalty-rewards`) and the desktop
 * shell (`customers.rewards`) so the two cannot disagree about what a valid
 * reward is. Only `DISCOUNT` rewards exist: a redemption issues a fixed-amount
 * discount code, and that is the only reward checkout knows how to honour.
 */
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { RewardInput } from '@/lib/loyalty-rewards-schema'

/** A reward the operator can act on was refused for a reason they can fix. */
export class RewardAdminError extends Error {
  constructor(message: string, readonly field?: string) {
    super(message)
    this.name = 'RewardAdminError'
  }
}

function rewardData(input: RewardInput) {
  return {
    name: input.name,
    description: input.description,
    pointsCost: input.pointsCost,
    rewardType: 'DISCOUNT',
    rewardValue: new Prisma.Decimal(input.rewardValue.toFixed(2)),
    minimumTier: input.minimumTier,
    maxRedemptions: input.maxRedemptions,
    isActive: input.isActive,
  }
}

async function assertCapAboveUsage(id: string, maxRedemptions: number | null) {
  if (maxRedemptions === null) return
  const current = await prisma.loyaltyReward.findUnique({ where: { id }, select: { usedCount: true } })
  if (!current) throw new RewardAdminError('That reward no longer exists.')
  if (maxRedemptions < current.usedCount) {
    throw new RewardAdminError(
      `This reward has already been redeemed ${current.usedCount} times; the limit cannot be lower.`,
      'maxRedemptions',
    )
  }
}

export async function createReward(input: RewardInput) {
  return prisma.loyaltyReward.create({ data: rewardData(input), select: { id: true, name: true } })
}

export async function updateReward(id: string, input: RewardInput) {
  await assertCapAboveUsage(id, input.maxRedemptions)
  try {
    return await prisma.loyaltyReward.update({
      where: { id },
      data: rewardData(input),
      select: { id: true, name: true },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new RewardAdminError('That reward no longer exists.')
    }
    throw error
  }
}

export async function setRewardActive(id: string, isActive: boolean) {
  const { count } = await prisma.loyaltyReward.updateMany({ where: { id }, data: { isActive } })
  if (count === 0) throw new RewardAdminError('That reward no longer exists.')
}

/**
 * Deletes a reward nobody has redeemed. A redeemed one keeps its row, because
 * customers' redemption history and issued codes point at it — switch it off
 * instead.
 */
export async function deleteReward(id: string) {
  const redemptions = await prisma.rewardRedemption.count({ where: { rewardId: id } })
  if (redemptions > 0) {
    throw new RewardAdminError(
      `Customers have redeemed this reward ${redemptions} time(s). Switch it off instead of deleting it.`,
    )
  }
  try {
    const { count } = await prisma.loyaltyReward.deleteMany({ where: { id } })
    if (count === 0) throw new RewardAdminError('That reward no longer exists.')
  } catch (error) {
    // Redeemed between the count and the delete: the foreign key refuses it.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      throw new RewardAdminError('This reward was just redeemed. Switch it off instead of deleting it.')
    }
    throw error
  }
}
