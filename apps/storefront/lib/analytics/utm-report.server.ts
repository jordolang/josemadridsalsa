import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { SALES_ONLY } from '@/lib/orders/sales-population'

import { getDateRange, type AnalyticsRangeKey } from './date-range'
import {
  groupByDimension,
  summariseAttribution,
  type AttributedOrder,
  type AttributionDimension,
  type AttributionRow,
  type AttributionSummary,
} from './utm-report'

/**
 * Server-side half of the UTM attribution report.
 *
 * Uses the same sales definition as the margin and orders reports, so the order and revenue totals
 * here reconcile with them. Revenue is the order total (what the customer paid), converted to whole
 * cents once so the grouping sums without float drift.
 */

export interface AttributionReport {
  summary: AttributionSummary
  rows: AttributionRow[]
  dimension: AttributionDimension
}

export async function getAttributionReport(
  range: AnalyticsRangeKey,
  dimension: AttributionDimension
): Promise<AttributionReport> {
  const { start, end } = getDateRange(range)

  const orderFilter: Prisma.OrderWhereInput = {
    ...SALES_ONLY,
    createdAt: { gte: start, lte: end },
    status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
    paymentStatus: { in: [PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED] },
  }

  const orders = await prisma.order.findMany({
    where: orderFilter,
    select: {
      utmSource: true,
      utmMedium: true,
      utmCampaign: true,
      referrer: true,
      total: true,
    },
  })

  const attributed: AttributedOrder[] = orders.map((o) => ({
    utmSource: o.utmSource,
    utmMedium: o.utmMedium,
    utmCampaign: o.utmCampaign,
    referrer: o.referrer,
    revenueCents: Math.round(Number(o.total) * 100),
  }))

  return {
    summary: summariseAttribution(attributed),
    rows: groupByDimension(attributed, dimension),
    dimension,
  }
}
