import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { GrowthDashboardView } from '@/components/dashboard/growth-dashboard'

export const metadata: Metadata = {
  title: 'Growth Dashboard | Jose Madrid Salsa Admin',
  description: 'Business growth metrics and trends',
}

async function getGrowthData() {
  const [
    monthlyRevenue,
    monthlyCustomers,
    totalStats,
    topProducts,
    ordersByMonth,
  ] = await Promise.all([
    // Monthly revenue for last 12 months
    prisma.$queryRaw<Array<{ month: string; month_date: Date; revenue: number; orders: number }>>`
      SELECT
        to_char(date_trunc('month', "createdAt"), 'Mon YYYY') AS month,
        date_trunc('month', "createdAt") AS month_date,
        COALESCE(SUM(CASE WHEN status != 'CANCELLED' THEN total ELSE 0 END), 0)::float AS revenue,
        COUNT(CASE WHEN status != 'CANCELLED' THEN 1 END)::int AS orders
      FROM orders
      WHERE "createdAt" >= date_trunc('month', NOW()) - interval '11 months'
      GROUP BY date_trunc('month', "createdAt")
      ORDER BY date_trunc('month', "createdAt") ASC
    `,
    // Monthly new customers for last 12 months
    prisma.$queryRaw<Array<{ month: string; new_customers: number; total_customers: number }>>`
      SELECT
        to_char(months.m, 'Mon YYYY') AS month,
        (SELECT COUNT(*) FROM users WHERE "createdAt" >= months.m AND "createdAt" < months.m + interval '1 month')::int AS new_customers,
        (SELECT COUNT(*) FROM users WHERE "createdAt" < months.m + interval '1 month')::int AS total_customers
      FROM (
        SELECT generate_series(
          date_trunc('month', NOW()) - interval '11 months',
          date_trunc('month', NOW()),
          interval '1 month'
        ) AS m
      ) months
      ORDER BY months.m ASC
    `,
    // Totals
    Promise.all([
      prisma.order.count({ where: { status: { not: 'CANCELLED' } } }),
      prisma.order.aggregate({ _sum: { total: true }, where: { status: { not: 'CANCELLED' } } }),
      prisma.user.count(),
      prisma.product.count({ where: { isActive: true } }),
      prisma.retailLocation.count(),
      prisma.review.count(),
      prisma.review.aggregate({ _avg: { rating: true } }),
    ]),
    // Top selling products all-time
    prisma.$queryRaw<Array<{ name: string; units_sold: number; revenue: number }>>`
      SELECT
        oi."productName" AS name,
        SUM(oi.quantity)::int AS units_sold,
        SUM(oi."totalPrice")::float AS revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi."orderId"
      WHERE o.status != 'CANCELLED'
      GROUP BY oi."productName"
      ORDER BY units_sold DESC
      LIMIT 10
    `,
    // Orders per month for trend
    prisma.$queryRaw<Array<{ month: string; count: number }>>`
      SELECT
        to_char(date_trunc('month', "createdAt"), 'Mon YYYY') AS month,
        COUNT(*)::int AS count
      FROM orders
      WHERE "createdAt" >= date_trunc('month', NOW()) - interval '11 months'
        AND status != 'CANCELLED'
      GROUP BY date_trunc('month', "createdAt")
      ORDER BY date_trunc('month', "createdAt") ASC
    `,
  ])

  const [totalOrders, revenueAgg, totalCustomers, totalProducts, totalLocations, totalReviews, avgRating] = totalStats

  return {
    monthlyRevenue: monthlyRevenue.map((m) => ({
      month: m.month,
      revenue: Number(m.revenue),
      orders: Number(m.orders),
    })),
    monthlyCustomers: monthlyCustomers.map((m) => ({
      month: m.month,
      newCustomers: Number(m.new_customers),
      totalCustomers: Number(m.total_customers),
    })),
    totals: {
      orders: totalOrders,
      revenue: Number(revenueAgg._sum.total || 0),
      customers: totalCustomers,
      products: totalProducts,
      locations: totalLocations,
      reviews: totalReviews,
      avgRating: Number(avgRating._avg.rating || 0),
    },
    topProducts: topProducts.map((p) => ({
      name: p.name,
      unitsSold: Number(p.units_sold),
      revenue: Number(p.revenue),
    })),
    ordersByMonth: ordersByMonth.map((m) => ({
      month: m.month,
      count: Number(m.count),
    })),
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
        <p className="text-sm text-muted-foreground">
          Business performance metrics and trends
        </p>
      </div>
      <GrowthDashboardView data={data} />
    </div>
  )
}
