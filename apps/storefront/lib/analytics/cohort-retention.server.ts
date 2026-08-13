import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { SALES_ONLY } from '@/lib/orders/sales-population'

import { getDateRange, type AnalyticsRangeKey } from './date-range'
import { analyseCohorts, type BuyerOrder, type CohortAnalysis } from './cohort-retention'

/**
 * Server-side half of the cohort/retention report.
 *
 * The one judgement here is who counts as the same buyer across orders. There is no `Customer`
 * foreign key on `Order`, so identity is the signed-in `userId` when present, otherwise the
 * normalised guest email. An order with neither cannot be tied to a person and is excluded rather
 * than counted as its own one-time buyer — which would quietly deflate every retention figure — and
 * the count of those is returned so the omission is visible.
 */

export interface CohortReport extends CohortAnalysis {
  /** Orders in the window that could not be attributed to a buyer (no user and no email). */
  unattributedOrders: number
}

/** Lower-cased, trimmed. An empty string after trimming is treated as no email. */
function normaliseEmail(email: string | null): string | null {
  if (!email) return null
  const cleaned = email.trim().toLowerCase()
  return cleaned.length > 0 ? cleaned : null
}

export async function getCohortReport(
  range: AnalyticsRangeKey,
  now: Date = new Date()
): Promise<CohortReport> {
  const { start, end } = getDateRange(range)

  // Same sales definition as the margin and orders reports, so buyer counts never disagree.
  const orderFilter: Prisma.OrderWhereInput = {
    ...SALES_ONLY,
    createdAt: { gte: start, lte: end },
    status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
    paymentStatus: { in: [PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED] },
  }

  const orders = await prisma.order.findMany({
    where: orderFilter,
    select: { userId: true, guestEmail: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  const buyerOrders: BuyerOrder[] = []
  let unattributedOrders = 0

  for (const order of orders) {
    const buyerKey = order.userId ?? normaliseEmail(order.guestEmail)
    if (!buyerKey) {
      unattributedOrders += 1
      continue
    }
    buyerOrders.push({ buyerKey, date: order.createdAt })
  }

  return { ...analyseCohorts(buyerOrders, now), unattributedOrders }
}
