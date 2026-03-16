import prisma from '@/lib/prisma'
import { cookies } from 'next/headers'

const REFERRAL_COOKIE_NAME = 'fundraiser_referral_code'

export interface ReferralInfo {
  participantId: string
  participantName: string
  fundraiserId: string
  fundraiserName: string
  referralCode: string
}

/**
 * Get referral info from cookie (server-side)
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
 * Get referral info from referral code
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

/**
 * Get referral code from cookie (client-side)
 * Use this in client components
 */
export function getReferralCodeFromCookie(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=')
    if (name === REFERRAL_COOKIE_NAME) {
      return decodeURIComponent(value)
    }
  }
  return null
}

/**
 * Clear referral cookie (client-side)
 * Call this after successful order completion if needed
 */
export function clearReferralCookie(): void {
  if (typeof window === 'undefined') {
    return
  }

  document.cookie = `${REFERRAL_COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
}
