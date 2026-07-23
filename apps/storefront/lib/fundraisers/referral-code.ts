import { prisma } from '@/lib/prisma'

/**
 * Generates a fundraiser participant referral code.
 * Format: FR-XXXX-XXXX (8 alphanumeric characters).
 */
export function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const part = () =>
    Array.from({ length: 4 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join('')
  return `FR-${part()}-${part()}`
}

/**
 * Generates a referral code that doesn't yet exist in the database, falling back
 * to a timestamped code if it can't find a free one after several tries.
 */
export async function generateUniqueReferralCode(): Promise<string> {
  for (let attempts = 0; attempts < 10; attempts++) {
    const code = generateReferralCode()
    const existing = await prisma.fundraiserParticipant.findUnique({
      where: { referralCode: code },
    })
    if (!existing) return code
  }

  const timestamp = Date.now().toString(36).toUpperCase().slice(-4)
  return `FR-${timestamp}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
}
