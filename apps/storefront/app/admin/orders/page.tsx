import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Download, Plus, Ship } from 'lucide-react'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { OrdersTableClient } from '@/components/admin/OrdersTableClient'
import { OrderFilters } from '@/components/admin/OrderFilters'
import { buildOrderWhere, parseOrderFilters } from '@/lib/orders/order-filters'
import { isNextControlFlowError } from '@/lib/next-errors'
import { MobileOrdersList } from '@/components/admin/mobile/MobileOrdersList'
import { BigCommerceNotice } from '@/components/admin/BigCommerceNotice'

type SearchParams = Record<string, string | undefined>

async function getOrders(searchParams: SearchParams) {
  try {
    const page = Number(searchParams.page) || 1
    const limit = 50
    const skip = (page - 1) * limit

    // The where clause comes from the shared filter module rather than being assembled
    // here, so the CSV export and the saved views describe exactly the same rows.
    const where = buildOrderWhere(parseOrderFilters(searchParams))

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
      fulfillmentStatus: order.fulfillmentStatus,
      salesChannel: order.salesChannel,
      total: order.total.toString(),
      createdAt: order.createdAt.toISOString(),
      customerName: order.user?.name || order.guestEmail || 'Guest',
      itemCount: order._count.items,
    }))

    // Paging and export both carry every active filter, so page 2 and the CSV always match
    // what is on screen.
    const filterQuery = new URLSearchParams(
      Object.entries(params).filter(
        ([key, value]) => key !== 'page' && typeof value === 'string' && value !== ''
      ) as [string, string][]
    )

    const buildPageHref = (targetPage: number) => {
      const qs = new URLSearchParams(filterQuery)
      qs.set('page', String(targetPage))
      return `/admin/orders?${qs.toString()}`
    }

    const exportHref = `/api/admin/orders/export${
      filterQuery.size ? `?${filterQuery.toString()}` : ''
    }`

    return (
    <>
    <div className="mb-4 md:mb-6">
      <BigCommerceNotice area="orders" />
    </div>
    <MobileOrdersList
      className="md:hidden"
      orders={orderRows}
      total={total}
      page={page}
      totalPages={totalPages}
      initialStatus={params.status ?? 'all'}
      initialSearch={params.search ?? ''}
    />
    <div className="hidden md:block space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground">
            Manage and track all customer orders
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/shipping">
              <Ship className="mr-2 size-4" />
              Ship Orders
            </Link>
          </Button>
          {canExport && (
            <Button variant="outline" asChild>
              <a href={exportHref}>
                <Download className="mr-2 size-4" />
                Export
              </a>
            </Button>
          )}
          {canWrite && (
            <Button asChild>
              <Link href="/admin/orders/new">
                <Plus className="mr-2 size-4" />
                New order
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <OrderFilters />

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
    </>
    )
  } catch (error) {
    // redirect() and notFound() signal themselves by throwing; re-wrapping those in a plain
    // Error strips the marker Next.js dispatches on, so the permission redirect above was
    // being turned into a render failure instead of a redirect.
    if (isNextControlFlowError(error)) throw error

    console.error('[Orders] Error rendering:', error)
    throw new Error(error instanceof Error ? error.message : 'Failed to load orders page')
  }
}
