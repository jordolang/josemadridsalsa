'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Search } from 'lucide-react'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Button } from '@/components/ui/button'
import {
  ENTITY_LABELS,
  groupResults,
  isSearchable,
  type SearchResult,
} from '@/lib/admin/global-search'

/**
 * One box that finds anything: order number, RMA, customer, email, phone, SKU, tracking
 * number, product name, campaign, coupon code — and, for free text, every document,
 * archive record and page of website content the operator is allowed to see.
 *
 * Opens on ⌘K / Ctrl-K from anywhere in the admin. Results come from the server so ranking
 * and permissions are decided in one place; this component only renders them. The palette
 * shows the top few per section; Enter on the last row opens the full-results page.
 */
export function GlobalSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Guards against a slow early request landing after a later one and overwriting it.
  const requestId = useRef(0)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!isSearchable(query)) {
      setResults([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const id = ++requestId.current

    // Debounced: typing an order number should issue one query, not sixteen.
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/admin/search?q=${encodeURIComponent(query)}`)
        const data = await response.json()
        if (id === requestId.current) setResults(data.results ?? [])
      } catch {
        if (id === requestId.current) setResults([])
      } finally {
        if (id === requestId.current) setIsLoading(false)
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [query])

  const go = useCallback(
    (href: string) => {
      setOpen(false)
      setQuery('')
      router.push(href)
    },
    [router]
  )

  const grouped = groupResults(results)

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-muted-foreground w-full justify-start gap-2 sm:w-64"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="hidden rounded border px-1.5 text-[0.65rem] sm:inline">⌘K</kbd>
      </Button>

      {/* Results arrive already matched and ranked by the server, and their cmdk values are
          ids. Left on, cmdk's client-side filter scores "order-clx123" against the typed
          query, matches nothing, and empties the whole list. */}
      <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
        <CommandInput
          placeholder="Order, customer, fundraiser, document title, SKU, tracking…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {!isSearchable(query) ? (
            <CommandEmpty>Type at least two characters.</CommandEmpty>
          ) : isLoading ? (
            <CommandEmpty>Searching…</CommandEmpty>
          ) : results.length === 0 ? (
            <CommandEmpty>No matches for “{query}”.</CommandEmpty>
          ) : (
            <>
              {grouped.map(([entity, items]) => (
                <CommandGroup key={entity} heading={ENTITY_LABELS[entity]}>
                  {items.map((item) => (
                    <CommandItem
                      key={`${item.entity}-${item.id}`}
                      value={`${item.entity}-${item.id}`}
                      onSelect={() => go(item.href)}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm">{item.title}</p>
                        {item.subtitle && (
                          <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
                        )}
                        {/* Present only when the query matched inside the record rather than
                            its name — otherwise a hit on a scanned file looks arbitrary. */}
                        {item.excerpt && (
                          <p className="truncate text-xs italic text-muted-foreground">
                            {item.excerpt}
                          </p>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  value="see-all-results"
                  onSelect={() => go(`/admin/search?q=${encodeURIComponent(query)}`)}
                >
                  <ArrowRight className="size-4" />
                  <span className="text-sm">See all results for “{query}”</span>
                </CommandItem>
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}
