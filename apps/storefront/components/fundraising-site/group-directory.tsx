'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { normalizeGroupName } from '@/lib/fundraising-site/checkout-fields'

type Group = { slug: string; label: string }

export function GroupDirectory({ groups }: { groups: Group[] }) {
  const [query, setQuery] = useState('')
  const visible = useMemo(() => {
    const wanted = normalizeGroupName(query)
    return wanted ? groups.filter((group) => normalizeGroupName(group.label).includes(wanted)) : groups
  }, [groups, query])

  return (
    <div>
      <label htmlFor="group-search" className="sr-only">
        Search groups
      </label>
      <div className="relative mx-auto mb-8 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          id="group-search"
          type="search"
          placeholder="Search by school, team or club"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="pl-9"
        />
      </div>

      {visible.length === 0 ? (
        <p className="text-center text-muted-foreground">
          No group matches “{query}”. If your group just signed up, it may not be listed yet —{' '}
          <Link href="/contact" className="font-semibold text-salsa-600 hover:underline">
            contact us
          </Link>
          .
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((group) => (
            <li key={group.slug}>
              <Link
                href={`/groups/${group.slug}`}
                className="block h-full rounded-lg border border-border bg-card p-4 font-medium text-foreground transition-colors hover:border-salsa-500 hover:text-salsa-600"
              >
                {group.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
