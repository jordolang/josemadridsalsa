import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { SALES_ONLY } from '@/lib/orders/sales-population'

import { getDateRange, type AnalyticsRangeKey } from './date-range'
import type { MarginSummary } from './margin'
import {
  marginByProduct,
  summariseContribution,
  summariseSoldLines,
  type ContributionSummary,
  type ProductMargin,
  type SoldLine,
} from './margin-report'

/**
 * Server-side half of the margin report.
 *
 * Kept out of the page so the query and its mapping can be exercised directly — the part most
 * likely to be wrong is not the arithmetic but the conversion into it: `unitCost` is per unit
 * while `totalPrice` is per line, and treating them alike would report a margin far better
 * than reality on every multi-unit order.
 */

export interface MarginReport {
  summary: MarginSummary
  products: ProductMargin[]
  contribution: ContributionSummary
  orderCount: number
  /** Active products with no cost price at all — the reason coverage is short. */
  uncostedProductCount: number
}

const toCents = (value: Prisma.Decimal | number | null): number | null =>
  value === null ? null : Math.round(Number(value) * 100)

export async function getMarginReport(range: AnalyticsRangeKey): Promise<MarginReport> {
  const { start, end } = getDateRange(range)

  // The same filter the order analytics page uses, so the two pages never report different
  // revenue for the same window.
  const orderFilter: Prisma.OrderWhereInput = {
    ...SALES_ONLY,
    createdAt: { gte: start, lte: end },
    status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
    paymentStatus: { in: [PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED] },
  }

  const [orders, uncostedProductCount] = await Promise.all([
    prisma.order.findMany({
      where: orderFilter,
      select: {
        fundraiserCommission: true,
        items: {
          select: {
            productId: true,
            productName: true,
            productSku: true,
            quantity: true,
            totalPrice: true,
            unitCost: true,
          },
        },
      },
    }),
    prisma.product.count({ where: { costPrice: null, isActive: true } }),
  ])

  const lines: SoldLine[] = []
  let commissionCents = 0

  for (const order of orders) {
    // Recorded when the group was credited, so editing the rate afterwards cannot rewrite it.
    commissionCents += toCents(order.fundraiserCommission) ?? 0

    for (const item of order.items) {
      lines.push({
        productId: item.productId,
        productName: item.productName,
        productSku: item.productSku,
        quantity: item.quantity,
        revenueCents: toCents(item.totalPrice) ?? 0,
        // Per unit, and multiplied by quantity inside the summariser. Null stays null.
        unitCostCents: toCents(item.unitCost),
      })
    }
  }

  const summary = summariseSoldLines(lines)

  return {
    summary,
    products: marginByProduct(lines),
    contribution: summariseContribution(summary, commissionCents),
    orderCount: orders.length,
    uncostedProductCount,
  }
}
