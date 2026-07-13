'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  MobileOrderListItem,
  type MobileOrderRow,
} from './MobileOrderListItem'

const STATUS_FILTERS = [
  'all',
  'PENDING',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
] as const

type StatusFilter = (typeof STATUS_FILTERS)[number]

// Must match the server-side page size in app/admin/orders/page.tsx — bump both
// if the API changes.
const PAGE_SIZE = 50

interface MobileOrdersListProps {
  orders: MobileOrderRow[]
  total: number
  page: number
  totalPages: number
  initialStatus?: string
  initialSearch?: string
  className?: string
}

function formatChipLabel(value: StatusFilter): string {
  if (value === 'all') return 'All'
  return value.charAt(0) + value.slice(1).toLowerCase()
}

export function MobileOrdersList({
  orders,
  total,
  page,
  totalPages,
  initialStatus = 'all',
  initialSearch = '',
  className,
}: MobileOrdersListProps) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [search, setSearch] = useState(initialSearch)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const handle = setTimeout(() => {
      if (search === initialSearch) return
      const next = new URLSearchParams(params)
      if (search) next.set('search', search)
      else next.delete('search')
      next.delete('page')
      startTransition(() => {
        router.replace(`${pathname}?${next.toString()}`)
      })
    }, 300)
    return () => clearTimeout(handle)
    // We intentionally depend on `search` only: this is a debounce that should
    // fire when the user types, not when navigation re-renders the component
    // and changes `params`/`pathname`/`router`. `initialSearch` is the SSR
    // snapshot — re-running on its change would also defeat the debounce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const setStatus = (status: StatusFilter) => {
    const next = new URLSearchParams(params)
    if (status === 'all') next.delete('status')
    else next.set('status', status)
    next.delete('page')
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`)
    })
  }

  const loadMore = () => {
    const next = new URLSearchParams(params)
    next.set('page', String(page + 1))
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`)
    })
  }

  const activeStatus = params.get('status') ?? initialStatus
  const remaining = Math.max(0, total - page * PAGE_SIZE)

  return (
    <div className={cn('flex flex-col gap-3 p-3', className)}>
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          inputMode="search"
          placeholder="Search orders…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-11 pl-9 text-base"
          aria-label="Search orders"
        />
      </div>

      <div
        role="group"
        aria-label="Filter by status"
        className="-mx-3 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex gap-2">
          {STATUS_FILTERS.map((value) => {
            const active =
              value === activeStatus ||
              (value === 'all' && !params.get('status'))
            return (
              <button
                key={value}
                type="button"
                onClick={() => setStatus(value)}
                aria-pressed={active}
                className={cn(
                  'min-h-11 rounded-full border px-4 text-sm whitespace-nowrap',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background hover:bg-accent/50',
                )}
              >
                {formatChipLabel(value)}
              </button>
            )
          })}
        </div>
      </div>

      {orders.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No orders match.
        </p>
      ) : (
        <ul className="space-y-2">
          {orders.map((order) => (
            <MobileOrderListItem key={order.id} order={order} />
          ))}
        </ul>
      )}

      {page < totalPages && (
        <Button
          variant="outline"
          className="h-11"
          onClick={loadMore}
          disabled={isPending}
        >
          {isPending ? 'Loading…' : `Load more (${remaining} remaining)`}
        </Button>
      )}
    </div>
  )
}
