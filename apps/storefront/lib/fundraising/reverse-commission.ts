import { Prisma } from '@prisma/client'

import { commissionBase } from './commission'

/**
 * Take back a fundraising group's share when an order is refunded. Exactly once per refund.
 *
 * Without this, a returned jar leaves the group credited for revenue that no longer exists —
 * money owed against a sale that did not happen. The mirror of `creditFundraiserCommission`,
 * and it uses the same claim: the amount is written to `Refund.commissionReversed` with a
 * still-null guard, so of two callers arriving together only one reverses.
 *
 * **How much comes back.** The share is measured against the *merchandise* base — subtotal
 * net of discounts — not the order total, because that is the base commission was credited
 * on. Reversing against a different denominator than you credited against would leave the two
 * permanently out of step. It does mean a refund is treated as merchandise before freight,
 * which reverses slightly more than a total-based split would; that is the right way round,
 * since a refund on a fundraiser order is a returned jar far more often than it is refunded
 * shipping.
 *
 * The proportion is applied to what was *originally* credited, reconstructed as the order's
 * remaining commission plus everything already reversed against it. Deriving it that way
 * rather than from `Fundraiser.commissionRate` matters: the rate is editable through an
 * audited admin route, and a reversal computed from a rate that changed after the sale would
 * not match the credit it is undoing.
 *
 * Call inside the transaction that records the refund, so a rolled-back refund takes its
 * reversal with it.
 */

export interface CommissionReversal {
  reversed: boolean
  /** Zero unless this call is the one that reversed. */
  amount: number
  reason?: 'not-a-fundraiser-order' | 'already-reversed' | 'nothing-left-to-reverse'
}

const round2 = (value: number) => Math.round(value * 100) / 100

export async function reverseFundraiserCommission(
  tx: Prisma.TransactionClient,
  refundId: string
): Promise<CommissionReversal> {
  const refund = await tx.refund.findUnique({
    where: { id: refundId },
    select: {
      amount: true,
      commissionReversed: true,
      payment: {
        select: {
          order: {
            select: {
              id: true,
              subtotal: true,
              discountAmount: true,
              fundraiserCommission: true,
              participantId: true,
              fundraiserId: true,
            },
          },
        },
      },
    },
  })

  const order = refund?.payment?.order

  // Mirrors `credit-commission.ts`: the fundraiser makes it a campaign sale, the participant
  // is optional. A credit taken without a participant has to be reversible without one too.
  if (!refund || !order?.fundraiserId || order.fundraiserCommission === null) {
    return { reversed: false, amount: 0, reason: 'not-a-fundraiser-order' }
  }

  if (refund.commissionReversed !== null) {
    return { reversed: false, amount: 0, reason: 'already-reversed' }
  }

  const remaining = Number(order.fundraiserCommission)
  if (remaining <= 0) {
    return { reversed: false, amount: 0, reason: 'nothing-left-to-reverse' }
  }

  // Everything already taken back against this order, so the original credit can be
  // reconstructed without storing it twice.
  const priorReversals = await tx.refund.aggregate({
    where: { payment: { orderId: order.id }, commissionReversed: { not: null } },
    _sum: { commissionReversed: true },
  })
  const alreadyReversed = Number(priorReversals._sum.commissionReversed ?? 0)
  const originalCommission = remaining + alreadyReversed

  const base = commissionBase({
    subtotal: Number(order.subtotal),
    discountAmount: Number(order.discountAmount),
  })

  // `Refund.amount` is in cents; everything else here is in dollars.
  const refundDollars = refund.amount / 100
  const share = base > 0 ? Math.min(1, refundDollars / base) : 0

  // Capped at what is left, which is what makes a partial reversal followed by a full refund
  // of the remainder come to exactly the original credit rather than a cent either side.
  const amount = Math.min(round2(originalCommission * share), remaining)

  if (amount <= 0) {
    return { reversed: false, amount: 0, reason: 'nothing-left-to-reverse' }
  }

  const claim = await tx.refund.updateMany({
    where: { id: refundId, commissionReversed: null },
    data: { commissionReversed: new Prisma.Decimal(amount.toFixed(2)) },
  })

  if (claim.count === 0) {
    return { reversed: false, amount: 0, reason: 'already-reversed' }
  }

  const commission = new Prisma.Decimal(amount.toFixed(2))
  const revenue = new Prisma.Decimal(refundDollars.toFixed(2))

  // The order now carries what the group is still owed for it, so margin reporting nets
  // refunds without having to join back to this table.
  await tx.order.update({
    where: { id: order.id },
    data: { fundraiserCommission: { decrement: commission } },
  })

  // Revenue comes down by what was refunded; the order itself still happened, so the order
  // count is deliberately left alone.
  if (order.participantId) {
    await tx.fundraiserParticipant.update({
      where: { id: order.participantId },
      data: {
        totalRevenue: { decrement: revenue },
        totalCommission: { decrement: commission },
      },
    })
  }

  await tx.fundraiser.update({
    where: { id: order.fundraiserId },
    data: {
      totalRevenue: { decrement: revenue },
      totalCommission: { decrement: commission },
    },
  })

  return { reversed: true, amount }
}
