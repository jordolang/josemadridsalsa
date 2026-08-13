import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { SALES_ONLY } from '@/lib/orders/sales-population'

import { getDateRange, type AnalyticsRangeKey } from './date-range'
import {
  rankByTurnover,
  summariseTurnover,
  type ProductStockInput,
  type ProductTurnover,
  type TurnoverSummary,
} from './inventory-turnover'

/**
 * Server-side half of the turnover report.
 *
 * Kept out of the page so the query and its mapping can be exercised directly. The part most
 * likely to be wrong is joining two different questions onto one product: how much is on the shelf
 * now (`Product.inventory`) and how much sold in the window (summed from `OrderItem`). They are
 * keyed together by `productId`, using the same sales filter as every other revenue report so the
 * units-sold figure here never disagrees with the margin or orders pages.
 */

export interface TurnoverReport {
  summary: TurnoverSummary
  products: ProductTurnover[]
  days: number
  /** Active products with no cost price — the reason value coverage is short. */
  uncostedProductCount: number
}

const toCents = (value: Prisma.Decimal | number | null): number | null =>
  value === null ? null : Math.round(Number(value) * 100)

export async function getTurnoverReport(range: AnalyticsRangeKey): Promise<TurnoverReport> {
  const { start, end, days } = getDateRange(range)

  // Same sales definition the margin and orders pages use, so units-sold cannot drift between them.
  const orderFilter: Prisma.OrderWhereInput = {
    ...SALES_ONLY,
    createdAt: { gte: start, lte: end },
    status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
    paymentStatus: { in: [PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED] },
  }

  const [products, soldByProduct] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, sku: true, inventory: true, costPrice: true },
    }),
    prisma.orderItem.groupBy({
      by: ['productId'],
      where: { order: orderFilter },
      _sum: { quantity: true },
    }),
  ])

  const unitsByProduct = new Map<string, number>()
  for (const row of soldByProduct) {
    unitsByProduct.set(row.productId, row._sum.quantity ?? 0)
  }

  let uncostedProductCount = 0
  const inputs: ProductStockInput[] = products.map((product) => {
    const unitCostCents = toCents(product.costPrice)
    if (unitCostCents === null) uncostedProductCount += 1
    return {
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      currentStock: product.inventory,
      unitCostCents,
      unitsSold: unitsByProduct.get(product.id) ?? 0,
    }
  })

  return {
    summary: summariseTurnover(inputs, days),
    products: rankByTurnover(inputs, days),
    days,
    uncostedProductCount,
  }
}
