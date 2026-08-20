import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { createMetadata } from '@/lib/metadata'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { FundraiserContactsFilter } from '@/components/admin/fundraisers/FundraiserContactsFilter'
import { FundraiserContactsTable } from '@/components/admin/fundraisers/FundraiserContactsTable'
import {
  buildContactOrderBy,
  buildContactWhere,
  resolvePage,
  resolvePageSize,
  resolveSortColumn,
  resolveSortDirection,
  type ContactFilters,
} from '@/lib/fundraising/contact-list'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = createMetadata({
  title: 'Fundraiser Contacts - Jose Madrid Salsa Admin',
  description:
    'Every fundraising organization recovered from the archive, with contact details, sales history, and one-click re-signup outreach.',
  pathname: '/admin/fundraisers/contacts',
})

type SearchParams = ContactFilters & {
  sortBy?: string
  sortDir?: string
  pageSize?: string
  page?: string
}

export default async function FundraiserContactsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin?callbackUrl=/admin/fundraisers/contacts')
  if (!(await hasPermission(user, 'users:read'))) redirect('/admin')

  const canWrite = await hasPermission(user, 'users:write')
  const canSend = await hasPermission(user, 'content:write')

  const params = await searchParams
  const page = resolvePage(params.page)
  const pageSize = resolvePageSize(params.pageSize)
  const sortBy = resolveSortColumn(params.sortBy)
  const sortDir = resolveSortDirection(params.sortDir)

  const filters: ContactFilters = {
    search: params.search,
    status: params.status,
    source: params.source,
    active: params.active,
    hasEmail: params.hasEmail,
    withHistory: params.withHistory,
    year: params.year,
  }
  const where = buildContactWhere(filters)

  const [rows, totalMatching, totals, mailableNow, yearRows] = await Promise.all([
    prisma.fundraiserContact.findMany({
      where,
      orderBy: buildContactOrderBy(sortBy, sortDir),
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        organizationName: true,
        contactName: true,
        email: true,
        phone: true,
        totalJars: true,
        totalOrders: true,
        campaignCount: true,
        years: true,
        lastCampaignAt: true,
        lastSolicitedAt: true,
        solicitationCount: true,
        isActive: true,
        status: true,
        source: true,
        notes: true,
      },
    }),
    prisma.fundraiserContact.count({ where }),
    prisma.fundraiserContact.aggregate({
      _count: { _all: true },
      _sum: { totalJars: true },
    }),
    // The headline number the outreach button acts on: active, contactable, not opted out.
    prisma.fundraiserContact.count({
      where: {
        isActive: true,
        status: { not: 'DO_NOT_CONTACT' },
        NOT: [{ email: null }, { email: '' }],
      },
    }),
    // Years live in a scalar array, which Prisma cannot DISTINCT-unnest, and raw SQL is not
    // allowed here — so pull the column and flatten it. Only rows that have any campaign
    // history carry years, which keeps this well under a thousand short arrays.
    prisma.fundraiserContact.findMany({
      where: { campaignCount: { gt: 0 } },
      select: { years: true },
    }),
  ])

  const totalPages = Math.max(1, Math.ceil(totalMatching / pageSize))
  const years = [...new Set(yearRows.flatMap((row) => row.years))].sort((a, b) => b - a)

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Fundraiser contacts</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Every organization recovered from the document archive and the old mailing lists,
          deduplicated into one record each. Toggle a contact off to keep its history but
          exclude it from outreach.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Contacts" value={totals._count._all.toLocaleString()} />
        <StatCard
          label="Jars sold (lifetime)"
          value={(totals._sum.totalJars ?? 0).toLocaleString()}
          hint="Dollar totals are not recoverable from the archive."
        />
        <StatCard
          label="Mailable now"
          value={mailableNow.toLocaleString()}
          hint="Active, has an email, not marked do-not-contact."
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact list</CardTitle>
          <CardDescription>
            Search, filter, edit, and select contacts to invite back for a new campaign.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FundraiserContactsFilter years={years} />
          <FundraiserContactsTable
            contacts={rows.map((row) => ({
              ...row,
              lastCampaignAt: row.lastCampaignAt?.toISOString() ?? null,
              lastSolicitedAt: row.lastSolicitedAt?.toISOString() ?? null,
            }))}
            sortBy={sortBy}
            sortDir={sortDir}
            totalMatching={totalMatching}
            canWrite={canWrite}
            canSend={canSend}
          />

          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                {page > 1 && (
                  <PaginationItem>
                    <PaginationPrevious
                      href={buildPageHref(params, page - 1)}
                      aria-label="Previous page"
                    />
                  </PaginationItem>
                )}
                <PaginationItem>
                  <PaginationLink href="#" isActive>
                    {page} / {totalPages}
                  </PaginationLink>
                </PaginationItem>
                {page < totalPages && (
                  <PaginationItem>
                    <PaginationNext
                      href={buildPageHref(params, page + 1)}
                      aria-label="Next page"
                    />
                  </PaginationItem>
                )}
              </PaginationContent>
            </Pagination>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-muted-foreground text-sm">{label}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
        {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
      </CardContent>
    </Card>
  )
}

function buildPageHref(params: SearchParams, page: number): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== 'page') query.set(key, String(value))
  }
  query.set('page', String(page))
  return `/admin/fundraisers/contacts?${query.toString()}`
}
