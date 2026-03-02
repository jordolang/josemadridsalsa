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
      case 'FREE_SHIPPING':
        // This will be handled separately in checkout
        discountAmount = 0
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
