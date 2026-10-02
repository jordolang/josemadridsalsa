/**
 * The loyalty reward form contract, shared by the web screen, the desktop
 * shell and the client dialog — so no Prisma import here.
 */
import { z } from 'zod'

export const LOYALTY_TIERS = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'] as const
export type LoyaltyTierName = (typeof LOYALTY_TIERS)[number]

const blankToNull = (value: unknown) =>
  value === '' || value === null || value === undefined ? null : value

/** Accepts form values (strings, "on") as well as typed JSON. */
export const rewardInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name is too long'),
  description: z.string().trim().min(1, 'Description is required').max(500, 'Description is too long'),
  pointsCost: z.coerce
    .number({ message: 'Points cost must be a number' })
    .int('Points cost must be a whole number')
    .min(1, 'Points cost must be at least 1'),
  rewardValue: z.coerce
    .number({ message: 'Discount must be a number' })
    .positive('Discount must be more than $0')
    .max(1000, 'Discount is too large'),
  minimumTier: z.enum(LOYALTY_TIERS, { message: 'Pick a tier' }),
  maxRedemptions: z.preprocess(
    blankToNull,
    z.coerce.number().int('Limit must be a whole number').min(1, 'Limit must be at least 1').nullable(),
  ),
  isActive: z
    .union([z.boolean(), z.string(), z.null()])
    .optional()
    .transform((value) => value === true || value === 'true' || value === 'on'),
})

export type RewardInput = z.output<typeof rewardInputSchema>

/**
 * What a reward gives back, as a share of what the customer spent to earn it.
 * At 10 points per $1, a $5 reward for 500 points returns 10%. The earn rate
 * is passed in (from `POINTS_PER_DOLLAR`) because this file stays client-safe.
 */
export function rewardReturnPercent(pointsCost: number, rewardValue: number, pointsPerDollar: number): number {
  const dollarsSpent = pointsCost / pointsPerDollar
  return dollarsSpent > 0 ? (rewardValue / dollarsSpent) * 100 : 0
}

