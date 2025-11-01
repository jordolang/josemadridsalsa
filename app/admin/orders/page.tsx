import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Download, Eye, Search } from 'lucide-react'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface SearchParams {
  search?: string
  status?: string
  page?: string
}

async function getOrders(searchParams: SearchParams) {
  const page = Number(searchParams.page) || 1
  const limit = 50
  const skip = (page - 1) * limit

  const where: any = {}

  // Search filter
  if (searchParams.search) {
    where.OR = [
      { orderNumber: { contains: searchParams.search, mode: 'insensitive' } },
      { guestEmail: { contains: searchParams.search, mode: 'insensitive' } },
      {
        user: {
          OR: [
            { email: { contains: searchParams.search, mode: 'insensitive' } },
            { name: { contains: searchParams.search, mode: 'insensitive' } },
          ],
        },
      },
    ]
  }

  // Status filter
  if (searchParams.status && searchParams.status !== 'all') {
    where.status = searchParams.status
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        items: {
          select: {
            id: true,
          },
        },
      },
    }),
    prisma.order.count({ where }),
  ])

  return {
    orders,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  }
}

const statusColors = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  PROCESSING: 'bg-purple-100 text-purple-800',
  SHIPPED: 'bg-indigo-100 text-indigo-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  REFUNDED: 'bg-gray-100 text-gray-800',
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'orders:read'))) {
    redirect('/admin')
  }

  const canExport = await hasPermission(user, 'orders:export')
  const { orders, total, page, totalPages } = await getOrders(searchParams)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Orders</h1>
          <p className="text-slate-600">
            Manage and track all customer orders
          </p>
        </div>
        {canExport && (
          <Button variant="outline" asChild>
            <a href="/api/admin/orders/export">
              <Download className="mr-2 h-4 w-4" />
              Export
            </a>
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="search"
              placeholder="Search by order number, customer..."
              defaultValue={searchParams.search}
              name="search"
              className="pl-9"
            />
          </div>
          <Select defaultValue={searchParams.status || 'all'}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="CONFIRMED">Confirmed</SelectItem>
              <SelectItem value="PROCESSING">Processing</SelectItem>
              <SelectItem value="SHIPPED">Shipped</SelectItem>
              <SelectItem value="DELIVERED">Delivered</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
              <SelectItem value="REFUNDED">Refunded</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Orders Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">
                  Order
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">
                  Items
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">
                  Date
                </th>
                <th className="px-6 py-3 text-right text-sm font-medium text-slate-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    No orders found
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {order.user?.name || order.guestEmail || 'Guest'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">
                      ${Number(order.total).toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          statusColors[order.status as keyof typeof statusColors]
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/orders/${order.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-6 py-4">
            <p className="text-sm text-slate-600">
              Showing {(page - 1) * 50 + 1} to {Math.min(page * 50, total)} of{' '}
              {total} orders
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/admin/orders?page=${page - 1}${searchParams.status ? `&status=${searchParams.status}` : ''}${searchParams.search ? `&search=${searchParams.search}` : ''}`}>
                    Previous
                  </Link>
                </Button>
              )}
              {page < totalPages && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/admin/orders?page=${page + 1}${searchParams.status ? `&status=${searchParams.status}` : ''}${searchParams.search ? `&search=${searchParams.search}` : ''}`}>
                    Next
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
