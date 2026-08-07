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
  title: 'Archive Mileage - Jose Madrid Salsa Admin',
  description: 'Business trips recovered from the mileage spreadsheets.',
  pathname: '/admin/archive/mileage',
})

const BASE = '/admin/archive/mileage'
const SORTABLE = ['tripDate', 'destination', 'miles', 'driver'] as const

type SearchParams = {
  search?: string
  driver?: string
  sortBy?: string
  sortDir?: string
  pageSize?: string
  page?: string
}

export default async function ArchiveMileagePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin?callbackUrl=/admin/archive/mileage')
  if (!(await hasPermission(user, 'analytics:read'))) redirect('/admin')

  const params = await searchParams
  const page = resolvePage(params.page)
  const pageSize = resolvePageSize(params.pageSize)
  const sortBy = resolveSortColumn(params.sortBy, SORTABLE, 'tripDate')
  const sortDir = resolveSortDirection(params.sortDir)

  const search = buildSearchFilter(params.search, ['destination', 'city', 'state', 'driver'])

  const where: Prisma.MileageEntryWhereInput = {
    ...(search ?? {}),
    ...(params.driver ? { driver: params.driver } : {}),
  }

  const [rows, total, drivers, aggregate] = await Promise.all([
    prisma.mileageEntry.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        tripDate: true,
        endDate: true,
        destination: true,
        city: true,
        state: true,
        miles: true,
        driver: true,
        category: true,
      },
    }),
    prisma.mileageEntry.count({ where }),
    prisma.mileageEntry.groupBy({ by: ['driver'], _count: true, orderBy: { driver: 'asc' } }),
    prisma.mileageEntry.aggregate({ where, _sum: { miles: true } }),
  ])

  const current = params as Record<string, string | undefined>

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <Link href="/admin/archive" className="text-sm text-muted-foreground hover:text-foreground">
          ← Archive
        </Link>
        <h1 className="text-2xl font-semibold">Mileage</h1>
        <p className="text-sm text-muted-foreground">
          {(aggregate._sum.miles ?? 0).toLocaleString()} miles across the current filter.
        </p>
      </header>

      <div className="rounded-lg border bg-card">
        <ArchiveFilters
          basePath={BASE}
          searchParams={current}
          placeholder="Search destination, city or driver…"
        >
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <Link
              href={`${BASE}${buildQuery(current, { driver: undefined, page: 1 })}`}
              className={`rounded px-2 py-1 ${!params.driver ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'}`}
            >
              All drivers
            </Link>
            {drivers
              .filter((d) => d.driver)
              .map((d) => (
                <Link
                  key={d.driver}
                  href={`${BASE}${buildQuery(current, { driver: d.driver as string, page: 1 })}`}
                  className={`rounded px-2 py-1 ${params.driver === d.driver ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'}`}
                >
                  {d.driver} <span className="opacity-60">{d._count}</span>
                </Link>
              ))}
          </div>
        </ArchiveFilters>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-muted/40">
              <tr>
                <SortableHeader label="Date" column="tripDate" basePath={BASE} searchParams={current} currentSort={sortBy} currentDir={sortDir} />
                <SortableHeader label="Destination" column="destination" basePath={BASE} searchParams={current} currentSort={sortBy} currentDir={sortDir} />
                <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Where
                </th>
                <SortableHeader label="Miles" column="miles" basePath={BASE} searchParams={current} currentSort={sortBy} currentDir={sortDir} />
                <SortableHeader label="Driver" column="driver" basePath={BASE} searchParams={current} currentSort={sortBy} currentDir={sortDir} />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 ? (
                <ArchiveEmptyRow colSpan={5} message="No trips match these filters." />
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/30">
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {row.tripDate.toISOString().slice(0, 10)}
                      {row.endDate && (
                        <span className="text-xs"> → {row.endDate.toISOString().slice(0, 10)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium">{row.destination}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {[row.city, row.state].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {row.miles?.toLocaleString() ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{row.driver ?? '—'}</td>
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
