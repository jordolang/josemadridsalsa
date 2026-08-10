import type { Metadata } from 'next'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { GrowthDashboardView } from '@/components/dashboard/growth-dashboard'
import { SALES_ONLY } from '@/lib/orders/sales-population'
import {
  bucketByMonth,
  bucketCustomerGrowth,
  lastMonths,
  seriesStart,
} from '@/lib/analytics/monthly-series'

export const metadata: Metadata = {
  title: 'Growth Dashboard | Jose Madrid Salsa Admin',
  description: 'Business growth metrics and trends',
}

async function getGrowthData() {
  const months = lastMonths(12)
  const windowStart = seriesStart(months)

  // A sale, excluding cancellations and exchange replacements. Shared by every figure below so
  // the tiles and the charts cannot disagree about what counts.
  const soldOrders: Prisma.OrderWhereInput = {
    ...SALES_ONLY,
    status: { not: 'CANCELLED' },
  }

  const [
    ordersInWindow,
    signupsInWindow,
    customersBeforeWindow,
    totalStats,
    topProductGroups,
  ] = await Promise.all([
    prisma.order.findMany({
      where: { ...soldOrders, createdAt: { gte: windowStart } },
      select: { createdAt: true, total: true },
    }),
    prisma.user.findMany({
      where: { createdAt: { gte: windowStart } },
      select: { createdAt: true },
    }),
    // Counted once instead of a correlated subquery per month, which is what the SQL this
    // replaced did — twelve full scans of `users` to draw one line.
    prisma.user.count({ where: { createdAt: { lt: windowStart } } }),
    Promise.all([
      prisma.order.count({ where: soldOrders }),
      prisma.order.aggregate({ _sum: { total: true }, where: soldOrders }),
      prisma.user.count(),
      prisma.product.count({ where: { isActive: true } }),
      prisma.retailLocation.count(),
      prisma.review.count(),
      prisma.review.aggregate({ _avg: { rating: true } }),
    ]),
    prisma.orderItem.groupBy({
      by: ['productName'],
      where: { order: soldOrders },
      _sum: { quantity: true, totalPrice: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10,
    }),
  ])

  const [totalOrders, revenueAgg, totalCustomers, totalProducts, totalLocations, totalReviews, avgRating] = totalStats

  const revenueSeries = bucketByMonth(
    ordersInWindow.map((order) => ({ createdAt: order.createdAt, amount: Number(order.total) })),
    months
  )

  return {
    monthlyRevenue: revenueSeries.map((m) => ({ month: m.month, revenue: m.total, orders: m.count })),
    monthlyCustomers: bucketCustomerGrowth(
      signupsInWindow.map((user) => user.createdAt),
      months,
      customersBeforeWindow
    ),
    totals: { orders: totalOrders, revenue: Number(revenueAgg._sum.total || 0), customers: totalCustomers, products: totalProducts, locations: totalLocations, reviews: totalReviews, avgRating: Number(avgRating._avg.rating || 0) },
    topProducts: topProductGroups.map((row) => ({
      name: row.productName,
      unitsSold: row._sum.quantity ?? 0,
      revenue: Number(row._sum.totalPrice ?? 0),
    })),
    // The same orders the revenue chart counts, so the two charts cannot disagree.
    ordersByMonth: revenueSeries.map((m) => ({ month: m.month, count: m.count })),
  }
}

export default async function GrowthDashboardPage() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'analytics:read'))) {
    redirect('/admin')
  }

  const data = await getGrowthData()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Growth Dashboard</h1>
        <p className="text-sm text-muted-foreground">Business performance metrics and trends</p>
      </div>
      <GrowthDashboardView data={data} />
    </div>
  )
}
