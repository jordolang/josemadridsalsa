/**
 * Display helpers for the storefront's loyalty surfaces: the public `/rewards` page, the
 * product page and the cart. Pure and synchronous so client components can use them.
 * The earning and tier rules themselves live in `@/lib/loyalty-constants`.
 */
import type { LoyaltyTier } from '@prisma/client'
import { POINTS_PER_DOLLAR, TIER_THRESHOLDS } from '@/lib/loyalty-constants'

export const LOYALTY_TIERS: LoyaltyTier[] = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']

const TIER_LABELS: Record<LoyaltyTier, string> = {
  BRONZE: 'Bronze',
  SILVER: 'Silver',
  GOLD: 'Gold',
  PLATINUM: 'Platinum',
}

export function tierLabel(tier: LoyaltyTier): string {
  return TIER_LABELS[tier]
}

/**
 * Points a merchandise amount earns, using the same rounding as
 * `creditPurchaseLoyaltyPoints` (whole points, rounded down, nothing for zero or less).
 */
export function pointsForAmount(dollars: number): number {
  if (!Number.isFinite(dollars) || dollars <= 0) return 0
  return Math.floor(dollars * POINTS_PER_DOLLAR)
}

/**
 * Whether a reward can still be redeemed. `redeemRewardInTx` refuses a reward once
 * `usedCount` reaches `maxRedemptions`; a null cap means unlimited.
 */
export function hasRedemptionsLeft(reward: { maxRedemptions: number | null; usedCount: number }): boolean {
  return reward.maxRedemptions == null || reward.usedCount < reward.maxRedemptions
}

export function tierForLifetimePoints(lifetimePoints: number): LoyaltyTier {
  for (let i = LOYALTY_TIERS.length - 1; i >= 0; i--) {
    if (lifetimePoints >= TIER_THRESHOLDS[LOYALTY_TIERS[i]]) return LOYALTY_TIERS[i]
  }
  return 'BRONZE'
}

export interface TierProgress {
  tier: LoyaltyTier
  /** Null at the top tier. */
  nextTier: LoyaltyTier | null
  pointsToNextTier: number
  /** 0–100, how far through the current tier band the customer is. */
  percent: number
}

/** Where a customer stands against the tier ladder, from their lifetime points. */
export function tierProgress(lifetimePoints: number): TierProgress {
  const points = Math.max(0, lifetimePoints)
  const tier = tierForLifetimePoints(points)
  const index = LOYALTY_TIERS.indexOf(tier)
  const nextTier = LOYALTY_TIERS[index + 1] ?? null
  if (!nextTier) return { tier, nextTier: null, pointsToNextTier: 0, percent: 100 }

  const floor = TIER_THRESHOLDS[tier]
  const ceiling = TIER_THRESHOLDS[nextTier]
  return {
    tier,
    nextTier,
    pointsToNextTier: ceiling - points,
    percent: Math.floor(((points - floor) / (ceiling - floor)) * 100),
  }
}
