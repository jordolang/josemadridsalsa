import { Suspense } from 'react'
import {  DollarSign, ShoppingCart, Users, Package } from 'lucide-react'
import { StatsCard } from '@/components/admin/StatsCard'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

async function getDashboardStats() {
  const [
    totalOrders,
    totalUsers,
    totalProducts,
    recentOrders,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.user.count(),
    prisma.product.count(),
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
  ])

  // Calculate total revenue (simple sum for now)
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

  return {
    totalOrders,
    totalUsers,
    totalProducts,
    revenue: revenue._sum.total || 0,
    recentOrders,
  }
}

export default async function AdminDashboard() {
  const user = await getCurrentUser()
  if (!user) return null

  const canViewFinancials = await hasPermission(user, 'financials:read')
  const canViewOrders = await hasPermission(user, 'orders:read')

  const stats = await getDashboardStats()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-slate-600">
          Welcome back, {user.name || user.email}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {canViewFinancials && (
          <StatsCard
            title="Total Revenue"
            value={`$${Number(stats.revenue).toLocaleString()}`}
            icon={DollarSign}
            change={{ value: 12.5, trend: 'up' }}
          />
        )}
        {canViewOrders && (
          <StatsCard
            title="Total Orders"
            value={stats.totalOrders.toLocaleString()}
            icon={ShoppingCart}
            change={{ value: 8.3, trend: 'up' }}
          />
        )}
        <StatsCard
          title="Total Users"
          value={stats.totalUsers.toLocaleString()}
          icon={Users}
          change={{ value: 5.2, trend: 'up' }}
        />
        <StatsCard
          title="Total Products"
          value={stats.totalProducts.toLocaleString()}
          icon={Package}
        />
      </div>

      {/* Recent Orders */}
      {canViewOrders && stats.recentOrders.length > 0 && (
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Recent Orders</h2>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/orders">View All</Link>
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-slate-600">
                    <th className="pb-3 font-medium">Order #</th>
                    <th className="pb-3 font-medium">Customer</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Total</th>
                    <th className="pb-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {stats.recentOrders.map((order) => (
                    <tr key={order.id} className="border-b last:border-0">
                      <td className="py-3">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td className="py-3">
                        {order.user?.name || order.guestEmail || 'Guest'}
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                            order.status === 'DELIVERED'
                              ? 'bg-green-100 text-green-800'
                              : order.status === 'CANCELLED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="py-3 font-medium">
                        ${Number(order.total).toFixed(2)}
                      </td>
                      <td className="py-3 text-slate-600">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Button asChild variant="outline" className="justify-start">
              <Link href="/admin/products/new">+ New Product</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/admin/orders">View Orders</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/admin/users">Manage Users</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/admin/analytics">View Analytics</Link>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
