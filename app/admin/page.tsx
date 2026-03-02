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
import { TrafficSourcesChart } from '@/components/admin/dashboard/TrafficSourcesChart'
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
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.product.findMany({
        where: {
          inventory: { lte: 10 },
          isActive: true,
        },
        select: {
          name: true,
          sku: true,
          inventory: true,
          lowStockThreshold: true,
        },
        orderBy: { inventory: 'asc' },
        take: 5,
      }),
      prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          name: true,
          email: true,
          createdAt: true,
        },
      }),
      prisma.order.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
    ])

    // Calculate total revenue
    const revenue = await prisma.order.aggregate({
      _sum: {
        total: true,
      },
      where: {
        status: {
          not: 'CANCELLED',
        },
      },
    })

    // Calculate average review rating
    const avgRating = await prisma.review.aggregate({
      _avg: {
        rating: true,
      },
    })

    // New users this month
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    const newUsersThisMonth = await prisma.user.count({
      where: { createdAt: { gte: startOfMonth } },
    })

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
    }
  } catch (error) {
    console.error('[Admin Dashboard] Error fetching stats:', error)
    throw new Error('Failed to load dashboard statistics. Please check your database connection.')
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
              change={{ value: 12.5, trend: 'up' }}
              subtitle="vs last month"
            />
          )}
          {canViewOrders && (
            <StatsCard
              title="Total Orders"
              value={stats.totalOrders.toLocaleString()}
              icon={ShoppingCart}
              color="blue"
              change={{ value: 8.3, trend: 'up' }}
              subtitle="vs last month"
            />
          )}
          <StatsCard
            title="Total Customers"
            value={stats.totalUsers.toLocaleString()}
            icon={Users}
            color="purple"
            change={{ value: 5.2, trend: 'up' }}
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
              change={{ value: 3.8, trend: 'up' }}
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
            {canViewFinancials && <SalesOverview />}
          </div>
          {/* Traffic Sources - takes 1/3 */}
          <div>
            <TrafficSourcesChart />
          </div>
        </div>

        {/* Middle Row - 3 equal columns */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <OrderStatusBreakdown
            data={orderStatusData.length > 0 ? orderStatusData : undefined}
            totalOrders={stats.totalOrders}
          />
          <TopProductsTable />
          <RecentActivityFeed />
        </div>

        {/* Bottom Row */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <CustomerGrowthChart />
          </div>
          <div>
            <InventoryAlertWidget
              items={inventoryAlerts.length > 0 ? inventoryAlerts : undefined}
            />
          </div>
        </div>

        {/* Quick Actions + Recent Orders */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div>
            <QuickActionsGrid />
          </div>

          {/* Recent Orders */}
          {canViewOrders && stats.recentOrders.length > 0 && (
            <div className="lg:col-span-2">
              <Card className="h-full">
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
            </div>
          )}
        </div>

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
