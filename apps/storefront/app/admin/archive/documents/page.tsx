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
  formatBytes,
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
  title: 'Archive Documents - Jose Madrid Salsa Admin',
  description: 'Search the indexed business document archive.',
  pathname: '/admin/archive/documents',
})

const BASE = '/admin/archive/documents'
const SORTABLE = ['path', 'category', 'filename', 'year', 'sizeBytes', 'textChars'] as const

type SearchParams = {
  search?: string
  category?: string
  sensitivity?: string
  needsOcr?: string
  sortBy?: string
  sortDir?: string
  pageSize?: string
  page?: string
}

export default async function ArchiveDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin?callbackUrl=/admin/archive/documents')
  if (!(await hasPermission(user, 'analytics:read'))) redirect('/admin')

  const params = await searchParams
  const page = resolvePage(params.page)
  const pageSize = resolvePageSize(params.pageSize)
  const sortBy = resolveSortColumn(params.sortBy, SORTABLE, 'path')
  const sortDir = resolveSortDirection(params.sortDir)

  // Full text is searched too, which is how a document is found by content.
  const search = buildSearchFilter(params.search, [
    'path',
    'filename',
    'category',
    'extractedText',
  ])

  const where: Prisma.ArchiveDocumentWhereInput = {
    ...(search ?? {}),
    ...(params.category ? { category: params.category } : {}),
    ...(params.sensitivity ? { sensitivity: params.sensitivity as 'INTERNAL' | 'SENSITIVE' | 'PUBLIC' } : {}),
    ...(params.needsOcr === 'true' ? { needsOcr: true } : {}),
  }

  const [rows, total, categories] = await Promise.all([
    prisma.archiveDocument.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        path: true,
        filename: true,
        category: true,
        ext: true,
        year: true,
        sizeBytes: true,
        textChars: true,
        needsOcr: true,
        sensitivity: true,
      },
    }),
    prisma.archiveDocument.count({ where }),
    prisma.archiveDocument.groupBy({ by: ['category'], _count: true, orderBy: { category: 'asc' } }),
  ])

  const current = params as Record<string, string | undefined>

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <Link href="/admin/archive" className="text-sm text-muted-foreground hover:text-foreground">
          ← Archive
        </Link>
        <h1 className="text-2xl font-semibold">Documents</h1>
        <p className="text-sm text-muted-foreground">
          Searches filename, path and full text. Sensitive records are indexed but their text is
          not stored — open those from the local archive using the path.
        </p>
      </header>

      <div className="rounded-lg border bg-card">
        <ArchiveFilters
          basePath={BASE}
          searchParams={current}
          placeholder="Search name, path or document text…"
        >
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <Link
              href={`${BASE}${buildQuery(current, { sensitivity: undefined, page: 1 })}`}
              className={`rounded px-2 py-1 ${!params.sensitivity ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'}`}
            >
              All
            </Link>
            <Link
              href={`${BASE}${buildQuery(current, { sensitivity: 'INTERNAL', page: 1 })}`}
              className={`rounded px-2 py-1 ${params.sensitivity === 'INTERNAL' ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'}`}
            >
              Internal
            </Link>
            <Link
              href={`${BASE}${buildQuery(current, { sensitivity: 'SENSITIVE', page: 1 })}`}
              className={`rounded px-2 py-1 ${params.sensitivity === 'SENSITIVE' ? 'bg-amber-600 text-white' : 'border hover:bg-muted'}`}
            >
              Sensitive
            </Link>
            <Link
              href={`${BASE}${buildQuery(current, { needsOcr: params.needsOcr === 'true' ? undefined : 'true', page: 1 })}`}
              className={`rounded px-2 py-1 ${params.needsOcr === 'true' ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'}`}
            >
              Needs OCR
            </Link>
          </div>
        </ArchiveFilters>

        <div className="flex flex-wrap gap-1 border-b px-3 py-2 text-xs">
          <Link
            href={`${BASE}${buildQuery(current, { category: undefined, page: 1 })}`}
            className={`rounded px-2 py-1 ${!params.category ? 'bg-muted font-medium' : 'hover:bg-muted'}`}
          >
            All categories
          </Link>
          {categories.map((c) => (
            <Link
              key={c.category}
              href={`${BASE}${buildQuery(current, { category: c.category, page: 1 })}`}
              className={`rounded px-2 py-1 ${params.category === c.category ? 'bg-muted font-medium' : 'hover:bg-muted'}`}
            >
              {c.category} <span className="text-muted-foreground">{c._count}</span>
            </Link>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/40">
              <tr>
                <SortableHeader label="File" column="filename" basePath={BASE} searchParams={current} currentSort={sortBy} currentDir={sortDir} />
                <SortableHeader label="Category" column="category" basePath={BASE} searchParams={current} currentSort={sortBy} currentDir={sortDir} />
                <SortableHeader label="Year" column="year" basePath={BASE} searchParams={current} currentSort={sortBy} currentDir={sortDir} />
                <SortableHeader label="Size" column="sizeBytes" basePath={BASE} searchParams={current} currentSort={sortBy} currentDir={sortDir} />
                <SortableHeader label="Text" column="textChars" basePath={BASE} searchParams={current} currentSort={sortBy} currentDir={sortDir} />
                <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Flags
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 ? (
                <ArchiveEmptyRow colSpan={6} message="No documents match these filters." />
              ) : (
                rows.map((doc) => (
                  <tr key={doc.id} className="align-top hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <div className="font-medium">{doc.filename}</div>
                      <div className="break-all text-xs text-muted-foreground">{doc.path}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{doc.category}</td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{doc.year ?? '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                      {formatBytes(doc.sizeBytes)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">
                      {doc.textChars ? doc.textChars.toLocaleString() : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {doc.sensitivity === 'SENSITIVE' && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900">
                            Sensitive — text withheld
                          </span>
                        )}
                        {doc.needsOcr && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                            Needs OCR
                          </span>
                        )}
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
