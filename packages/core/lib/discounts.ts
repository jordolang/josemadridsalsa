import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export interface DiscountValidationResult {
  valid: boolean
  error?: string
  discountAmount?: number
  discountCode?: {
    id: string
    code: string
    type: string
    value: number
    description: string | null
  }
}

/**
 * Validate a discount code against the current cart.
 *
 * Checks the code exists and is active, within its validity window,
 * above any minimum purchase requirement, and within global and
 * per-user usage limits.
 *
 * @param {string} code - The discount code string (case-insensitive).
 * @param {number} cartTotal - The pre-discount cart total in dollars.
 * @param {string} [userId] - The authenticated user's ID for per-user limit checks.
 * @returns {Promise<DiscountValidationResult>} Validation outcome, discount amount, and code metadata.
 */
export async function validateDiscountCode(
  code: string,
  cartTotal: number,
  userId?: string
): Promise<DiscountValidationResult> {
  try {
    // Find the discount code
    const discountCode = await prisma.discountCode.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        usages: userId
          ? {
              where: { userId },
            }
          : false,
      },
    })

    if (!discountCode) {
      return { valid: false, error: 'Invalid discount code' }
    }

    // Check if active
    if (!discountCode.isActive) {
      return { valid: false, error: 'This discount code is no longer active' }
    }

    // Check start date
    if (discountCode.startsAt && new Date() < discountCode.startsAt) {
      return { valid: false, error: 'This discount code is not yet valid' }
    }

    // Check expiration
    if (discountCode.expiresAt && new Date() > discountCode.expiresAt) {
      return { valid: false, error: 'This discount code has expired' }
    }

    // Check minimum purchase
    if (discountCode.minPurchase && cartTotal < Number(discountCode.minPurchase)) {
      return {
        valid: false,
        error: `Minimum purchase of $${Number(discountCode.minPurchase).toFixed(2)} required`,
      }
    }

    // Check max uses
    if (discountCode.maxUses && discountCode.usedCount >= discountCode.maxUses) {
      return { valid: false, error: 'This discount code has reached its usage limit' }
    }

    // Check max uses per user
    if (userId && discountCode.maxUsesPerUser) {
      const userUsageCount = Array.isArray(discountCode.usages)
        ? discountCode.usages.length
        : 0

      if (userUsageCount >= discountCode.maxUsesPerUser) {
        return {
          valid: false,
          error: 'You have already used this discount code the maximum number of times',
        }
      }
    }

    // Calculate discount amount
    let discountAmount = 0

    switch (discountCode.type) {
      case 'PERCENTAGE':
        discountAmount = (cartTotal * Number(discountCode.value)) / 100
        break
      case 'FIXED_AMOUNT':
        discountAmount = Math.min(Number(discountCode.value), cartTotal)
        break
    }

    return {
      valid: true,
      discountAmount,
      discountCode: {
        id: discountCode.id,
        code: discountCode.code,
        type: discountCode.type,
        value: Number(discountCode.value),
        description: discountCode.description,
      },
    }
  } catch (error) {
    console.error('Error validating discount code:', error)
    return { valid: false, error: 'Failed to validate discount code' }
  }
}

/**
 * Record that a discount code was used on a completed order.
 *
 * Atomically creates a {@link DiscountUsage} record and increments
 * the code's {@code usedCount} counter in a single database transaction.
 *
 * @param {string} discountCodeId - The ID of the discount code applied.
 * @param {string} orderId - The ID of the order the code was applied to.
 * @param {number} discountAmount - The dollar amount discounted.
 * @param {number} orderTotal - The final order total after discount.
 * @param {string} [userId] - The user ID who used the code, if authenticated.
 * @returns {Promise<{ success: boolean; error?: string }>} Result of the operation.
 */
export async function recordDiscountUsage(
  discountCodeId: string,
  orderId: string,
  discountAmount: number,
  orderTotal: number,
  userId?: string
) {
  try {
    await prisma.$transaction(async (tx) => {
      // Record the usage
      await tx.discountUsage.create({
        data: {
          discountCodeId,
          orderId,
          userId,
          discountAmount,
          orderTotal,
        },
      })

      // Increment usage count
      await tx.discountCode.update({
        where: { id: discountCodeId },
        data: {
          usedCount: {
            increment: 1,
          },
        },
      })
    })

    return { success: true }
  } catch (error) {
    console.error('Error recording discount usage:', error)
    return { success: false, error: 'Failed to record discount usage' }
  }
}

/**
 * Seed the database with default discount codes.
 *
 * Creates (or no-ops if already present) the following codes:
 * - **COMEBACK10** — 10% off, for abandoned cart recovery (max 3 uses/user).
 * - **WELCOME15** — 15% off, for new customers with a $25 minimum order (max 1 use/user).
 *
 * Safe to call repeatedly; uses upsert so existing codes are not overwritten.
 *
 * @returns {Promise<{ success: boolean; codes?: object[]; error?: string }>} Result and created code records.
 */
export async function createDefaultDiscountCodes() {
  try {
    // Create COMEBACK10 code for abandoned cart recovery
    const comeback10 = await prisma.discountCode.upsert({
      where: { code: 'COMEBACK10' },
      update: {},
      create: {
        code: 'COMEBACK10',
        description: 'Abandoned cart recovery - 10% off',
        type: 'PERCENTAGE',
        value: 10,
        isActive: true,
        maxUsesPerUser: 3, // Allow customers to use it up to 3 times
      },
    })

    // Create WELCOME15 code for new customers
    const welcome15 = await prisma.discountCode.upsert({
      where: { code: 'WELCOME15' },
      update: {},
      create: {
        code: 'WELCOME15',
        description: 'New customer welcome discount - 15% off',
        type: 'PERCENTAGE',
        value: 15,
        isActive: true,
        maxUsesPerUser: 1,
        minPurchase: 25,
      },
    })

    console.log('Default discount codes created:', {
      comeback10: comeback10.code,
      welcome15: welcome15.code,
    })

    return { success: true, codes: [comeback10, welcome15] }
  } catch (error) {
    console.error('Error creating default discount codes:', error)
    return { success: false, error: 'Failed to create default codes' }
  }
}
