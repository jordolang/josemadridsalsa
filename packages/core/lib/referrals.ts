import { randomBytes } from 'crypto'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { SITE_URL } from '@/lib/site-url'

/** Holds the code from a refer-a-friend link until the visitor creates an account. */
export const REFERRAL_COOKIE = 'jms_ref'
export const REFERRAL_COOKIE_MAX_AGE = 30 * 24 * 60 * 60

// No 0/O or 1/I, so a code read aloud or copied by hand still matches.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 8

export const ReferralCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6,16}$/)

export function parseReferralCode(value: unknown): string | null {
  const parsed = ReferralCodeSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function generateReferralCode(): string {
  const bytes = randomBytes(CODE_LENGTH)
  let code = ''
  for (const byte of bytes) code += CODE_ALPHABET[byte % CODE_ALPHABET.length]
  return code
}

export function referralLink(code: string): string {
  return `${SITE_URL}/refer/${code}`
}

/**
 * The customer's referral code, issued on first use. The write only fills a still-empty column,
 * so two tabs opening the page together settle on one code; a collision with another customer's
 * code retries with a fresh one.
 */
export async function getOrCreateReferralCode(userId: string): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } })
    if (!user) return null
    if (user.referralCode) return user.referralCode

    try {
      await prisma.user.updateMany({
        where: { id: userId, referralCode: null },
        data: { referralCode: generateReferralCode() },
      })
    } catch (error) {
      // P2002: another customer already holds this code. Loop and draw again.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error
    }
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } })
  return user?.referralCode ?? null
}

/**
 * Records who referred a brand-new account. Call only right after the account is created: the
 * referrer is set once and never changed, and a customer cannot refer themselves.
 */
export async function attachReferrer(userId: string, rawCode: unknown): Promise<boolean> {
  const code = parseReferralCode(rawCode)
  if (!code) return false

  const referrer = await prisma.user.findUnique({ where: { referralCode: code }, select: { id: true } })
  if (!referrer || referrer.id === userId) return false

  const result = await prisma.user.updateMany({
    where: { id: userId, referredById: null },
    data: { referredById: referrer.id },
  })
  return result.count > 0
}

/**
 * Reads the referral cookie on the current request and attaches its referrer to a new account.
 * The cookie is spent on the first sign-up, so a later account made in the same browser is not
 * credited to the same referrer. Never throws: a failed referral must not fail a sign-up.
 */
export async function attachReferrerFromCookie(userId: string): Promise<boolean> {
  try {
    const { cookies } = await import('next/headers')
    const store = await cookies()
    const code = store.get(REFERRAL_COOKIE)?.value
    if (!code) return false
    store.delete(REFERRAL_COOKIE)
    return await attachReferrer(userId, code)
  } catch (error) {
    console.error('[Referrals] Could not record referrer:', error)
    return false
  }
}
