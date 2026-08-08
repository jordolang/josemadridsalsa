import { Prisma } from '@prisma/client'

import { calculateFundraiserCommission } from './commission'

/**
 * Credit a fundraiser order to its participant and its fundraiser. Exactly once.
 *
 * Six paths can mark an order paid — the three completion routes and the three payment
 * webhooks — and each pair races the other. Crediting used to be written inline in the
 * completion routes only, which meant a webhook winning the race left the group unpaid for
 * that sale with nothing anywhere recording that it had happened.
 *
 * So the credit is one operation, and it claims `Order.commissionCreditedAt` before touching
 * a rollup. The claim is a conditional update rather than a read-then-write: two callers
 * arriving together both see a null column, but only one `updateMany` matches, and the loser
 * gets a count of zero and stops. This is the same shape as the fulfillment and receiving
 * rollups — one writer, and increments rather than assignments, so concurrent credits
 * accumulate instead of overwriting each other.
 *
 * Call inside the same transaction that marks the order paid. A rolled-back payment must
 * take its credit with it.
 */

export interface CommissionCredit {
  credited: boolean
  /** Zero unless this call is the one that credited. */
  amount: number
  reason?: 'not-a-fundraiser-order' | 'already-credited' | 'fundraiser-missing'
}

export async function creditFundraiserCommission(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<CommissionCredit> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      subtotal: true,
      discountAmount: true,
      total: true,
      participantId: true,
      fundraiserId: true,
      commissionCreditedAt: true,
    },
  })

  if (!order?.participantId || !order.fundraiserId) {
    return { credited: false, amount: 0, reason: 'not-a-fundraiser-order' }
  }

  if (order.commissionCreditedAt) {
    return { credited: false, amount: 0, reason: 'already-credited' }
  }

  const fundraiser = await tx.fundraiser.findUnique({
    where: { id: order.fundraiserId },
    select: { commissionRate: true },
  })

  if (!fundraiser) {
    return { credited: false, amount: 0, reason: 'fundraiser-missing' }
  }

  // Claim the order. Only the caller whose update matches a still-null column proceeds,
  // which is what makes this safe to call from a webhook and a completion route at once.
  const claim = await tx.order.updateMany({
    where: { id: orderId, commissionCreditedAt: null },
    data: { commissionCreditedAt: new Date() },
  })

  if (claim.count === 0) {
    return { credited: false, amount: 0, reason: 'already-credited' }
  }

  const amount = calculateFundraiserCommission(
    {
      subtotal: Number(order.subtotal),
      discountAmount: Number(order.discountAmount),
    },
    Number(fundraiser.commissionRate)
  )

  // Revenue is the full order value; commission is the group's share of the merchandise.
  // They are deliberately different figures — see lib/fundraising/commission.ts.
  const revenue = new Prisma.Decimal(Number(order.total).toFixed(2))
  const commission = new Prisma.Decimal(amount.toFixed(2))

  await tx.fundraiserParticipant.update({
    where: { id: order.participantId },
    data: {
      totalOrders: { increment: 1 },
      totalRevenue: { increment: revenue },
      totalCommission: { increment: commission },
    },
  })

  // The fundraiser's own rollups were read in a dozen places — including the public progress
  // bar — and written by nothing, so every one of them reported zero.
  await tx.fundraiser.update({
    where: { id: order.fundraiserId },
    data: {
      totalOrders: { increment: 1 },
      totalRevenue: { increment: revenue },
      totalCommission: { increment: commission },
    },
  })

  return { credited: true, amount }
}
