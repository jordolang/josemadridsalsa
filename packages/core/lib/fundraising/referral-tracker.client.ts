const REFERRAL_COOKIE_NAME = 'fundraiser_referral_code'

export interface ReferralInfo {
  participantId: string
  participantName: string
  fundraiserId: string
  fundraiserName: string
  referralCode: string
}

/**
 * Get referral code from cookie (client-side safe)
 * Use this in client components / 'use client' files
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
 * Set referral cookie (client-side safe)
 */
export function setReferralCookie(code: string): void {
  if (typeof window === 'undefined') return
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString()
  document.cookie = `${REFERRAL_COOKIE_NAME}=${encodeURIComponent(code)}; path=/; expires=${expires}; SameSite=Lax`
}

/**
 * Clear referral cookie (client-side safe)
 * Call this after successful order completion
 */
export function clearReferralCookie(): void {
  if (typeof window === 'undefined') return
  document.cookie = `${REFERRAL_COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
}
