import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Upload, Users } from 'lucide-react'
import Link from 'next/link'

import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import { CustomersFilter } from '@/components/admin/customers/CustomersFilter'
import { CustomersTable } from '@/components/admin/customers/CustomersTable'
import { SyncCustomersButton } from '@/components/admin/customers/SyncCustomersButton'
import { ExportButton } from '@/components/admin/shared/ExportButton'
import { createMetadata } from '@/lib/metadata'
import {
  buildCustomerOrderBy,
  buildCustomerWhere,
  resolvePage,
  resolvePageSize,
  resolveSortColumn,
  resolveSortDirection,
} from '@/lib/customers/customer-list'
import { BigCommerceNotice } from '@/components/admin/BigCommerceNotice'

export const metadata: Metadata = createMetadata({
  title: 'Customers - Jose Madrid Salsa Admin',
  description: 'Browse, sort, edit, import, and export your customer list.',
  pathname: '/admin/customers',
})

type SearchParams = {
  search?: string
  source?: string
  accountType?: string
  sortBy?: string
  sortDir?: string
  pageSize?: string
  page?: string
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  STANDARD: 'Standard',
  FUNDRAISING: 'Fundraising',
  WHOLESALE: 'Wholesale',
}

async function getCustomers(searchParams: SearchParams) {
  const page = resolvePage(searchParams.page)
  const limit = resolvePageSize(searchParams.pageSize)
  const sortBy = resolveSortColumn(searchParams.sortBy)
  const sortDir = resolveSortDirection(searchParams.sortDir)

  const where = buildCustomerWhere({
    search: searchParams.search,
    source: searchParams.source,
    accountType: searchParams.accountType,
  })

  const [customers, total, accountStats] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: buildCustomerOrderBy(sortBy, sortDir),
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        accountType: true,
        source: true,
        sourceName: true,
        emailStatus: true,
        emailPermissionStatus: true,
        // `notes` is deliberately absent: the archive audit trail averages ~350
        // characters, which is ~170KB of payload on a 500-row page for a field
        // only needed once a row is opened. The edit dialog fetches it.
        totalOrders: true,
        totalSpent: true,
        lastOrderAt: true,
      },
    }),
    prisma.customer.count({ where }),
    // Scoped to the same `where` as the table: unfiltered cards above a
    // filtered list read as a bug ("Total 22,689" over "Showing 500 of 763").
    prisma.customer.groupBy({ by: ['accountType'], where, _count: true }),
  ])

  return {
    customers,
    total,
    page,
    limit,
    sortBy,
    sortDir,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    accountStats,
  }
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'users:read'))) {
    redirect('/admin')
  }

  const canWrite = await hasPermission(user, 'users:write')
  const canExport = await hasPermission(user, 'users:export')
  const canCreateLists = await hasPermission(user, 'content:write')
  const {
    customers,
    total,
    page,
    limit,
    sortBy,
    sortDir,
    totalPages,
    accountStats,
  } = await getCustomers(params)

  // Every view parameter has to survive paging, or turning the page silently
  // resets the sort and filters back to defaults.
  const buildPageHref = (targetPage: number) => {
    const qs = new URLSearchParams()
    for (const key of [
      'search',
      'source',
      'accountType',
      'sortBy',
      'sortDir',
      'pageSize',
    ] as const) {
      const value = params[key]
      if (value) qs.set(key, value)
    }
    qs.set('page', String(targetPage))
    return `/admin/customers?${qs.toString()}`
  }

  const hasFilters = Boolean(params.search || params.source || params.accountType)

  return (
    <div className="space-y-6">
      <BigCommerceNotice area="customers" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">
            Everyone who has bought from or subscribed to Jose Madrid Salsa
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* ExportButton forwards the page's querystring, so the download
              carries the current search, filters and sort. */}
          {canExport && <ExportButton endpoint="/api/admin/customers/export" />}
          {canWrite && <SyncCustomersButton />}
          {canWrite && (
            <Button asChild>
              <Link href="/admin/customers/import">
                <Upload className="mr-2 size-4" />
                Import
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">
              {hasFilters ? 'Matching' : 'Total'}
            </CardDescription>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {total.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        {accountStats.map((stat) => (
          <Card key={stat.accountType}>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wide">
                {ACCOUNT_TYPE_LABELS[stat.accountType] ?? stat.accountType}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">
                {stat._count.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <Suspense fallback={<Skeleton className="h-10 w-full" />}>
            <CustomersFilter
              initialSearch={params.search}
              initialSource={params.source}
              initialAccountType={params.accountType}
              initialPageSize={limit}
            />
          </Suspense>
        </CardContent>
      </Card>

      {/* Customers Table */}
      {customers.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Users className="mx-auto mb-4 size-12 opacity-40" />
              <p className="text-lg font-medium text-foreground">
                No customers found
              </p>
              <p className="mt-1 text-sm">
                {hasFilters
                  ? 'Try a different search or filter'
                  : 'Import a contact list or run Sync to pull in existing buyers'}
              </p>
              {canWrite && !hasFilters && (
                <Button className="mt-4" asChild>
                  <Link href="/admin/customers/import">
                    <Upload className="mr-2 size-4" />
                    Import customers
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <CustomersTable
              customers={customers.map((c) => ({
                ...c,
                totalSpent: c.totalSpent.toString(),
                lastOrderAt: c.lastOrderAt ? c.lastOrderAt.toISOString() : null,
              }))}
              sortBy={sortBy}
              sortDir={sortDir}
              totalMatching={total}
              canWrite={canWrite}
              canCreateLists={canCreateLists}
            />
          </Suspense>

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                {page > 1 && (
                  <PaginationItem>
                    <PaginationPrevious href={buildPageHref(page - 1)} />
                  </PaginationItem>
                )}
                <PaginationItem>
                  <PaginationLink href="#" isActive>
                    {page} / {totalPages}
                  </PaginationLink>
                </PaginationItem>
                {page < totalPages && (
                  <PaginationItem>
                    <PaginationNext href={buildPageHref(page + 1)} />
                  </PaginationItem>
                )}
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}
    </div>
  )
}
