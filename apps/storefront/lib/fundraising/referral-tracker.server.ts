import prisma from '@/lib/prisma'
import { cookies } from 'next/headers'
import type { ReferralInfo } from './referral-tracker.client'

export type { ReferralInfo }

export const REFERRAL_COOKIE_NAME = 'fundraiser_referral_code'

/**
 * Get referral info from cookie (server-side only)
 * Returns null if cookie doesn't exist or participant is not found/active
 */
export async function getReferralFromCookie(): Promise<ReferralInfo | null> {
  try {
    const cookieStore = await cookies()
    const referralCode = cookieStore.get(REFERRAL_COOKIE_NAME)?.value

    if (!referralCode) {
      return null
    }

    return await getReferralFromCode(referralCode)
  } catch (error) {
    console.error('[ReferralTracker] Error reading cookie:', error)
    return null
  }
}

/**
 * Get referral info from referral code (server-side only)
 * Returns null if participant is not found or not active
 */
export async function getReferralFromCode(
  referralCode: string
): Promise<ReferralInfo | null> {
  try {
    const participant = await prisma.fundraiserParticipant.findUnique({
      where: { referralCode },
      include: {
        fundraiser: {
          select: {
            id: true,
            name: true,
            isActive: true,
            status: true,
          },
        },
      },
    })

    // Validate participant exists and is active
    if (!participant || participant.status !== 'ACTIVE') {
      return null
    }

    // Validate fundraiser is active
    if (!participant.fundraiser.isActive) {
      return null
    }

    return {
      participantId: participant.id,
      participantName: participant.name,
      fundraiserId: participant.fundraiser.id,
      fundraiserName: participant.fundraiser.name,
      referralCode: participant.referralCode,
    }
  } catch (error) {
    console.error('[ReferralTracker] Error looking up participant:', error)
    return null
  }
}
