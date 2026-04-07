import {
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  TrendingUp,
  MapPin,
  Star,
  Eye,
} from 'lucide-react'
import { StatsCard } from '@/components/admin/StatsCard'
import { SalesOverview } from '@/components/admin/SalesOverview'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { RecentActivityFeed } from '@/components/admin/dashboard/RecentActivityFeed'
import { TopProductsTable } from '@/components/admin/dashboard/TopProductsTable'
import { OrderStatusBreakdown } from '@/components/admin/dashboard/OrderStatusBreakdown'
import { InventoryAlertWidget } from '@/components/admin/dashboard/InventoryAlertWidget'
import { CustomerGrowthChart } from '@/components/admin/dashboard/CustomerGrowthChart'
import { QuickActionsGrid } from '@/components/admin/dashboard/QuickActionsGrid'

async function getDashboardStats() {
  try {
    const [
      totalOrders,
      totalUsers,
      totalProducts,
      totalLocations,
      totalReviews,
      recentOrders,
      lowStockProducts,
      recentUsers,
      ordersByStatus,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.user.count(),
      prisma.product.count(),
      prisma.retailLocation.count(),
      prisma.review.count(),
      prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, email: true } },
        },
      }),
      prisma.product.findMany({
        where: { inventory: { lte: 10 }, isActive: true },
        select: { name: true, sku: true, inventory: true, lowStockThreshold: true },
        orderBy: { inventory: 'asc' },
        take: 5,
      }),
      prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { name: true, email: true, createdAt: true },
      }),
      prisma.order.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
    ])

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [revenue, avgRating, newUsersThisMonth, monthlySales, topProductRows, recentActivityData, monthlyCustomerGrowth] = await Promise.all([
      prisma.order.aggregate({ _sum: { total: true }, where: { status: { not: 'CANCELLED' } } }),
      prisma.review.aggregate({ _avg: { rating: true } }),
      prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.$queryRaw<Array<{ month: string; sales: number; orders: number }>>`
        SELECT
          to_char(date_trunc('month', "createdAt"), 'Mon') AS month,
          COALESCE(SUM(CASE WHEN status != 'CANCELLED' THEN total ELSE 0 END), 0)::float AS sales,
          COUNT(*)::int AS orders
        FROM orders
        WHERE "createdAt" >= date_trunc('month', NOW()) - interval '6 months'
        GROUP BY date_trunc('month', "createdAt")
        ORDER BY date_trunc('month', "createdAt") ASC
      `,
      prisma.$queryRaw<Array<{ name: string; sold: number; revenue: number }>>`
        SELECT
          oi."productName" AS name,
          SUM(oi.quantity)::int AS sold,
          SUM(oi."totalPrice")::float AS revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi."orderId"
        WHERE o.status != 'CANCELLED'
        GROUP BY oi."productName"
        ORDER BY sold DESC
        LIMIT 5
      `,
      Promise.all([
        prisma.order.findMany({
          take: 3, orderBy: { createdAt: 'desc' },
          select: { orderNumber: true, total: true, createdAt: true, guestEmail: true, user: { select: { name: true } } },
        }),
        prisma.user.findMany({ take: 2, orderBy: { createdAt: 'desc' }, select: { email: true, createdAt: true } }),
        prisma.review.findMany({ take: 2, orderBy: { createdAt: 'desc' }, select: { rating: true, createdAt: true, product: { select: { name: true } } } }),
      ]),
      prisma.$queryRaw<Array<{ month: string; customers: number; new_customers: number }>>`
        SELECT
          to_char(months.m, 'Mon') AS month,
          (SELECT COUNT(*) FROM users WHERE "createdAt" <= months.m + interval '1 month')::int AS customers,
          (SELECT COUNT(*) FROM users WHERE "createdAt" >= months.m AND "createdAt" < months.m + interval '1 month')::int AS new_customers
        FROM (
          SELECT generate_series(
            date_trunc('month', NOW()) - interval '6 months',
            date_trunc('month', NOW()),
            interval '1 month'
          ) AS m
        ) months
        ORDER BY months.m ASC
      `,
    ])

    const [latestOrders, latestUsers, latestReviews] = recentActivityData
    const activityFeed = [
      ...latestOrders.map((o: any) => ({
        id: `order-${o.orderNumber}`, type: 'order' as const,
        message: 'Order received', detail: `#${o.orderNumber} — $${Number(o.total).toFixed(2)}`,
        timestamp: formatTimeAgo(o.createdAt),
      })),
      ...latestUsers.map((u: any) => ({
        id: `user-${u.email}`, type: 'user' as const,
        message: 'New customer registered', detail: u.email,
        timestamp: formatTimeAgo(u.createdAt),
      })),
      ...latestReviews.map((r: any, i: number) => ({
        id: `review-${i}`, type: 'review' as const,
        message: `New ${r.rating}-star review`, detail: r.product.name,
        timestamp: formatTimeAgo(r.createdAt),
      })),
    ]

    return {
      totalOrders,
      totalUsers,
      totalProducts,
      totalLocations,
      totalReviews,
      revenue: revenue._sum.total || 0,
      avgRating: avgRating._avg.rating || 0,
      recentOrders,
      lowStockProducts,
      recentUsers,
      newUsersThisMonth,
      ordersByStatus: ordersByStatus.map((o) => ({
        status: o.status,
        count: o._count.id,
      })),
      monthlySales: monthlySales.map((m) => ({ month: m.month, sales: Number(m.sales), orders: Number(m.orders) })),
      topProducts: topProductRows.map((p) => ({ name: p.name, sold: Number(p.sold), revenue: Number(p.revenue) })),
      activityFeed,
      customerGrowth: monthlyCustomerGrowth.map((m) => ({ month: m.month, customers: Number(m.customers), newCustomers: Number(m.new_customers) })),
    }
  } catch (error) {
    console.error('[Admin Dashboard] Error fetching stats:', error)
    throw new Error('Failed to load dashboard statistics. Please check your database connection.')
  }
}

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - new Date(date).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDays = Math.floor(diffHr / 24)
  return `${diffDays}d ago`
}

