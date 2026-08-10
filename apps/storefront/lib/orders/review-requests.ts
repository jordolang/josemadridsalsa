/**
 * Which delivered orders should be asked for a review, and what to say to them.
 *
 * Extracted from `app/api/cron/review-requests` so the window arithmetic and the "already
 * asked" guard can be tested. Both have been wrong here before: the guard used to key off
 * `confirmationEmailSentAt`, which every successful checkout stamps, so the filter only ever
 * matched orders that never got a confirmation and the cron sent almost nothing. That bug was
 * invisible precisely because none of this was reachable from a test.
 */
import type { Prisma } from '@prisma/client'

/** Long enough that the salsa has been opened; short enough that the order is still memorable. */
export const MIN_DAYS_AFTER_DELIVERY = 3
export const MAX_DAYS_AFTER_DELIVERY = 7

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The delivery window that is currently ripe.
 *
 * Note the inversion: an order delivered *longer* ago has the *earlier* timestamp, so the
 * maximum age produces `gte` and the minimum age produces `lte`. Getting this backwards yields
 * an empty range and a cron that silently sends nothing, which is the failure this guards.
 */
export function reviewRequestWindow(now: Date): { gte: Date; lte: Date } {
  return {
    gte: new Date(now.getTime() - MAX_DAYS_AFTER_DELIVERY * DAY_MS),
    lte: new Date(now.getTime() - MIN_DAYS_AFTER_DELIVERY * DAY_MS),
  }
}

/**
 * Orders that are due a review request.
 *
 * `reviewRequestSentAt: null` is the real "have we asked" marker — deliberately its own column
 * so it cannot be confused with the confirmation timestamp. The `OR` keeps out orders with no
 * way to reach anybody rather than counting them as skipped later.
 */
export function reviewRequestWhere(now: Date): Prisma.OrderWhereInput {
  return {
    status: 'DELIVERED',
    deliveredAt: reviewRequestWindow(now),
    reviewRequestSentAt: null,
    OR: [{ userId: { not: null } }, { guestEmail: { not: null } }],
  }
}

export interface ReviewRequestOrder {
  orderNumber: string
  guestEmail: string | null
  user: { email: string | null; name: string | null } | null
  items: Array<{ productName: string }>
}

export interface ReviewRequestRecipient {
  email: string
  name: string
  orderNumber: string
  productName: string
}

/**
 * Build the email arguments for one order, or null when it cannot be sent.
 *
 * Falls back rather than rendering blanks: a guest with no name is greeted, and an order whose
 * items have somehow gone is described generically instead of producing "review your undefined".
 */
export function reviewRequestRecipient(
  order: ReviewRequestOrder
): ReviewRequestRecipient | null {
  const email = order.user?.email ?? order.guestEmail
  if (!email) return null

  return {
    email,
    name: order.user?.name ?? 'there',
    orderNumber: order.orderNumber,
    productName: order.items[0]?.productName ?? 'your José Madrid Salsa',
  }
}
