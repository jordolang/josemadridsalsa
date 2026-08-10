import { prisma } from '@/lib/prisma'
import { decryptSecret, encryptSecret, hashValue } from '@/lib/crypto'

import {
  buildOtpAuthUri,
  generateRecoveryCodes,
  generateTotpSecret,
  normalizeRecoveryCode,
  verifyTotp,
} from './totp'

/**
 * Enrolment and verification for admin two-factor auth.
 *
 * Two invariants hold everything together. A secret is only a *second factor* once
 * `twoFactorEnabledAt` is set — storing a secret alone is a half-finished enrolment and
 * must never gate sign-in, or an interrupted setup locks the account out. And the secret is
 * encrypted at rest with the same vault key as third-party credentials, so a database read
 * does not hand over the ability to mint codes.
 */

export interface EnrolmentStart {
  secret: string
  otpauthUri: string
}

/**
 * Begin enrolment: mint a secret, store it encrypted but *not* enabled, and hand back the
 * URI for the authenticator app. Called again, it replaces any pending secret — a user who
 * abandoned setup halfway should get a clean start rather than a stuck one.
 */
export async function startTwoFactorEnrolment(
  userId: string,
  accountName: string
): Promise<EnrolmentStart> {
  const secret = generateTotpSecret()
  const { encryptedValue, iv } = encryptSecret(secret)

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorSecret: encryptedValue, twoFactorSecretIv: iv, twoFactorEnabledAt: null },
  })

  return { secret, otpauthUri: buildOtpAuthUri({ secret, accountName }) }
}

/**
 * Finish enrolment by proving the authenticator works.
 *
 * Recovery codes are generated here and returned exactly once — only their hashes are kept,
 * so they cannot be shown again later.
 */
export async function confirmTwoFactorEnrolment(
  userId: string,
  token: string
): Promise<{ ok: true; recoveryCodes: string[] } | { ok: false; error: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorSecret: true, twoFactorSecretIv: true, twoFactorEnabledAt: true },
  })

  if (!user?.twoFactorSecret || !user.twoFactorSecretIv) {
    return { ok: false, error: 'Start setup before confirming a code' }
  }
  if (user.twoFactorEnabledAt) {
    return { ok: false, error: 'Two-factor authentication is already enabled' }
  }

  const secret = decryptSecret(user.twoFactorSecret, user.twoFactorSecretIv)
  if (!verifyTotp(secret, token)) {
    return { ok: false, error: 'That code is not valid. Check your device clock and try again.' }
  }

  const recoveryCodes = generateRecoveryCodes()

  await prisma.$transaction([
    prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } }),
    prisma.twoFactorRecoveryCode.createMany({
      data: recoveryCodes.map((code) => ({
        userId,
        codeHash: hashValue(normalizeRecoveryCode(code)),
      })),
    }),
    prisma.user.update({ where: { id: userId }, data: { twoFactorEnabledAt: new Date() } }),
  ])

  return { ok: true, recoveryCodes }
}

/**
 * Verify a sign-in challenge. Accepts either a TOTP code or an unused recovery code.
 *
 * A recovery code is consumed on use — that is the point of it — and consumption is done
 * with a conditional update so two simultaneous attempts cannot both spend the same code.
 */
export async function verifyTwoFactorChallenge(
  userId: string,
  token: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorSecret: true, twoFactorSecretIv: true, twoFactorEnabledAt: true },
  })

  if (!user?.twoFactorEnabledAt || !user.twoFactorSecret || !user.twoFactorSecretIv) {
    return false
  }

  const secret = decryptSecret(user.twoFactorSecret, user.twoFactorSecretIv)
  if (verifyTotp(secret, token)) return true

  return consumeRecoveryCode(userId, token)
}

export async function consumeRecoveryCode(userId: string, code: string): Promise<boolean> {
  const codeHash = hashValue(normalizeRecoveryCode(code))

  // updateMany with usedAt: null in the predicate makes spending a code atomic: a second
  // concurrent attempt updates zero rows and is rejected.
  const { count } = await prisma.twoFactorRecoveryCode.updateMany({
    where: { userId, codeHash, usedAt: null },
    data: { usedAt: new Date() },
  })

  return count > 0
}

export async function isTwoFactorEnabled(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorEnabledAt: true },
  })
  return Boolean(user?.twoFactorEnabledAt)
}

/**
 * Turn two-factor off, clearing the secret and every recovery code so a later re-enrolment
 * starts fresh rather than reviving an old device.
 */
export async function disableTwoFactor(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } }),
    prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: null, twoFactorSecretIv: null, twoFactorEnabledAt: null },
    }),
  ])
}

export async function countUnusedRecoveryCodes(userId: string): Promise<number> {
  return prisma.twoFactorRecoveryCode.count({ where: { userId, usedAt: null } })
}
