import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export interface GiftCertificateValidationResult {
  valid: boolean
  error?: string
  /** Amount of this certificate that can be applied to the current total. */
  applicableAmount?: number
  balance?: number
  code?: string
}

/**
 * Validate a gift certificate against an amount due.
 *
 * A certificate is stored value, not a discount: it can only ever cover up to its own
 * remaining balance, and a balance larger than the order simply carries over.
 *
 * @param code - The certificate code (case-insensitive).
 * @param amountDue - The order total the certificate would be applied against.
 */
export async function validateGiftCertificate(
  code: string,
  amountDue: number
): Promise<GiftCertificateValidationResult> {
  try {
    const certificate = await prisma.giftCertificate.findUnique({
      where: { code: code.toUpperCase() },
    })

    if (!certificate) {
      return { valid: false, error: 'Invalid gift certificate code' }
    }

    if (certificate.status === 'EXPIRED') {
      return { valid: false, error: 'This gift certificate has expired' }
    }

    if (certificate.status === 'CANCELLED') {
      return { valid: false, error: 'This gift certificate has been cancelled' }
    }

    if (certificate.expiresAt && new Date() > certificate.expiresAt) {
      return { valid: false, error: 'This gift certificate has expired' }
    }

    const balance = Number(certificate.balance)

    if (balance <= 0) {
      return { valid: false, error: 'This gift certificate has been fully redeemed' }
    }

    return {
      valid: true,
      code: certificate.code,
      balance,
      applicableAmount: Math.min(balance, Math.max(amountDue, 0)),
    }
  } catch (error) {
    console.error('Error validating gift certificate:', error)
    return { valid: false, error: 'Failed to validate gift certificate' }
  }
}

/**
 * Redeem a gift certificate against a paid order, inside the caller's transaction.
 *
 * Called from payment completion, which runs from both /api/checkout/complete and the
 * Stripe webhook for the same order. Two properties matter:
 *
 * - Idempotent: a GiftCertificateUsage row for this (certificate, order) pair means the
 *   other path already redeemed it, so this is a no-op. Without this the balance would
 *   be decremented twice for one order.
 * - Race-safe: the decrement is conditional on the balance still covering the amount, so
 *   two orders spending the same certificate concurrently cannot drive it negative.
 *
 * Returns false when the balance no longer covers the amount. The customer has already
 * been charged the reduced total at that point, so the caller must surface this loudly
 * rather than silently discarding it.
 */
export async function redeemGiftCertificateInTx(
  tx: Prisma.TransactionClient,
  params: { code: string; orderId: string; amount: number }
): Promise<{ redeemed: boolean; alreadyRedeemed?: boolean; reason?: string }> {
  const { code, orderId, amount } = params

  if (amount <= 0) {
    return { redeemed: false, reason: 'Nothing to redeem' }
  }

  const certificate = await tx.giftCertificate.findUnique({
    where: { code: code.toUpperCase() },
  })

  if (!certificate) {
    return { redeemed: false, reason: `Gift certificate ${code} not found` }
  }

  const existingUsage = await tx.giftCertificateUsage.findFirst({
    where: { giftCertificateId: certificate.id, orderId },
  })

  if (existingUsage) {
    return { redeemed: true, alreadyRedeemed: true }
  }

  // Conditional decrement: only applies if the balance still covers the amount.
  const updated = await tx.giftCertificate.updateMany({
    where: { id: certificate.id, balance: { gte: amount } },
    data: { balance: { decrement: amount } },
  })

  if (updated.count !== 1) {
    return {
      redeemed: false,
      reason: `Gift certificate ${certificate.code} balance no longer covers ${amount}`,
    }
  }

  const balanceAfter = Number(certificate.balance) - amount

  await tx.giftCertificateUsage.create({
    data: {
      giftCertificateId: certificate.id,
      orderId,
      amount,
      balanceAfter,
    },
  })

  if (balanceAfter <= 0) {
    await tx.giftCertificate.update({
      where: { id: certificate.id },
      data: { status: 'REDEEMED', redeemedAt: new Date() },
    })
  }

  return { redeemed: true }
}
