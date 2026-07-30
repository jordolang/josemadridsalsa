import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Upload, Users } from 'lucide-react'
import Link from 'next/link'

import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { Badge } from '@/components/ui/badge'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CustomersFilter } from '@/components/admin/customers/CustomersFilter'
import { SyncCustomersButton } from '@/components/admin/customers/SyncCustomersButton'
import { ExportButton } from '@/components/admin/shared/ExportButton'
import { createMetadata } from '@/lib/metadata'

export const metadata: Metadata = createMetadata({
  title: 'Customers - Jose Madrid Salsa Admin',
  description: 'Browse, import, and export your customer and contact list.',
  pathname: '/admin/customers',
})

type SearchParams = {
  search?: string
  source?: string
  page?: string
}

const SOURCE_LABELS: Record<string, string> = {
  IMPORT: 'Imported',
  GUEST_ORDER: 'Guest order',
  REGISTERED: 'Registered',
  MANUAL: 'Manual',
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  STANDARD: 'Standard',
  FUNDRAISING: 'Fundraising',
  WHOLESALE: 'Wholesale',
}

function fullName(c: { firstName: string | null; lastName: string | null }) {
  return [c.firstName, c.lastName].filter(Boolean).join(' ').trim()
}

async function getCustomers(searchParams: SearchParams) {
  const page = Number(searchParams.page) || 1
  const limit = 25
  const skip = (page - 1) * limit

  const where: any = {}

  if (searchParams.search) {
    where.OR = [
      { email: { contains: searchParams.search, mode: 'insensitive' } },
      { firstName: { contains: searchParams.search, mode: 'insensitive' } },
      { lastName: { contains: searchParams.search, mode: 'insensitive' } },
    ]
  }

  if (searchParams.source && searchParams.source !== 'all') {
    where.source = searchParams.source
  }

  const [customers, total, sourceStats] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.customer.count({ where }),
    prisma.customer.groupBy({ by: ['source'], _count: true }),
  ])

  return {
    customers,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    sourceStats,
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
  const { customers, total, page, totalPages, sourceStats } =
    await getCustomers(params)

  const buildPageHref = (targetPage: number) => {
    const qs = new URLSearchParams()
    if (params.search) qs.set('search', params.search)
    if (params.source) qs.set('source', params.source)
    qs.set('page', String(targetPage))
    return `/admin/customers?${qs.toString()}`
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">
            Everyone who has bought from or subscribed to Jose Madrid Salsa
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">
              Total
            </CardDescription>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{total}</p>
          </CardContent>
        </Card>
        {sourceStats.map((stat) => (
          <Card key={stat.source}>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wide">
                {SOURCE_LABELS[stat.source] ?? stat.source}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{stat._count}</p>
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
                {params.search || params.source
                  ? 'Try a different search or filter'
                  : 'Import a contact list or run Sync to pull in existing buyers'}
              </p>
              {canWrite && !params.search && !params.source && (
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
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Total Spent</TableHead>
                  <TableHead>Last Order</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{fullName(c) || 'No name'}</p>
                        <p className="text-sm text-muted-foreground">{c.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.phone || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={c.accountType === 'STANDARD' ? 'outline' : 'secondary'}
                      >
                        {ACCOUNT_TYPE_LABELS[c.accountType] ?? c.accountType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {SOURCE_LABELS[c.source] ?? c.source}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.totalOrders}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${Number(c.totalSpent).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.lastOrderAt
                        ? new Date(c.lastOrderAt).toLocaleDateString()
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

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
