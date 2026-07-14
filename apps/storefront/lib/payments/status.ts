import type { PaymentStatus } from '@prisma/client'

/**
 * The status written when an order is successfully paid.
 *
 * The PaymentStatus enum carries both PAID and SUCCEEDED. The checkout-complete
 * route historically wrote PAID while the Stripe webhook wrote SUCCEEDED, so the
 * two paths could not recognize each other's work: whichever ran second re-ran
 * its side effects, and the refund routes — which only accepted PAID — rejected
 * any order the webhook had finalized.
 *
 * All paths now write PAID. SUCCEEDED is retained in the enum, and read paths must
 * go through PAID_PAYMENT_STATUSES, because orders paid before this change are
 * still stored as SUCCEEDED.
 */
export const PAID_PAYMENT_STATUS = 'PAID' as const

/** Every status that means "this order has been paid for". Use for reads/filters. */
export const PAID_PAYMENT_STATUSES: PaymentStatus[] = ['PAID', 'SUCCEEDED']

/** Whether an order has been paid, tolerating the legacy SUCCEEDED value. */
export function isPaid(status: PaymentStatus): boolean {
  return PAID_PAYMENT_STATUSES.includes(status)
}
