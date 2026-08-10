'use client'

import { useCallback, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FULFILLMENT_STATUS_LABELS } from '@/lib/orders/fulfillment'
import { SALES_CHANNEL_LABELS } from '@/lib/orders/sales-channel'
import { hasActiveOrderFilters, parseOrderFilters, SAVED_ORDER_VIEWS } from '@/lib/orders/order-filters'

const ORDER_STATUS_OPTIONS = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
] as const

const PAYMENT_STATUS_OPTIONS = [
  'PENDING',
  'PAID',
  'FAILED',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
] as const

const title = (v: string) => v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ')

/** Params the filter bar owns; anything else in the URL is left alone. */
const FILTER_KEYS = [
  'search',
  'status',
  'fulfillmentStatus',
  'salesChannel',
  'paymentStatus',
  'startDate',
  'endDate',
  'minTotal',
  'maxTotal',
  'view',
] as const

export function OrderFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const current = (key: string) => searchParams.get(key) ?? ''

  const apply = useCallback(
    (updates: Record<string, string | undefined>) => {
      const next = new URLSearchParams(searchParams.toString())

      for (const [key, value] of Object.entries(updates)) {
        if (!value || value === 'all') next.delete(key)
        else next.set(key, value)
      }
      // Any filter change invalidates the current page offset.
      next.delete('page')

      startTransition(() => router.push(`${pathname}?${next.toString()}`))
    },
    [pathname, router, searchParams]
  )

  const clearAll = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString())
    FILTER_KEYS.forEach((k) => next.delete(k))
    next.delete('page')
    startTransition(() => router.push(next.size ? `${pathname}?${next.toString()}` : pathname))
  }, [pathname, router, searchParams])

  const activeView = current('view')
  const hasAny = hasActiveOrderFilters(
    parseOrderFilters(Object.fromEntries(searchParams.entries()))
  )

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        {/* Saved views — the everyday questions, one click each. Selecting one replaces the
            previous view rather than stacking, so the label always describes the result. */}
        <div className="flex flex-wrap items-center gap-2">
          {SAVED_ORDER_VIEWS.map((view) => {
            const isActive = activeView === view.key
            return (
              <Badge
                key={view.key}
                variant={isActive ? 'default' : 'outline'}
                title={view.description}
                className="cursor-pointer select-none px-3 py-1"
                role="button"
                tabIndex={0}
                onClick={() => apply({ view: isActive ? undefined : view.key })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    apply({ view: isActive ? undefined : view.key })
                  }
                }}
              >
                {view.label}
              </Badge>
            )
          })}

          {hasAny && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              disabled={isPending}
              className="ml-auto"
            >
              <X className="mr-1 size-3" />
              Clear filters
            </Button>
          )}
        </div>

        <form
          className="flex flex-col gap-3 md:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            const value = new FormData(e.currentTarget).get('search')
            apply({ search: typeof value === 'string' ? value : undefined })
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              name="search"
              placeholder="Order number, customer, email, tracking number…"
              defaultValue={current('search')}
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary" disabled={isPending}>
            Search
          </Button>
        </form>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select value={current('status') || 'all'} onValueChange={(v) => apply({ status: v })}>
            <SelectTrigger aria-label="Order status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {ORDER_STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {title(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={current('fulfillmentStatus') || 'all'}
            onValueChange={(v) => apply({ fulfillmentStatus: v })}
          >
            <SelectTrigger aria-label="Fulfillment status">
              <SelectValue placeholder="All fulfillment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All fulfillment</SelectItem>
              {Object.entries(FULFILLMENT_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={current('salesChannel') || 'all'}
            onValueChange={(v) => apply({ salesChannel: v })}
          >
            <SelectTrigger aria-label="Sales channel">
              <SelectValue placeholder="All channels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All channels</SelectItem>
              {Object.entries(SALES_CHANNEL_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={current('paymentStatus') || 'all'}
            onValueChange={(v) => apply({ paymentStatus: v })}
          >
            <SelectTrigger aria-label="Payment status">
              <SelectValue placeholder="All payments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All payments</SelectItem>
              {PAYMENT_STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {title(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <label className="space-y-1 text-xs text-muted-foreground">
            From
            <Input
              type="date"
              defaultValue={current('startDate')}
              onChange={(e) => apply({ startDate: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            To
            <Input
              type="date"
              defaultValue={current('endDate')}
              onChange={(e) => apply({ endDate: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Min total
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
              defaultValue={current('minTotal')}
              onBlur={(e) => apply({ minTotal: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Max total
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder="Any"
              defaultValue={current('maxTotal')}
              onBlur={(e) => apply({ maxTotal: e.target.value })}
            />
          </label>
        </div>
      </CardContent>
    </Card>
  )
}
