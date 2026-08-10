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
import { OperationalQueues } from '@/components/admin/dashboard/OperationalQueues'
import {
  activeInventoryAlertsWhere,
  needsShippingWhere,
  openReturnsWhere,
  paymentFailedWhere,
  pendingFundraiserSignupsWhere,
  pendingWholesaleWhere,
  stuckPendingWhere,
  STUCK_PENDING_MINUTES,
  type QueueCounts,
} from '@/lib/admin/operational-queues'
import { SalesOverview } from '@/components/admin/SalesOverview'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { SALES_ONLY } from '@/lib/orders/sales-population'
import {
  bucketByMonth,
  bucketCustomerGrowth,
  lastMonths,
  seriesStart,
} from '@/lib/analytics/monthly-series'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import Link from 'next/link'
import { RecentActivityFeed } from '@/components/admin/dashboard/RecentActivityFeed'
import { TopProductsTable } from '@/components/admin/dashboard/TopProductsTable'
import { OrderStatusBreakdown } from '@/components/admin/dashboard/OrderStatusBreakdown'
import { InventoryAlertWidget } from '@/components/admin/dashboard/InventoryAlertWidget'
import { CustomerGrowthChart } from '@/components/admin/dashboard/CustomerGrowthChart'
import { QuickActionsGrid } from '@/components/admin/dashboard/QuickActionsGrid'
import { getOrderStatusVariant } from '@/lib/order-status'

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

    // Six months of buckets, and the definition of a sale, resolved once so the charts and the
    // tiles below cannot end up counting different things.
    const dashboardMonths = lastMonths(6, now)
    const dashboardSoldOrders: Prisma.OrderWhereInput = {
      ...SALES_ONLY,
      status: { not: 'CANCELLED' },
    }

    const [revenue, avgRating, newUsersThisMonth, monthlyOrders, topProductRows, recentActivityData, signupsInWindow, customersBeforeWindow] = await Promise.all([
      prisma.order.aggregate({ _sum: { total: true }, where: dashboardSoldOrders }),
      prisma.review.aggregate({ _avg: { rating: true } }),
      prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.order.findMany({
        where: { ...dashboardSoldOrders, createdAt: { gte: seriesStart(dashboardMonths) } },
        select: { createdAt: true, total: true },
      }),
      prisma.orderItem.groupBy({
        by: ['productName'],
        where: { order: dashboardSoldOrders },
        _sum: { quantity: true, totalPrice: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
      Promise.all([
        prisma.order.findMany({
          take: 3, orderBy: { createdAt: 'desc' },
          select: { orderNumber: true, total: true, createdAt: true, guestEmail: true, user: { select: { name: true } } },
        }),
        prisma.user.findMany({ take: 2, orderBy: { createdAt: 'desc' }, select: { email: true, createdAt: true } }),
        prisma.review.findMany({ take: 2, orderBy: { createdAt: 'desc' }, select: { rating: true, createdAt: true, product: { select: { name: true } } } }),
      ]),
      prisma.user.findMany({
        where: { createdAt: { gte: seriesStart(dashboardMonths) } },
        select: { createdAt: true },
      }),
      prisma.user.count({ where: { createdAt: { lt: seriesStart(dashboardMonths) } } }),
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
      monthlySales: bucketByMonth(
        monthlyOrders.map((order) => ({ createdAt: order.createdAt, amount: Number(order.total) })),
        dashboardMonths,
        'short'
      ).map((m) => ({ month: m.month, sales: m.total, orders: m.count })),
      topProducts: topProductRows.map((row) => ({
        name: row.productName,
        sold: row._sum.quantity ?? 0,
        revenue: Number(row._sum.totalPrice ?? 0),
      })),
      activityFeed,
      customerGrowth: bucketCustomerGrowth(
        signupsInWindow.map((user) => user.createdAt),
        dashboardMonths,
        customersBeforeWindow,
        'short'
      ).map((m) => ({ month: m.month, customers: m.totalCustomers, newCustomers: m.newCustomers })),
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

/**
 * Counts for the operational queues. Each uses the same `where` clause as the page it links
 * to, so the number on a card and the rows behind it cannot drift apart.
 *
 * A queue that cannot be counted (a missing table on a partially migrated environment, say)
 * reports zero rather than taking the whole dashboard down with it.
 */
async function getOperationalQueueCounts(): Promise<QueueCounts> {
  const stuckSince = new Date(Date.now() - STUCK_PENDING_MINUTES * 60 * 1000)

  const [
    needsShipping,
    paymentFailed,
    stuckPending,
    openReturns,
    inventoryAlerts,
    fundraiserSignups,
    wholesaleApplications,
  ] = await Promise.all([
    prisma.order.count({ where: needsShippingWhere }).catch(() => 0),
    prisma.order.count({ where: paymentFailedWhere }).catch(() => 0),
    prisma.order.count({ where: stuckPendingWhere(stuckSince) }).catch(() => 0),
    prisma.returnRequest.count({ where: openReturnsWhere }).catch(() => 0),
    prisma.inventoryAlert.count({ where: activeInventoryAlertsWhere }).catch(() => 0),
    prisma.fundraiserSignupRequest.count({ where: pendingFundraiserSignupsWhere }).catch(() => 0),
    prisma.wholesaleAccount.count({ where: pendingWholesaleWhere }).catch(() => 0),
  ])

  return {
    needsShipping,
    paymentFailed,
    stuckPending,
    openReturns,
    inventoryAlerts,
    fundraiserSignups,
    wholesaleApplications,
  }
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
      PENDING: { color: 'bg-amber-500', bgColor: 'bg-muted text-muted-foreground' },
      PROCESSING: { color: 'bg-primary', bgColor: 'bg-primary/5 text-primary' },
      SHIPPED: { color: 'bg-purple-500', bgColor: 'bg-purple-50 text-purple-700' },
      DELIVERED: { color: 'bg-emerald-500', bgColor: 'bg-primary/5 text-primary' },
      CANCELLED: { color: 'bg-destructive', bgColor: 'bg-destructive/10 text-destructive' },
      REFUNDED: { color: 'bg-muted/500', bgColor: 'bg-muted/50 text-foreground' },
    }

    const orderStatusData = stats.ordersByStatus.map((s) => ({
      status: s.status.charAt(0) + s.status.slice(1).toLowerCase(),
      count: s.count,
      color: statusColorMap[s.status]?.color ?? 'bg-muted/500',
      bgColor: statusColorMap[s.status]?.bgColor ?? 'bg-muted/50 text-foreground',
    }))

    const queueCounts = await getOperationalQueueCounts()

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

        {/* What needs doing right now — every tile links into the list it counts.
            Performance figures stay below, and in /admin/analytics. */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Needs attention</h2>
            <Link
              href="/admin/analytics"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Performance &rarr;
            </Link>
          </div>
          <OperationalQueues counts={queueCounts} />
        </section>

        {/* Stats Grid - Row 1 */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {canViewFinancials && (
            <StatsCard
              title="Total Revenue"
              href="/admin/analytics/orders"
              value={`$${Number(stats.revenue).toLocaleString()}`}
              icon={DollarSign}
              color="green"
            />
          )}
          {canViewOrders && (
            <StatsCard
              title="Total Orders"
              href="/admin/orders"
              value={stats.totalOrders.toLocaleString()}
              icon={ShoppingCart}
              color="blue"
            />
          )}
          <StatsCard
            title="Total Customers"
              href="/admin/customers"
            value={stats.totalUsers.toLocaleString()}
            icon={Users}
            color="purple"
            subtitle={`${stats.newUsersThisMonth} new this month`}
          />
          <StatsCard
            title="Products"
              href="/admin/products"
            value={stats.totalProducts.toLocaleString()}
            icon={Package}
            color="orange"
          />
        </div>

        {/* Stats Grid - Row 2 (secondary stats) */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Store Locations"
              href="/admin/locations"
            value={stats.totalLocations.toLocaleString()}
            icon={MapPin}
            color="red"
            subtitle="Active retail locations"
          />
          <StatsCard
            title="Avg Rating"
              href="/admin/reviews"
            value={stats.avgRating > 0 ? stats.avgRating.toFixed(1) : 'N/A'}
            icon={Star}
            color="teal"
            subtitle={`${stats.totalReviews} total reviews`}
          />
          {canViewFinancials && (
            <StatsCard
              title="Avg Order Value"
              href="/admin/analytics/orders"
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
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.recentOrders.slice(0, 7).map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">
                            <Link
                              href={`/admin/orders/${order.id}`}
                              className="text-primary hover:underline"
                            >
                              {order.orderNumber}
                            </Link>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {order.user?.name || order.guestEmail || 'Guest'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getOrderStatusVariant(order.status)}>
                              {order.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            ${Number(order.total).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <Avatar className="size-10">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {(u.name?.charAt(0) || u.email.charAt(0)).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {u.name || 'New User'}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
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
