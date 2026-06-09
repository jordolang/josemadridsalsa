import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getDateRange } from '@/lib/analytics/date-range'
import type { AnalyticsRangeKey } from '@/lib/analytics/date-range'

export type ChartPoint = {
  date: string
  label: string
  orders: number
  revenue: number
}

export type TopProduct = {
  productId: string
  name: string
  orders: number
  quantity: number
  revenue: number
  sku: string
  imageUrl: string | null
  heatLevel: string | null
}

export type CountRecord = {
  label: string
  count: number
}

export type AnalyticsOverview = {
  summary: {
    revenue: number
    orders: number
    averageOrderValue: number
    conversionRate: number
    sessions: number
    addToCart: number
    purchaseEvents: number
  }
  chart: ChartPoint[]
  orderStatus: Array<{ status: string; count: number }>
  topProducts: TopProduct[]
  topPages: CountRecord[]
  trafficSources: CountRecord[]
  topCountries: CountRecord[]
  recentEvents: Array<{
    id: string
    type: string
    page: string | null
    action: string | null
    createdAt: Date
  }>
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

export async function getAnalyticsData(range: AnalyticsRangeKey): Promise<AnalyticsOverview> {
  const { start, end, days } = getDateRange(range)
  const createdAtRange = { gte: start, lte: end }

  const excludedStatuses: OrderStatus[] = [OrderStatus.CANCELLED, OrderStatus.REFUNDED]
  const includedPayments: PaymentStatus[] = [PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED]

  const orderFilter: Prisma.OrderWhereInput = {
    createdAt: createdAtRange,
    status: { notIn: excludedStatuses },
    paymentStatus: { in: includedPayments },
  }

  const [
    orderList,
    sessionRecords,
    addToCartCount,
    purchaseEvents,
    orderStatus,
    topProductsRaw,
    topPagesRaw,
    trafficSourcesRaw,
    topCountriesRaw,
    recentEvents,
  ] = await Promise.all([
    prisma.order.findMany({
      where: orderFilter,
      select: {
        id: true,
        total: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.analytics.findMany({
      where: {
        createdAt: createdAtRange,
        sessionId: { not: null },
      },
      distinct: ['sessionId'],
      select: { sessionId: true },
    }),
    prisma.analytics.count({
      where: {
        createdAt: createdAtRange,
        type: 'ADD_TO_CART',
      },
    }),
    prisma.analytics.count({
      where: {
        createdAt: createdAtRange,
        type: 'PURCHASE',
      },
    }),
    prisma.order.groupBy({
      by: ['status'],
      where: orderFilter,
      _count: { _all: true },
    }),
    prisma.orderItem.groupBy({
      by: ['productId', 'productName'],
      where: {
        order: orderFilter,
      },
      _sum: {
        totalPrice: true,
        quantity: true,
      },
      _count: { _all: true },
      orderBy: {
        _sum: { totalPrice: 'desc' },
      },
      take: 10,
    }),
    prisma.analytics.groupBy({
      by: ['page'],
      where: {
        createdAt: createdAtRange,
        type: 'PAGE_VIEW',
        page: { not: null },
      },
      _count: { _all: true },
    }),
    prisma.analytics.groupBy({
      by: ['label'],
      where: {
        createdAt: createdAtRange,
        type: 'PAGE_VIEW',
        label: { not: null },
      },
      _count: { _all: true },
    }),
    prisma.analytics.groupBy({
      by: ['country'],
      where: {
        createdAt: createdAtRange,
        country: { not: null },
      },
      _count: { _all: true },
    }),
    prisma.analytics.findMany({
      where: {
        createdAt: createdAtRange,
      },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: {
        id: true,
        type: true,
        page: true,
        action: true,
        createdAt: true,
      },
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

  const totalRevenue = orderList.reduce((sum, order) => sum + Number(order.total || 0), 0)
  const totalOrders = orderList.length
  const averageOrderValue = totalOrders === 0 ? 0 : totalRevenue / totalOrders

  const sessions = sessionRecords.length
  const conversionRate = sessions === 0 ? 0 : (purchaseEvents / sessions) * 100

  const dayBuckets = new Map<string, ChartPoint>()
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(end)
    date.setDate(end.getDate() - offset)
    date.setHours(0, 0, 0, 0)
    const key = toDateKey(date)
    dayBuckets.set(key, {
      date: key,
      label: formatDateLabel(date),
      orders: 0,
      revenue: 0,
    })
  }

  orderList.forEach((order) => {
    const key = toDateKey(order.createdAt)
    const bucket = dayBuckets.get(key)
    if (bucket) {
      bucket.orders += 1
      bucket.revenue += Number(order.total || 0)
    }
  })

  const chart = Array.from(dayBuckets.values()).sort((a, b) => (a.date < b.date ? -1 : 1))

  // Fetch product details for images, SKU, and heat level
  const productIds = topProductsRaw.map((item) => item.productId)
  const productDetails = productIds.length > 0
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, sku: true, heatLevel: true, featuredImage: true },
      })
    : []
  const productDetailsMap = new Map(productDetails.map((p) => [p.id, p]))

  const topProducts: TopProduct[] = topProductsRaw.map((item) => {
    const details = productDetailsMap.get(item.productId)
    return {
      productId: item.productId,
      name: item.productName,
      orders: extractCount(item._count),
      quantity: extractSum(item._sum, 'quantity'),
      revenue: extractSum(item._sum, 'totalPrice'),
      sku: details?.sku ?? '',
      imageUrl: details?.featuredImage ?? null,
      heatLevel: details?.heatLevel ?? null,
    }
  })

  const topPages: CountRecord[] = topPagesRaw
    .sort((a, b) => extractCount(b._count) - extractCount(a._count))
    .slice(0, 5)
    .map((item) => ({
      label: item.page || 'Unknown',
      count: extractCount(item._count),
    }))

  const trafficSources: CountRecord[] = trafficSourcesRaw
    .sort((a, b) => extractCount(b._count) - extractCount(a._count))
    .slice(0, 5)
    .map((item) => ({
      label: item.label || 'Direct',
      count: extractCount(item._count),
    }))

  const topCountries: CountRecord[] = topCountriesRaw
    .sort((a, b) => extractCount(b._count) - extractCount(a._count))
    .slice(0, 5)
    .map((item) => ({
      label: item.country || 'Unknown',
      count: extractCount(item._count),
    }))

  return {
    summary: {
      revenue: totalRevenue,
      orders: totalOrders,
      averageOrderValue,
      conversionRate,
      sessions,
      addToCart: addToCartCount,
      purchaseEvents,
    },
    chart,
    orderStatus: orderStatus.map((item) => ({
      status: item.status,
      count: extractCount(item._count),
    })),
    topProducts,
    topPages,
    trafficSources,
    topCountries,
    recentEvents: recentEvents.map((event) => ({
      id: event.id,
      type: event.type,
      page: event.page,
      action: event.action,
      createdAt: event.createdAt,
    })),
  }
}
