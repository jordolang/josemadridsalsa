import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { SALES_ONLY } from '@/lib/orders/sales-population'

import {
  resolveTaxPeriod,
  summariseTaxCollected,
  type TaxableOrder,
  type TaxCollectedSummary,
  type TaxPeriod,
  type TaxPeriodKey,
} from './tax-report'

/**
 * Server-side half of the taxes-collected report.
 *
 * The population is deliberately wider than the margin report's. Margin asks what a sale left
 * behind, so a cancelled order is noise. Tax asks what was collected and must be remitted, so
 * a **refunded** order still belongs: the tax was collected, and whether it comes back off the
 * return depends on whether the refund included tax. Refunded orders are counted and reported
 * separately rather than silently kept or silently dropped.
 */

const toCents = (value: Prisma.Decimal | number | null | undefined): number =>
  value === null || value === undefined ? 0 : Math.round(Number(value) * 100)

export interface TaxReport {
  period: TaxPeriod
  summary: TaxCollectedSummary
  /** Refunded orders inside the period, whose collected tax may need backing out. */
  refunded: {
    orderCount: number
    taxCents: number
  }
}

export async function getTaxReport(key: TaxPeriodKey): Promise<TaxReport> {
  const period = resolveTaxPeriod(key)

  const where: Prisma.OrderWhereInput = {
    // An exchange replacement collects no tax and made no sale, so it would only inflate the
    // order count and the exempt-sales line.
    ...SALES_ONLY,
    createdAt: { gte: period.start, lte: period.end },
    // A cancelled order was never transacted. Everything else that was paid for counts,
    // including refunds.
    status: { not: OrderStatus.CANCELLED },
    paymentStatus: {
      in: [
        PaymentStatus.PAID,
        PaymentStatus.SUCCEEDED,
        PaymentStatus.PARTIALLY_REFUNDED,
        PaymentStatus.REFUNDED,
      ],
    },
  }

  const orders = await prisma.order.findMany({
    where,
    select: {
      orderNumber: true,
      createdAt: true,
      subtotal: true,
      shippingCost: true,
      discountAmount: true,
      tax: true,
      salesChannel: true,
      paymentStatus: true,
      shippingAddress: { select: { state: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const taxable: TaxableOrder[] = orders.map((order) => ({
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    subtotalCents: toCents(order.subtotal),
    shippingCents: toCents(order.shippingCost),
    discountCents: toCents(order.discountAmount),
    taxCents: toCents(order.tax),
    state: order.shippingAddress?.state ?? null,
    channel: order.salesChannel,
  }))

  const refundedOrders = orders.filter(
    (order) => order.paymentStatus === PaymentStatus.REFUNDED
  )

  return {
    period,
    summary: summariseTaxCollected(taxable),
    refunded: {
      orderCount: refundedOrders.length,
      taxCents: refundedOrders.reduce((sum, order) => sum + toCents(order.tax), 0),
    },
  }
}
