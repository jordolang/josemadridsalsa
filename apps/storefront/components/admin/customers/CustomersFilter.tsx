'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useState, useTransition } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { CUSTOMER_PAGE_SIZES } from '@/lib/customers/customer-list'

interface CustomersFilterProps {
  initialSearch?: string
  initialSource?: string
  initialAccountType?: string
  initialPageSize?: number
}

export function CustomersFilter({
  initialSearch = '',
  initialSource = 'all',
  initialAccountType = 'all',
  initialPageSize,
}: CustomersFilterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState(initialSearch)
  const [source, setSource] = useState(initialSource)
  const [accountType, setAccountType] = useState(initialAccountType)
  const [pageSize, setPageSize] = useState(String(initialPageSize ?? ''))

  /**
   * Rewrites only the params this component owns and leaves the rest — the
   * sort in particular — untouched, so changing a filter doesn't silently
   * reset the column you sorted by. Page always resets to 1 because the old
   * page number rarely exists in the new result set.
   */
  const apply = useCallback(
    (next: {
      search?: string
      source?: string
      accountType?: string
      pageSize?: string
    }) => {
      const params = new URLSearchParams(searchParams.toString())

      const set = (key: string, value: string | undefined, blank: string) => {
        if (value && value !== blank) params.set(key, value)
        else params.delete(key)
      }

      set('search', next.search, '')
      set('source', next.source, 'all')
      set('accountType', next.accountType, 'all')
      set('pageSize', next.pageSize, '')

      params.delete('page')

      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`)
      })
    },
    [pathname, router, searchParams]
  )

  const current = { search, source, accountType, pageSize }

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <div className="relative md:col-span-2">
        <Search
          className={cn(
            'absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground',
            isPending && 'opacity-50'
          )}
        />
        <Input
          type="search"
          placeholder="Search name, email, phone or organization..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            apply({ ...current, search: e.target.value })
          }}
          className="pl-9"
        />
      </div>

      <Select
        value={accountType}
        onValueChange={(value) => {
          setAccountType(value)
          apply({ ...current, accountType: value })
        }}
        disabled={isPending}
      >
        <SelectTrigger aria-label="Account type">
          <SelectValue placeholder="All Accounts" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Accounts</SelectItem>
          <SelectItem value="STANDARD">Standard</SelectItem>
          <SelectItem value="FUNDRAISING">Fundraising</SelectItem>
          <SelectItem value="WHOLESALE">Wholesale</SelectItem>
        </SelectContent>
      </Select>

      <div className="grid grid-cols-2 gap-2">
        <Select
          value={source}
          onValueChange={(value) => {
            setSource(value)
            apply({ ...current, source: value })
          }}
          disabled={isPending}
        >
          <SelectTrigger aria-label="Source">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="IMPORT">Imported</SelectItem>
            <SelectItem value="GUEST_ORDER">Guest order</SelectItem>
            <SelectItem value="REGISTERED">Registered</SelectItem>
            <SelectItem value="MANUAL">Manual</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={pageSize}
          onValueChange={(value) => {
            setPageSize(value)
            apply({ ...current, pageSize: value })
          }}
          disabled={isPending}
        >
          <SelectTrigger aria-label="Rows per page">
            <SelectValue placeholder="Rows" />
          </SelectTrigger>
          <SelectContent>
            {CUSTOMER_PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size.toLocaleString()} rows
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
