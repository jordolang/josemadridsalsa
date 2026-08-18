import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { createMetadata } from '@/lib/metadata'
import { getCurrentUser } from '@/lib/rbac'
import { ENTITY_LABELS, groupResults, isSearchable } from '@/lib/admin/global-search'
import { runGlobalSearch } from '@/lib/admin/search-providers'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = createMetadata({
  title: 'Search - Jose Madrid Salsa Admin',
  description: 'Search every record, document and page in the admin.',
  pathname: '/admin/search',
})

/** Deeper than the ⌘K palette, which only has room for the top few per section. */
const PER_ENTITY_LIMIT = 25
const RESULT_LIMIT = 250

/**
 * The whole result set for a query, grouped by what it found.
 *
 * The palette answers "take me there"; this page answers "show me everything that mentions
 * this", which is what an operator wants when a group's name turns up in a campaign, an
 * archived order form and the text of a scanned document all at once.
 */
export default async function AdminSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin?callbackUrl=/admin/search')

  const query = (await searchParams).q?.trim() ?? ''
  const { results } = await runGlobalSearch(user, query, {
    perEntityLimit: PER_ENTITY_LIMIT,
    limit: RESULT_LIMIT,
  })
  const grouped = groupResults(results)

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Search</h1>
        <p className="text-sm text-muted-foreground">
          Orders, customers, fundraisers, documents, archive records and website content — every
          table you have permission to read.
        </p>
      </header>

      <form action="/admin/search" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          autoFocus
          placeholder="Fundraiser name, document title, email, order number…"
          className="w-full max-w-xl rounded-md border bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Search
        </button>
      </form>

      {!isSearchable(query) ? (
        <p className="text-sm text-muted-foreground">Enter at least two characters.</p>
      ) : results.length === 0 ? (
        <p className="text-sm text-muted-foreground">No matches for “{query}”.</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {results.length}
            {results.length === RESULT_LIMIT ? '+' : ''} result
            {results.length === 1 ? '' : 's'} across {grouped.length} section
            {grouped.length === 1 ? '' : 's'}.
          </p>

          <div className="space-y-6">
            {grouped.map(([entity, items]) => (
              <section key={entity} className="rounded-lg border bg-card">
                <h2 className="border-b px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {ENTITY_LABELS[entity]}
                  <span className="ml-2 font-normal normal-case">
                    {items.length}
                    {items.length === PER_ENTITY_LIMIT ? '+' : ''}
                  </span>
                </h2>
                <ul className="divide-y">
                  {items.map((item) => (
                    <li key={`${item.entity}-${item.id}`}>
                      <Link href={item.href} className="block px-4 py-3 hover:bg-muted">
                        <p className="text-sm font-medium">{item.title}</p>
                        {item.subtitle && (
                          <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                        )}
                        {/* Only set when the match came from inside the record, not its name. */}
                        {item.excerpt && (
                          <p className="mt-1 text-xs italic text-muted-foreground">
                            {item.excerpt}
                          </p>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
