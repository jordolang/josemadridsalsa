import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import type { Prisma } from '@prisma/client'

import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { createMetadata } from '@/lib/metadata'
import { formatPrice } from '@/lib/utils'
import {
  buildQuery,
  buildSearchFilter,
  resolvePage,
  resolvePageSize,
  resolveSortColumn,
  resolveSortDirection,
} from '@/lib/archive/archive-list'
import {
  ArchiveEmptyRow,
  ArchiveFilters,
  ArchivePagination,
  SortableHeader,
} from '@/components/admin/archive/ArchiveTableShell'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = createMetadata({
  title: 'Archive Show Sales - Jose Madrid Salsa Admin',
  description: 'Historical show and farmers-market sales from the document archive.',
  pathname: '/admin/archive/shows',
})

const BASE = '/admin/archive/shows'
const SORTABLE = ['showName', 'showDate', 'year', 'sales', 'salesPerson'] as const

type SearchParams = {
  search?: string
  year?: string
  eventType?: string
  sortBy?: string
  sortDir?: string
  pageSize?: string
  page?: string
}

export default async function ArchiveShowsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin?callbackUrl=/admin/archive/shows')
  if (!(await hasPermission(user, 'analytics:read'))) redirect('/admin')

  const params = await searchParams
  const page = resolvePage(params.page)
  const pageSize = resolvePageSize(params.pageSize)
  const sortBy = resolveSortColumn(params.sortBy, SORTABLE, 'showDate')
  const sortDir = resolveSortDirection(params.sortDir)

  const search = buildSearchFilter(params.search, ['showName', 'salesPerson', 'sourceFile'])
  const year = Number.parseInt(params.year ?? '', 10)

  const where: Prisma.ArchivedShowSaleWhereInput = {
    ...(search ?? {}),
    ...(Number.isFinite(year) ? { year } : {}),
    ...(params.eventType
      ? { eventType: params.eventType as 'SHOW' | 'FARMERS_MARKET' }
      : {}),
  }

  const [rows, total, years, aggregate] = await Promise.all([
    prisma.archivedShowSale.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        showName: true,
        showDate: true,
        dateText: true,
        year: true,
        eventType: true,
        sales: true,
        amountPaid: true,
        expenses: true,
        salesPerson: true,
        sourceFile: true,
      },
    }),
    prisma.archivedShowSale.count({ where }),
    prisma.archivedShowSale.groupBy({ by: ['year'], _count: true, orderBy: { year: 'desc' } }),
    prisma.archivedShowSale.aggregate({ where, _sum: { sales: true } }),
  ])

  const current = params as Record<string, string | undefined>
  const totalSales = Number(aggregate._sum.sales ?? 0)

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <Link href="/admin/archive" className="text-sm text-muted-foreground hover:text-foreground">
          ← Archive
        </Link>
        <h1 className="text-2xl font-semibold">Show &amp; market sales</h1>
        <p className="text-sm text-muted-foreground">
          {formatPrice(totalSales)} recorded across the current filter. These are the crew&apos;s
          own tallies — a historical record, not QuickBooks.
        </p>
      </header>

      <div className="rounded-lg border bg-card">
        <ArchiveFilters
          basePath={BASE}
          searchParams={current}
          placeholder="Search show, seller or file…"
        >
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <Link
              href={`${BASE}${buildQuery(current, { eventType: undefined, page: 1 })}`}
              className={`rounded px-2 py-1 ${!params.eventType ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'}`}
            >
              All types
            </Link>
            <Link
              href={`${BASE}${buildQuery(current, { eventType: 'SHOW', page: 1 })}`}
              className={`rounded px-2 py-1 ${params.eventType === 'SHOW' ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'}`}
            >
              Shows
            </Link>
            <Link
              href={`${BASE}${buildQuery(current, { eventType: 'FARMERS_MARKET', page: 1 })}`}
              className={`rounded px-2 py-1 ${params.eventType === 'FARMERS_MARKET' ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'}`}
            >
              Farmers markets
            </Link>
            {years
              .filter((y) => y.year !== null)
              .map((y) => (
                <Link
                  key={y.year}
                  href={`${BASE}${buildQuery(current, { year: String(y.year), page: 1 })}`}
                  className={`rounded px-2 py-1 ${params.year === String(y.year) ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'}`}
                >
                  {y.year} <span className="opacity-60">{y._count}</span>
                </Link>
              ))}
          </div>
        </ArchiveFilters>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/40">
              <tr>
                <SortableHeader label="Event" column="showName" basePath={BASE} searchParams={current} currentSort={sortBy} currentDir={sortDir} />
                <SortableHeader label="Date" column="showDate" basePath={BASE} searchParams={current} currentSort={sortBy} currentDir={sortDir} />
                <SortableHeader label="Sales" column="sales" basePath={BASE} searchParams={current} currentSort={sortBy} currentDir={sortDir} />
                <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Paid / expenses
                </th>
                <SortableHeader label="Crew" column="salesPerson" basePath={BASE} searchParams={current} currentSort={sortBy} currentDir={sortDir} />
                <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Type
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 ? (
                <ArchiveEmptyRow colSpan={6} message="No events match these filters." />
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="align-top hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{row.showName}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {row.dateText ??
                        (row.showDate ? row.showDate.toISOString().slice(0, 10) : '—')}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {row.sales === null ? '—' : formatPrice(Number(row.sales))}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">
                      {row.amountPaid === null ? '—' : formatPrice(Number(row.amountPaid))}
                      {row.expenses !== null && (
                        <div className="text-xs">exp {formatPrice(Number(row.expenses))}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{row.salesPerson || '—'}</td>
                    <td className="px-3 py-2">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {row.eventType === 'FARMERS_MARKET' ? 'Market' : 'Show'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <ArchivePagination basePath={BASE} searchParams={current} page={page} pageSize={pageSize} total={total} />
      </div>
    </div>
  )
}
