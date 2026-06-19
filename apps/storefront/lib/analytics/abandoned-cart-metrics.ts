import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getDateRange } from '@/lib/analytics/date-range'
import type { AnalyticsRangeKey } from '@/lib/analytics/date-range'

export type AbandonedCartChartPoint = {
  date: string
  label: string
  abandoned: number
  recovered: number
}

export type EmailStageCount = {
  stage: number
  count: number
  label: string
}

export type RecoveredProduct = {
  productId: string
  name: string
  quantity: number
  revenue: number
  recoveries: number
  sku: string
  imageUrl: string | null
}

export type AbandonedCartMetrics = {
  summary: {
    totalAbandoned: number
    totalRecovered: number
    recoveryRate: number
    attributedRevenue: number
    emailsSent: number
  }
  emailsByStage: EmailStageCount[]
  chart: AbandonedCartChartPoint[]
  topRecoveredProducts: RecoveredProduct[]
}

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function formatDateLabel(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

const EMAIL_STAGE_LABELS: Record<number, string> = {
  0: 'No email sent',
  1: '1 hour (Stage 1)',
  2: '24 hours (Stage 2)',
  3: '48 hours (Stage 3)',
}

export async function getAbandonedCartMetrics(range: AnalyticsRangeKey): Promise<AbandonedCartMetrics> {
  const { start, end, days } = getDateRange(range)
  const createdAtRange = { gte: start, lte: end }

  const excludedStatuses: OrderStatus[] = [OrderStatus.CANCELLED, OrderStatus.REFUNDED]
  const includedPayments: PaymentStatus[] = [PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED]

  const recoveredOrderFilter = {
    createdAt: createdAtRange,
    status: { notIn: excludedStatuses },
    paymentStatus: { in: includedPayments },
    abandonedCartId: { not: null },
  } as Prisma.OrderWhereInput

  const [
    abandonedCarts,
    recoveredCarts,
    emailStageGroups,
    recoveredOrders,
    topRecoveredProductsRaw,
  ] = await Promise.all([
    prisma.abandonedCart.findMany({
      where: {
        createdAt: createdAtRange,
      },
      select: {
        id: true,
        createdAt: true,
        recoveredAt: true,
        emailStage: true,
        emailSent: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.abandonedCart.count({
      where: {
        createdAt: createdAtRange,
        recoveredAt: { not: null },
      },
    }),
    prisma.abandonedCart.groupBy({
      by: ['emailStage'],
      where: {
        createdAt: createdAtRange,
        emailSent: true,
      },
      _count: { _all: true },
    }),
    prisma.order.findMany({
      where: recoveredOrderFilter,
      select: {
        id: true,
        total: true,
        createdAt: true,
        abandonedCartId: true,
      } as Prisma.OrderSelect,
    }),
    prisma.orderItem.groupBy({
      by: ['productId', 'productName', 'productSku'],
      where: {
        order: recoveredOrderFilter,
      },
      _sum: {
        totalPrice: true,
        quantity: true,
      },
      _count: { orderId: true },
      orderBy: {
        _sum: { totalPrice: 'desc' },
      },
      take: 10,
    }),
  ])

  const extractCount = (value: unknown): number =>
    typeof value === 'object' && value !== null && '_all' in (value as Record<string, unknown>)
      ? Number((value as Record<string, unknown>)._all) || 0
      : 0

  const extractSum = (value: unknown, field: 'quantity' | 'totalPrice'): number =>
    typeof value === 'object' && value !== null && field in (value as Record<string, unknown>)
      ? Number((value as Record<string, unknown>)[field] || 0)
      : 0

  const extractCountByField = (value: unknown, field: string): number =>
    typeof value === 'object' && value !== null && field in (value as Record<string, unknown>)
      ? Number((value as Record<string, unknown>)[field] || 0)
      : 0

  const totalAbandoned = abandonedCarts.length
  const totalRecovered = recoveredCarts
  const recoveryRate = totalAbandoned === 0 ? 0 : (totalRecovered / totalAbandoned) * 100

  const attributedRevenue = recoveredOrders.reduce((sum, order) => sum + Number(order.total || 0), 0)

  const emailsSent = emailStageGroups.reduce((sum, group) => sum + extractCount(group._count), 0)

  const emailsByStage: EmailStageCount[] = emailStageGroups.map((group) => ({
    stage: group.emailStage,
    count: extractCount(group._count),
    label: EMAIL_STAGE_LABELS[group.emailStage] || `Stage ${group.emailStage}`,
  }))

  const dayBuckets = new Map<string, AbandonedCartChartPoint>()
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(end)
    date.setDate(end.getDate() - offset)
    date.setHours(0, 0, 0, 0)
    const key = toDateKey(date)
    dayBuckets.set(key, {
      date: key,
      label: formatDateLabel(date),
      abandoned: 0,
      recovered: 0,
    })
  }

  abandonedCarts.forEach((cart) => {
    const key = toDateKey(cart.createdAt)
    const bucket = dayBuckets.get(key)
    if (bucket) {
      bucket.abandoned += 1
      if (cart.recoveredAt) {
        bucket.recovered += 1
      }
    }
  })

  const chart = Array.from(dayBuckets.values()).sort((a, b) => (a.date < b.date ? -1 : 1))

  const productIds = topRecoveredProductsRaw.map((item) => item.productId)
  const productDetails = productIds.length > 0
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, featuredImage: true },
      })
    : []
  const productDetailsMap = new Map(productDetails.map((p) => [p.id, p]))

  const topRecoveredProducts: RecoveredProduct[] = topRecoveredProductsRaw.map((item) => {
    const details = productDetailsMap.get(item.productId)
    return {
      productId: item.productId,
      name: item.productName,
      sku: item.productSku,
      quantity: extractSum(item._sum, 'quantity'),
      revenue: extractSum(item._sum, 'totalPrice'),
      recoveries: extractCountByField(item._count, 'orderId'),
      imageUrl: details?.featuredImage ?? null,
    }
  })

  return {
    summary: {
      totalAbandoned,
      totalRecovered,
      recoveryRate,
      attributedRevenue,
      emailsSent,
    },
    emailsByStage,
    chart,
    topRecoveredProducts,
  }
}
