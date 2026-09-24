import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getDateRange } from '@/lib/analytics/date-range'
import type { AnalyticsRangeKey } from '@/lib/analytics/date-range'
import { ABANDONED_CART_EMAIL_TYPE, FINAL_STAGE } from '@/lib/checkout/abandoned-cart'

export type AbandonedCartChartPoint = {
  date: string
  label: string
  abandoned: number
  recovered: number
}

export type EmailStageCount = {
  stage: number
  label: string
  sent: number
  opened: number
  clicked: number
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
  // Use local date components so keys line up with the local-midnight
  // day buckets below regardless of the server timezone.
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function formatDateLabel(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

const EMAIL_STAGE_LABELS: Record<number, string> = {
  1: '1 hour (Stage 1)',
  2: '24 hours (Stage 2)',
  3: '48 hours (Stage 3)',
}

/**
 * The stage an abandoned-cart `EmailLog` row belongs to.
 *
 * `metadata` is untyped JSON the send path wrote, so a row from an older send, a hand-inserted
 * row or a future change of shape must produce no stage rather than a `NaN` bucket.
 */
export function emailStage(metadata: unknown): number | null {
  if (typeof metadata !== 'object' || metadata === null) return null

  const stage = (metadata as Record<string, unknown>).stage
  const parsed = typeof stage === 'number' ? stage : Number(stage)

  return Number.isInteger(parsed) && parsed >= 1 && parsed <= FINAL_STAGE ? parsed : null
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
    recoveryEmails,
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
      },
      orderBy: { createdAt: 'asc' },
    }),
    // One row per email actually sent, tagged with its stage by the cron. Grouping carts by
    // their current `emailStage` instead would count a cart once — in its latest stage only —
    // so stage 1's total would shrink every time a cart moved on to stage 2.
    prisma.emailLog.findMany({
      where: {
        createdAt: createdAtRange,
        metadata: { path: ['type'], equals: ABANDONED_CART_EMAIL_TYPE },
      },
      select: { metadata: true, openedAt: true, clickedAt: true },
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

  const extractSum = (value: unknown, field: 'quantity' | 'totalPrice'): number =>
    typeof value === 'object' && value !== null && field in (value as Record<string, unknown>)
      ? Number((value as Record<string, unknown>)[field] || 0)
      : 0

  const extractCountByField = (value: unknown, field: string): number =>
    typeof value === 'object' && value !== null && field in (value as Record<string, unknown>)
      ? Number((value as Record<string, unknown>)[field] || 0)
      : 0

  const totalAbandoned = abandonedCarts.length

  // Count carts that converted into a paid order (attributed via
  // abandonedCartId) rather than carts whose recovery link was merely
  // clicked. recoveredAt is set on link-click before payment, so basing
  // the recovery rate on it overstates recoveries.
  const convertedCartIds = new Set(
    (recoveredOrders as unknown as Array<{ abandonedCartId: string | null }>)
      .map((order) => order.abandonedCartId)
      .filter((id): id is string => Boolean(id))
  )
  const totalRecovered = convertedCartIds.size
  const recoveryRate = totalAbandoned === 0 ? 0 : (totalRecovered / totalAbandoned) * 100

  const attributedRevenue = recoveredOrders.reduce((sum, order) => sum + Number(order.total || 0), 0)

  // Opens and clicks are written onto these rows by the Resend webhook, so the sequence
  // reports what recipients did with it rather than only how many emails left the building.
  const emailsByStage: EmailStageCount[] = Array.from(
    { length: FINAL_STAGE },
    (_unused, index) => ({
      stage: index + 1,
      label: EMAIL_STAGE_LABELS[index + 1] || `Stage ${index + 1}`,
      sent: 0,
      opened: 0,
      clicked: 0,
    })
  )

  for (const email of recoveryEmails) {
    const stage = emailStage(email.metadata)
    const row = stage === null ? undefined : emailsByStage[stage - 1]
    if (!row) continue

    row.sent += 1
    if (email.openedAt) row.opened += 1
    if (email.clickedAt) row.clicked += 1
  }

  const emailsSent = emailsByStage.reduce((sum, row) => sum + row.sent, 0)

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
    const bucket = dayBuckets.get(toDateKey(cart.createdAt))
    if (bucket) bucket.abandoned += 1
  })

  // A recovery belongs to the day the shopper came back and paid, not the day they walked away.
  // Keying it off the cart's `createdAt` plotted a cart abandoned on Monday and bought on Friday
  // as a Friday-less Monday recovery, and dropped any cart abandoned before the range entirely.
  const countedCartIds = new Set<string>()
  const orderRecoveries = recoveredOrders as unknown as Array<{
    createdAt: Date
    abandonedCartId: string | null
  }>

  orderRecoveries
    .slice()
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .forEach((order) => {
      if (!order.abandonedCartId || countedCartIds.has(order.abandonedCartId)) return
      countedCartIds.add(order.abandonedCartId)

      const bucket = dayBuckets.get(toDateKey(order.createdAt))
      if (bucket) bucket.recovered += 1
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
