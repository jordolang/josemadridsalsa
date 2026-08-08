import { prisma } from '@/lib/prisma'

import { getReferralFromCode } from './referral-tracker.server'

/**
 * Server-side half of fundraiser pricing.
 *
 * Kept apart from `pricing.ts` because the rule itself is shared with components that render
 * on the fundraiser pages, and those must not pull Prisma into their import graph.
 */

/**
 * The fundraiser's own prices for a set of products, keyed by product id.
 *
 * Only real overrides are returned — a row with a null price means "sell this at the
 * catalogue price", which is what an absent key already says. Inactive rows are left out
 * too: a fundraiser that has stopped selling something is not quoting a price for it.
 *
 * Resolved from the referral code server-side rather than accepted from the client, for the
 * same reason shipping and discounts are recomputed at checkout.
 */
export async function getFundraiserPriceOverrides(
  referralCode: string | undefined,
  productIds: string[]
): Promise<Map<string, number>> {
  if (!referralCode || productIds.length === 0) return new Map()

  try {
    const referral = await getReferralFromCode(referralCode)
    if (!referral) return new Map()

    const rows = await prisma.fundraiserProduct.findMany({
      where: {
        fundraiserId: referral.fundraiserId,
        productId: { in: productIds },
        isActive: true,
        price: { not: null },
      },
      select: { productId: true, price: true },
    })

    return new Map(rows.map((row) => [row.productId, Number(row.price)]))
  } catch (error) {
    // A failed lookup must not take checkout down. Falling back to catalogue pricing
    // undercharges rather than overcharges, which is the safe direction to fail.
    console.error('[FundraiserPricing] Could not load price overrides:', error)
    return new Map()
  }
}
