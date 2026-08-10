import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import type { Prisma } from '@prisma/client'

import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { createMetadata } from '@/lib/metadata'
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
  title: 'Archive Fundraisers - Jose Madrid Salsa Admin',
  description: 'Historical fundraiser campaigns recovered from the document archive.',
  pathname: '/admin/archive/fundraisers',
})

const BASE = '/admin/archive/fundraisers'
const SORTABLE = ['organizationName', 'year', 'orderDate', 'totalJars', 'orderCount'] as const

type SearchParams = {
  search?: string
  year?: string
  formType?: string
  sortBy?: string
  sortDir?: string
  pageSize?: string
  page?: string
}

export default async function ArchiveFundraisersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin?callbackUrl=/admin/archive/fundraisers')
  if (!(await hasPermission(user, 'analytics:read'))) redirect('/admin')

  const params = await searchParams
  const page = resolvePage(params.page)
  const pageSize = resolvePageSize(params.pageSize)
  const sortBy = resolveSortColumn(params.sortBy, SORTABLE, 'organizationName')
  const sortDir = resolveSortDirection(params.sortDir)

  const search = buildSearchFilter(params.search, [
    'organizationName',
    'submittedBy',
    'contactEmail',
    'sourceFile',
  ])
  const year = Number.parseInt(params.year ?? '', 10)

  const where: Prisma.ArchivedFundraiserWhereInput = {
    ...(search ?? {}),
    ...(Number.isFinite(year) ? { year } : {}),
    ...(params.formType
      ? { formType: params.formType as 'ORDER_FORM' | 'ORDER_EXPORT' | 'UNKNOWN' }
      : {}),
  }

  const [rows, total, years, aggregate] = await Promise.all([
    prisma.archivedFundraiser.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        organizationName: true,
        year: true,
        orderDate: true,
        submittedBy: true,
        contactEmail: true,
        totalJars: true,
        orderCount: true,
        formType: true,
        sourceFile: true,
      },
    }),
    prisma.archivedFundraiser.count({ where }),
    prisma.archivedFundraiser.groupBy({
      by: ['year'],
      _count: true,
      orderBy: { year: 'desc' },
    }),
    prisma.archivedFundraiser.aggregate({ where, _sum: { totalJars: true } }),
  ])

  const current = params as Record<string, string | undefined>

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <Link href="/admin/archive" className="text-sm text-muted-foreground hover:text-foreground">
          ← Archive
        </Link>
        <h1 className="text-2xl font-semibold">Fundraiser campaigns</h1>
        <p className="text-sm text-muted-foreground">
          One row per source order form. {(aggregate._sum.totalJars ?? 0).toLocaleString()} jars
          across the current filter.
        </p>
      </header>

      <div className="rounded-lg border bg-card">
        <ArchiveFilters
          basePath={BASE}
          searchParams={current}
          placeholder="Search organization, organizer or file…"
        >
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <Link
              href={`${BASE}${buildQuery(current, { year: undefined, page: 1 })}`}
              className={`rounded px-2 py-1 ${!params.year ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'}`}
            >
              All years
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
                <SortableHeader label="Organization" column="organizationName" basePath={BASE} searchParams={current} currentSort={sortBy} currentDir={sortDir} />
                <SortableHeader label="Year" column="year" basePath={BASE} searchParams={current} currentSort={sortBy} currentDir={sortDir} />
                <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Organizer
                </th>
                <SortableHeader label="Jars" column="totalJars" basePath={BASE} searchParams={current} currentSort={sortBy} currentDir={sortDir} />
                <SortableHeader label="Orders" column="orderCount" basePath={BASE} searchParams={current} currentSort={sortBy} currentDir={sortDir} />
                <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Source
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 ? (
                <ArchiveEmptyRow colSpan={6} message="No campaigns match these filters." />
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="align-top hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{row.organizationName}</td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">
                      {row.year ?? (row.orderDate ? row.orderDate.getUTCFullYear() : '—')}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {row.submittedBy || '—'}
                      {row.contactEmail && (
                        <div className="text-xs break-all">{row.contactEmail}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {row.totalJars?.toLocaleString() ?? '—'}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">
                      {row.orderCount?.toLocaleString() ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {row.formType}
                      </span>
                      <div className="mt-1 break-all text-xs text-muted-foreground">
                        {row.sourceFile}
                      </div>
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
