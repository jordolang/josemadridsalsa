/**
 * Loyalty program endpoints.
 * All loyalty endpoints require authentication.
 */

import { authGet, authPost } from './client';
import type { LoyaltyAccount, LoyaltyReward } from './types';

/**
 * Fetch the authenticated user's loyalty account.
 *
 * @returns Loyalty account with points balance, tier, transaction history, and rewards
 * @throws {ApiError} With status 401 if not authenticated
 */
export async function getLoyaltyAccount(): Promise<{ data: LoyaltyAccount }> {
  return authGet<{ data: LoyaltyAccount }>('/api/loyalty');
}

/**
 * Fetch available loyalty rewards filtered by the user's tier.
 *
 * @returns Array of redeemable rewards with point costs and tier requirements
 */
export async function getLoyaltyRewards(): Promise<LoyaltyReward[]> {
  return authGet<LoyaltyReward[]>('/api/loyalty/rewards');
}

/**
 * Redeem a loyalty reward by spending points.
 *
 * @param rewardId - The reward ID to redeem
 * @returns Redemption confirmation (may include a discount code)
 * @throws {ApiError} With status 400 if insufficient points or tier too low
 */
export async function redeemReward(rewardId: string): Promise<unknown> {
  return authPost('/api/loyalty/redeem', { rewardId });
}
