import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Mail, Phone, Calendar, Shield, Edit } from 'lucide-react'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const roleColors: Record<string, string> = {
  CUSTOMER: 'bg-blue-100 text-blue-800',
  STAFF: 'bg-purple-100 text-purple-800',
  ADMIN: 'bg-red-100 text-red-800',
  DEVELOPER: 'bg-orange-100 text-orange-800',
  WHOLESALE: 'bg-teal-100 text-teal-800',
}

const orderStatusInfo: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  CONFIRMED: { label: 'Confirmed', color: 'bg-blue-100 text-blue-800' },
  PROCESSING: { label: 'Processing', color: 'bg-purple-100 text-purple-800' },
  SHIPPED: { label: 'Shipped', color: 'bg-indigo-100 text-indigo-800' },
  DELIVERED: { label: 'Delivered', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
  REFUNDED: { label: 'Refunded', color: 'bg-gray-100 text-gray-800' },
}

async function getUserWithOrders(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
        },
      },
      addresses: true,
    },
  })

  return user
}

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const currentUser = await getCurrentUser()

  if (!currentUser || !(await hasPermission(currentUser, 'users:read'))) {
    redirect('/admin/users')
  }

  const user = await getUserWithOrders(id)

  if (!user) {
    notFound()
  }

  const canWrite = await hasPermission(currentUser, 'users:write')
  const totalSpent = user.orders.reduce((sum, order) => sum + Number(order.total), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/users">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{user.name || 'Unnamed User'}</h1>
            <p className="text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={roleColors[user.role] || 'bg-gray-100 text-gray-800'}>
            {user.role}
          </Badge>
          {canWrite && (
            <Button variant="outline" asChild>
              <Link href={`/admin/users/${user.id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Edit User
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* User Info Card */}
        <div className="space-y-6">
          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">User Information</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <span>{user.email}</span>
                  {user.isEmailVerified ? (
                    <Badge variant="outline" className="text-green-600 border-green-300 text-xs">Verified</Badge>
                  ) : (
                    <Badge variant="outline" className="text-yellow-600 border-yellow-300 text-xs">Unverified</Badge>
                  )}
                </div>
                {user.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-slate-400" />
                    <span>{user.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="h-4 w-4 text-slate-400" />
                  <span>Role: {user.role}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                </div>
                {user.lastLoginAt && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <span>Last login {new Date(user.lastLoginAt).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Stats Card */}
          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">Order Summary</h2>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Orders</span>
                  <span className="font-medium">{user.orders.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Spent</span>
                  <span className="font-medium">${totalSpent.toFixed(2)}</span>
                </div>
                {user.orders.length > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Average Order</span>
                    <span className="font-medium">
                      ${(totalSpent / user.orders.length).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Order History */}
        <div className="lg:col-span-2">
          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">Order History</h2>
              {user.orders.length === 0 ? (
                <p className="text-muted-foreground text-sm">No orders found for this user.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-3 font-medium text-muted-foreground">Order</th>
                        <th className="pb-3 font-medium text-muted-foreground">Date</th>
                        <th className="pb-3 font-medium text-muted-foreground">Status</th>
                        <th className="pb-3 font-medium text-muted-foreground">Items</th>
                        <th className="pb-3 font-medium text-muted-foreground text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {user.orders.map((order) => {
                        const status = orderStatusInfo[order.status] || {
                          label: order.status,
                          color: 'bg-gray-100 text-gray-800',
                        }
                        return (
                          <tr key={order.id} className="border-b last:border-0">
                            <td className="py-3">
                              <Link
                                href={`/admin/orders/${order.id}`}
                                className="font-medium text-blue-600 hover:underline"
                              >
                                {order.orderNumber}
                              </Link>
                            </td>
                            <td className="py-3 text-muted-foreground">
                              {new Date(order.createdAt).toLocaleDateString()}
                            </td>
                            <td className="py-3">
                              <Badge className={status.color}>{status.label}</Badge>
                            </td>
                            <td className="py-3 text-muted-foreground">
                              {order.items.reduce((sum, item) => sum + item.quantity, 0)}
                            </td>
                            <td className="py-3 text-right font-medium">
                              ${Number(order.total).toFixed(2)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
