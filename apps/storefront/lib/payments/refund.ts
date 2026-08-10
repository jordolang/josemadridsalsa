import type { PaymentStatus, Prisma } from '@prisma/client'

import { getProvider } from '@/lib/payments'
import type { PaymentProvider } from '@/lib/payments/types'
import { emitDomainEvent } from '@/lib/domain-events/emit'
import { reverseFundraiserCommission } from '@/lib/fundraising/reverse-commission'

/**
 * Issue a refund at the processor and record it.
 *
 * Extracted from `app/api/admin/refunds` so return completion can refund through exactly the
 * same code rather than a second copy. A refund has four consequences that must all happen or
 * none — the provider call, the `Refund` row, the payment status, and the fundraiser commission
 * clawback — and two implementations of that would drift on the first change to any of them.
 *
 * Runs inside the caller's transaction so a failure anywhere leaves no partial record. Note the
 * provider call is *inside* the transaction, which is deliberate: if recording the refund fails
 * the row must not exist, and a refund the processor accepted but the database never saw is
 * strictly better discovered by reconciliation than a database row for money that never moved.
 */

export type RefundFailureCode =
  | 'NOT_FOUND'
  | 'NOT_SUCCEEDED'
  | 'NO_PROVIDER_ID'
  | 'EXCEEDS_REFUNDABLE'
  | 'INVALID_AMOUNT'
  | 'PROVIDER_ERROR'

export class RefundError extends Error {
  constructor(
    message: string,
    readonly code: RefundFailureCode
  ) {
    super(message)
    this.name = 'RefundError'
  }
}

/**
 * Payment statuses that can still be refunded against.
 *
 * `PARTIALLY_REFUNDED` belongs here and did not used to: the extracted route guarded on
 * `status !== 'SUCCEEDED'`, and the refund webhooks set a partly-refunded payment to
 * `PARTIALLY_REFUNDED`. So the **second** partial refund on any order was refused as "can only
 * refund successful payments", even with balance left. Two partial returns against one order is
 * an ordinary thing, so that was a real block rather than a safety rail.
 *
 * Widening is safe because the amount is bounded by `refundableCents`, not by the status — that
 * is what actually prevents refunding more than was taken.
 */
export const REFUNDABLE_PAYMENT_STATUSES: PaymentStatus[] = ['SUCCEEDED', 'PAID', 'PARTIALLY_REFUNDED']

/** How much of a payment is still refundable, given the refunds already taken against it. */
export function refundableCents(
  paymentAmountCents: number,
  refunds: Array<{ amount: number; status: string }>
): number {
  const alreadyRefunded = refunds.reduce(
    (sum, refund) => (refund.status === 'SUCCEEDED' ? sum + refund.amount : sum),
    0
  )
  return Math.max(0, paymentAmountCents - alreadyRefunded)
}

export interface RefundPaymentParams {
  paymentId: string
  /** Cents. Omitted refunds everything still refundable. */
  amountCents?: number
  reason?: string
}

/**
 * @throws RefundError — callers map `code` to a status. Throwing rather than returning a result
 * so a caller inside `$transaction` cannot accidentally ignore the failure and commit.
 */
export async function refundPaymentInTx(
  tx: Prisma.TransactionClient,
  params: RefundPaymentParams
) {
  const payment = await tx.payment.findUnique({
    where: { id: params.paymentId },
    include: { refunds: true },
  })

  if (!payment) {
    throw new RefundError('Payment not found', 'NOT_FOUND')
  }

  if (!REFUNDABLE_PAYMENT_STATUSES.includes(payment.status)) {
    throw new RefundError(
      `Cannot refund a ${payment.status.toLowerCase()} payment`,
      'NOT_SUCCEEDED'
    )
  }

  const provider = (payment.provider || 'STRIPE') as PaymentProvider
  const providerPaymentId =
    payment.providerPaymentId ||
    payment.stripePaymentIntentId ||
    payment.squarePaymentId ||
    payment.paypalCaptureId

  if (!providerPaymentId) {
    throw new RefundError('No provider payment ID found for this payment', 'NO_PROVIDER_ID')
  }

  const refundable = refundableCents(payment.amount, payment.refunds)
  const refundAmount = params.amountCents ?? refundable

  if (refundAmount > refundable) {
    throw new RefundError(
      `Cannot refund ${refundAmount} cents. Only ${refundable} cents available for refund.`,
      'EXCEEDS_REFUNDABLE'
    )
  }

  if (refundAmount <= 0) {
    throw new RefundError('Refund amount must be greater than 0', 'INVALID_AMOUNT')
  }

  const adapter = getProvider(provider)
  const refundResult = await adapter.refund({
    providerPaymentId,
    amount: refundAmount,
    reason: params.reason,
  })

  if (!refundResult.success) {
    throw new RefundError(
      refundResult.error || 'Refund failed at payment provider',
      'PROVIDER_ERROR'
    )
  }

  // `stripeRefundId` is provider-agnostic despite the name (see `Refund.provider`) and is
  // UNIQUE. Fail rather than synthesise an ID: a fabricated identifier in a financial table can
  // never be reconciled against the processor, which is worse than a refund that visibly failed
  // to record — the money moved, so this needs a human.
  if (!refundResult.providerRefundId) {
    throw new RefundError(
      `${provider} reported a ${refundResult.status} refund with no refund ID; refund not recorded`,
      'PROVIDER_ERROR'
    )
  }

  const refund = await tx.refund.create({
    data: {
      stripeRefundId: refundResult.providerRefundId,
      provider,
      amount: refundAmount,
      reason: params.reason || undefined,
      status: refundResult.status,
      paymentId: payment.id,
      processedAt: refundResult.status === 'SUCCEEDED' ? new Date() : null,
    },
  })

  if (refundResult.status === 'SUCCEEDED') {
    // Take the fundraising group's share back out. Only on a succeeded refund — a pending one
    // has not returned any money yet, and the webhook will reverse it when it lands.
    await reverseFundraiserCommission(tx, refund.id)

    const newPaymentStatus =
      refundAmount >= refundable ? 'REFUNDED' : 'PARTIALLY_REFUNDED'

    await tx.payment.update({
      where: { id: payment.id },
      data: { status: newPaymentStatus },
    })

    // Until this existed, `payment.refunded` had no producer at all: the customer was never
    // told their money was on its way back, and `ORDER_REFUNDED` — one of the automation
    // triggers — could never fire. Emitted only on SUCCEEDED, because a pending refund has
    // not returned anything yet, and with the transaction client so the fact is durable only
    // if the refund is.
    await emitDomainEvent(
      {
        type: 'payment.refunded',
        entityType: 'order',
        entityId: payment.orderId,
        payload: {
          refundId: refund.id,
          provider,
          amountCents: refundAmount,
          partial: newPaymentStatus === 'PARTIALLY_REFUNDED',
          reason: params.reason ?? null,
        },
      },
      tx
    )
  }

  return refund
}
