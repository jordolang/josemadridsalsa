import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Download, Search } from 'lucide-react'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
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

    const buildPageHref = (targetPage: number) => {
      const qs = new URLSearchParams()
      qs.set('page', String(targetPage))
      if (params.status) qs.set('status', params.status)
      if (params.search) qs.set('search', params.search)
      return `/admin/orders?${qs.toString()}`
    }

    return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground">
            Manage and track all customer orders
          </p>
        </div>
        {canExport && (
          <Button variant="outline" asChild>
            <a href="/api/admin/orders/export">
              <Download className="mr-2 size-4" />
              Export
            </a>
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
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
        </CardContent>
      </Card>

      {/* Orders Table with Bulk Actions */}
      <OrdersTableClient orders={orderRows} canWrite={canWrite} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * 50 + 1} to {Math.min(page * 50, total)} of{' '}
            {total} orders
          </p>
          <Pagination className="mx-0 w-auto justify-end">
            <PaginationContent>
              {page > 1 && (
                <PaginationItem>
                  <PaginationPrevious href={buildPageHref(page - 1)} />
                </PaginationItem>
              )}
              <PaginationItem>
                <PaginationLink href="#" isActive>
                  {page}
                </PaginationLink>
              </PaginationItem>
              {page < totalPages && (
                <PaginationItem>
                  <PaginationNext href={buildPageHref(page + 1)} />
                </PaginationItem>
              )}
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
    )
  } catch (error) {
    console.error('[Orders] Error rendering:', error)
    throw new Error(error instanceof Error ? error.message : 'Failed to load orders page')
  }
}
