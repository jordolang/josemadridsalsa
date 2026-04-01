import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Download, Search } from 'lucide-react'
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
import { OrdersTableClient } from '@/components/admin/OrdersTableClient'

interface SearchParams {
  search?: string
  status?: string
  page?: string
}

async function getOrders(searchParams: SearchParams) {
  try {
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
          _count: {
            select: { items: true },
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
  } catch (error) {
    console.error('[Orders] Error fetching orders:', error)
    throw new Error('Failed to load orders. Please check your database connection.')
  }
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  try {
    const params = await searchParams;
    const user = await getCurrentUser()

    if (!user || !(await hasPermission(user, 'orders:read'))) {
      redirect('/admin')
    }

    const [canExport, canWrite] = await Promise.all([
      hasPermission(user, 'orders:export'),
      hasPermission(user, 'orders:write'),
    ])
    const { orders, total, page, totalPages } = await getOrders(params)

    // Serialize orders for client component
    const orderRows = orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      total: order.total.toString(),
      createdAt: order.createdAt.toISOString(),
      customerName: order.user?.name || order.guestEmail || 'Guest',
      itemCount: order._count.items,
    }))

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
              defaultValue={params.search}
              name="search"
              className="pl-9"
            />
          </div>
          <Select defaultValue={params.status || 'all'}>
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

      {/* Orders Table with Bulk Actions */}
      <Card>
        <OrdersTableClient orders={orderRows} canWrite={canWrite} />

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
                  <Link href={`/admin/orders?page=${page - 1}${params.status ? `&status=${params.status}` : ''}${params.search ? `&search=${params.search}` : ''}`}>
                    Previous
                  </Link>
                </Button>
              )}
              {page < totalPages && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/admin/orders?page=${page + 1}${params.status ? `&status=${params.status}` : ''}${params.search ? `&search=${params.search}` : ''}`}>
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
  } catch (error) {
    console.error('[Orders] Error rendering:', error)
    throw new Error(error instanceof Error ? error.message : 'Failed to load orders page')
  }
}
