import type { Prisma } from '@prisma/client'
import { redeemGiftCertificateInTx } from '@/lib/gift-certificates'

export interface RedeemOrderCodesParams {
  orderId: string
  userId: string | null
  discountCode: string | null
  discountAmount: number
  giftCertificateCode: string | null
  giftCertificateAmount: number
  orderTotal: number
}

/**
 * Redeem the discount and gift certificate recorded on a paid order.
 *
 * Called from payment completion, which happens on two paths for the same order —
 * /api/checkout/complete and the Stripe webhook — so every write here is idempotent on
 * orderId. Redemption is deliberately deferred to payment success: recording it at order
 * creation would let an abandoned checkout consume a discount's usage allowance or spend
 * down a gift certificate the customer never actually used.
 *
 * Runs inside the caller's transaction so redemption commits together with the order
 * being marked paid: an order can never be paid without its codes being consumed, and
 * codes can never be consumed for an order that failed to complete.
 */
export async function redeemOrderCodesInTx(
  tx: Prisma.TransactionClient,
  params: RedeemOrderCodesParams
): Promise<void> {
  const {
    orderId,
    userId,
    discountCode,
    discountAmount,
    giftCertificateCode,
    giftCertificateAmount,
    orderTotal,
  } = params

  if (discountCode && discountAmount >= 0) {
    const code = await tx.discountCode.findUnique({
      where: { code: discountCode.toUpperCase() },
    })

    if (code) {
      const existingUsage = await tx.discountUsage.findFirst({
        where: { discountCodeId: code.id, orderId },
      })

      if (!existingUsage) {
        await tx.discountUsage.create({
          data: {
            discountCodeId: code.id,
            orderId,
            userId: userId ?? undefined,
            discountAmount,
            orderTotal,
          },
        })

        // Claim the use conditionally: checkout validates maxUses before payment, so two
        // checkouts carrying the same single-use code both pass validation. Only the first
        // to complete may consume it; the rest fail like an unredeemable gift certificate.
        const claim = await tx.discountCode.updateMany({
          where: {
            id: code.id,
            ...(code.maxUses != null && { usedCount: { lt: code.maxUses } }),
          },
          data: { usedCount: { increment: 1 } },
        })
        if (claim.count === 0) {
          throw new Error(
            `[Redeem] Discount code ${code.code} reached its usage limit before order ${orderId} completed`
          )
        }

        // A loyalty reward code is now spent; stop offering it on the rewards page.
        await tx.rewardRedemption.updateMany({
          where: { discountCode: code.code, status: 'ACTIVE' },
          data: { status: 'USED', usedAt: new Date() },
        })
      }
    } else {
      console.error('[Redeem] Discount code on order no longer exists', { orderId, discountCode })
    }
  }

  if (giftCertificateCode && giftCertificateAmount > 0) {
    const result = await redeemGiftCertificateInTx(tx, {
      code: giftCertificateCode,
      orderId,
      amount: giftCertificateAmount,
    })

    if (!result.redeemed) {
      // The customer was already charged a total reduced by this certificate, so a
      // failure here means the books are off. Fail the transaction rather than quietly
      // handing over the goods: the order stays unpaid and is surfaced for a human.
      throw new Error(
        `[Redeem] Failed to redeem gift certificate for order ${orderId}: ${result.reason}`
      )
    }
  }
}
