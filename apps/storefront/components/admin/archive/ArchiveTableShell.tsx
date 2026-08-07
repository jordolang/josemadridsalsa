import Link from 'next/link'

import {
  buildQuery,
  PAGE_SIZES,
  totalPages as computeTotalPages,
} from '@/lib/archive/archive-list'

type SearchParams = Record<string, string | undefined>

/** A sortable column heading that links back to the same page. */
export function SortableHeader({
  label,
  column,
  basePath,
  searchParams,
  currentSort,
  currentDir,
  className,
}: {
  label: string
  column: string
  basePath: string
  searchParams: SearchParams
  currentSort: string
  currentDir: 'asc' | 'desc'
  className?: string
}) {
  const isActive = currentSort === column
  const nextDir = isActive && currentDir === 'asc' ? 'desc' : 'asc'
  const href = `${basePath}${buildQuery(searchParams, {
    sortBy: column,
    sortDir: nextDir,
    page: 1,
  })}`

  return (
    <th
      scope="col"
      className={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground ${className ?? ''}`}
    >
      <Link href={href} className="inline-flex items-center gap-1 hover:text-foreground">
        {label}
        <span aria-hidden className={isActive ? 'opacity-100' : 'opacity-25'}>
          {isActive && currentDir === 'desc' ? '↓' : '↑'}
        </span>
      </Link>
    </th>
  )
}

/** Result count, page-size picker and prev/next links. */
export function ArchivePagination({
  basePath,
  searchParams,
  page,
  pageSize,
  total,
}: {
  basePath: string
  searchParams: SearchParams
  page: number
  pageSize: number
  total: number
}) {
  const pages = computeTotalPages(total, pageSize)
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-col gap-3 border-t px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground">
        {total === 0
          ? 'No rows'
          : `${from.toLocaleString()}–${to.toLocaleString()} of ${total.toLocaleString()}`}
      </p>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Per page</span>
          {PAGE_SIZES.map((size) => (
            <Link
              key={size}
              href={`${basePath}${buildQuery(searchParams, { pageSize: size, page: 1 })}`}
              className={`rounded px-2 py-1 ${
                size === pageSize
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              {size}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link
              href={`${basePath}${buildQuery(searchParams, { page: page - 1 })}`}
              className="rounded border px-2 py-1 hover:bg-muted"
            >
              Previous
            </Link>
          ) : (
            <span className="rounded border px-2 py-1 opacity-40">Previous</span>
          )}
          <span className="text-muted-foreground">
            {page} / {pages}
          </span>
          {page < pages ? (
            <Link
              href={`${basePath}${buildQuery(searchParams, { page: page + 1 })}`}
              className="rounded border px-2 py-1 hover:bg-muted"
            >
              Next
            </Link>
          ) : (
            <span className="rounded border px-2 py-1 opacity-40">Next</span>
          )}
        </div>
      </div>
    </div>
  )
}

/** Search box + optional filter chips, submitted as a plain GET form. */
export function ArchiveFilters({
  basePath,
  searchParams,
  placeholder,
  children,
}: {
  basePath: string
  searchParams: SearchParams
  placeholder: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 border-b px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <form action={basePath} method="get" className="flex flex-1 items-center gap-2">
        {/* Preserve sort and page size across a new search. */}
        {(['sortBy', 'sortDir', 'pageSize'] as const).map((key) =>
          searchParams[key] ? (
            <input key={key} type="hidden" name={key} value={searchParams[key]} />
          ) : null
        )}
        <input
          type="search"
          name="search"
          defaultValue={searchParams.search ?? ''}
          placeholder={placeholder}
          className="w-full max-w-md rounded border px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"
        >
          Search
        </button>
        {searchParams.search ? (
          <Link
            href={`${basePath}${buildQuery(searchParams, { search: undefined, page: 1 })}`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Clear
          </Link>
        ) : null}
      </form>
      {children}
    </div>
  )
}

/** Consistent empty state for every archive table. */
export function ArchiveEmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-10 text-center text-sm text-muted-foreground">
        {message}
      </td>
    </tr>
  )
}