export default async function AdminDashboard() {
  try {
    const user = await getCurrentUser()
    if (!user) return null

    const canViewFinancials = await hasPermission(user, 'financials:read')
    const canViewOrders = await hasPermission(user, 'orders:read')

    const stats = await getDashboardStats()

    // Map order status data
    const statusColorMap: Record<string, { color: string; bgColor: string }> = {
      PENDING: { color: 'bg-amber-500', bgColor: 'bg-amber-50 text-amber-700' },
      PROCESSING: { color: 'bg-blue-500', bgColor: 'bg-blue-50 text-blue-700' },
      SHIPPED: { color: 'bg-purple-500', bgColor: 'bg-purple-50 text-purple-700' },
      DELIVERED: { color: 'bg-emerald-500', bgColor: 'bg-emerald-50 text-emerald-700' },
      CANCELLED: { color: 'bg-red-500', bgColor: 'bg-red-50 text-red-700' },
      REFUNDED: { color: 'bg-slate-500', bgColor: 'bg-slate-50 text-slate-700' },
    }

    const orderStatusData = stats.ordersByStatus.map((s) => ({
      status: s.status.charAt(0) + s.status.slice(1).toLowerCase(),
      count: s.count,
      color: statusColorMap[s.status]?.color ?? 'bg-slate-500',
      bgColor: statusColorMap[s.status]?.bgColor ?? 'bg-slate-50 text-slate-700',
    }))

    // Map low stock inventory items
    const inventoryAlerts = stats.lowStockProducts.map((p) => ({
      name: p.name,
      sku: p.sku,
      stock: p.inventory,
      threshold: p.lowStockThreshold,
    }))

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Welcome back, {user.name || user.email}. Here&apos;s what&apos;s happening.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/analytics">View Analytics</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/admin/products/new">+ New Product</Link>
            </Button>
          </div>
        </div>

        {/* Stats Grid - Row 1 */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {canViewFinancials && (
            <StatsCard
              title="Total Revenue"
              value={`$${Number(stats.revenue).toLocaleString()}`}
              icon={DollarSign}
              color="green"
            />
          )}
          {canViewOrders && (
            <StatsCard
              title="Total Orders"
              value={stats.totalOrders.toLocaleString()}
              icon={ShoppingCart}
              color="blue"
            />
          )}
          <StatsCard
            title="Total Customers"
            value={stats.totalUsers.toLocaleString()}
            icon={Users}
            color="purple"
            subtitle={`${stats.newUsersThisMonth} new this month`}
          />
          <StatsCard
            title="Products"
            value={stats.totalProducts.toLocaleString()}
            icon={Package}
            color="orange"
          />
        </div>

        {/* Stats Grid - Row 2 (secondary stats) */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Store Locations"
            value={stats.totalLocations.toLocaleString()}
            icon={MapPin}
            color="red"
            subtitle="Active retail locations"
          />
          <StatsCard
            title="Avg Rating"
            value={stats.avgRating > 0 ? stats.avgRating.toFixed(1) : 'N/A'}
            icon={Star}
            color="teal"
            subtitle={`${stats.totalReviews} total reviews`}
          />
          {canViewFinancials && (
            <StatsCard
              title="Avg Order Value"
              value={
                stats.totalOrders > 0
                  ? `$${(Number(stats.revenue) / stats.totalOrders).toFixed(2)}`
                  : '$0'
              }
              icon={TrendingUp}
              color="blue"
            />
          )}
          <StatsCard
            title="Site Visitors"
            value="--"
            icon={Eye}
            color="purple"
            subtitle="Connect analytics to track"
          />
        </div>

        {/* Main Charts Row */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Sales Overview - takes 2/3 */}
          <div className="lg:col-span-2">
            {canViewFinancials && <SalesOverview data={stats.monthlySales.length > 0 ? stats.monthlySales : undefined} />}
          </div>
          {/* Order Status - takes 1/3 */}
          <div>
            <OrderStatusBreakdown
              data={orderStatusData.length > 0 ? orderStatusData : undefined}
              totalOrders={stats.totalOrders}
            />
          </div>
        </div>

        {/* Middle Row - 3 equal columns */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <TopProductsTable products={stats.topProducts.length > 0 ? stats.topProducts : undefined} />
          <RecentActivityFeed activities={stats.activityFeed.length > 0 ? stats.activityFeed : undefined} />
          <InventoryAlertWidget items={inventoryAlerts.length > 0 ? inventoryAlerts : undefined} />
        </div>

        {/* Bottom Row */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <CustomerGrowthChart data={stats.customerGrowth.length > 0 ? stats.customerGrowth : undefined} />
          </div>
          <div>
            <QuickActionsGrid />
          </div>
        </div>

        {/* Recent Orders */}
        {canViewOrders && stats.recentOrders.length > 0 && (
          <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">
                      Recent Orders
                    </CardTitle>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/admin/orders">View All</Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b text-left text-xs text-muted-foreground">
                          <th className="pb-3 font-medium">Order</th>
                          <th className="pb-3 font-medium">Customer</th>
                          <th className="pb-3 font-medium">Status</th>
                          <th className="pb-3 font-medium">Total</th>
                          <th className="pb-3 font-medium">Date</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {stats.recentOrders.slice(0, 7).map((order) => (
                          <tr
                            key={order.id}
                            className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                          >
                            <td className="py-2.5">
                              <Link
                                href={`/admin/orders/${order.id}`}
                                className="font-medium text-blue-600 hover:underline"
                              >
                                {order.orderNumber}
                              </Link>
                            </td>
                            <td className="py-2.5 text-muted-foreground">
                              {order.user?.name || order.guestEmail || 'Guest'}
                            </td>
                            <td className="py-2.5">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                  order.status === 'DELIVERED'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : order.status === 'CANCELLED'
                                    ? 'bg-red-50 text-red-700'
                                    : order.status === 'SHIPPED'
                                    ? 'bg-purple-50 text-purple-700'
                                    : order.status === 'PROCESSING'
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'bg-amber-50 text-amber-700'
                                }`}
                              >
                                {order.status}
                              </span>
                            </td>
                            <td className="py-2.5 font-medium">
                              ${Number(order.total).toFixed(2)}
                            </td>
                            <td className="py-2.5 text-muted-foreground">
                              {new Date(order.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
            </CardContent>
          </Card>
        )}

        {/* New Users */}
        {stats.recentUsers.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">
                  Newest Customers
                </CardTitle>
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/users">Manage Users</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {stats.recentUsers.map((u) => (
                  <div
                    key={u.email}
                    className="flex items-center gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white text-sm font-bold">
                      {(u.name?.charAt(0) || u.email.charAt(0)).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {u.name || 'New User'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    )
  } catch (error) {
    console.error('[Admin Dashboard] Error rendering:', error)
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Failed to load admin dashboard'
    )
  }
}
