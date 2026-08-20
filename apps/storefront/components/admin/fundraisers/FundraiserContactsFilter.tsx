'use client'

import { useCallback, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
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

const ALL = 'all'

/**
 * Rewrites only the params this component owns and leaves the rest — the sort in particular —
 * untouched, so changing a filter does not silently reset the column you sorted by. Page
 * always resets to 1 because the old page number rarely exists in the new result set.
 */
export function FundraiserContactsFilter({ years }: { years: number[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState(searchParams.get('search') ?? '')

  const apply = useCallback(
    (next: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(next)) {
        if (value && value !== ALL) params.set(key, value)
        else params.delete(key)
      }
      params.delete('page')
      startTransition(() => router.push(`${pathname}?${params.toString()}`))
    },
    [pathname, router, searchParams],
  )

  const current = (key: string) => searchParams.get(key) ?? ALL

  return (
    <div className={cn('flex flex-wrap items-center gap-2', isPending && 'opacity-60')}>
      <form
        className="relative min-w-[240px] flex-1"
        onSubmit={(event) => {
          event.preventDefault()
          apply({ search })
        }}
      >
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search organization, contact, email, or phone"
          className="pl-9"
          aria-label="Search fundraiser contacts"
        />
      </form>

      <FilterSelect
        label="Active"
        value={current('active')}
        onChange={(value) => apply({ active: value })}
        options={[
          [ALL, 'Active and inactive'],
          ['active', 'Active only'],
          ['inactive', 'Inactive only'],
        ]}
      />

      <FilterSelect
        label="Status"
        value={current('status')}
        onChange={(value) => apply({ status: value })}
        options={[
          [ALL, 'Any status'],
          ['NEW', 'New'],
          ['CONTACTED', 'Contacted'],
          ['RESPONDED', 'Responded'],
          ['CONVERTED', 'Converted'],
          ['DO_NOT_CONTACT', 'Do not contact'],
        ]}
      />

      <FilterSelect
        label="Email"
        value={current('hasEmail')}
        onChange={(value) => apply({ hasEmail: value })}
        options={[
          [ALL, 'With or without email'],
          ['yes', 'Has an email'],
          ['no', 'No email'],
        ]}
      />

      <FilterSelect
        label="Source"
        value={current('source')}
        onChange={(value) => apply({ source: value })}
        options={[
          [ALL, 'Any source'],
          ['ARCHIVE_ORDER_FORM', 'Archive order form'],
          ['ARCHIVE_ORDER_EXPORT', 'Archive order export'],
          ['CONSTANT_CONTACT', 'Old mailing list'],
          ['WEBSITE_EXPORT', 'Website supporter'],
          ['MANUAL', 'Added by hand'],
        ]}
      />

      <FilterSelect
        label="History"
        value={current('withHistory')}
        onChange={(value) => apply({ withHistory: value })}
        options={[
          [ALL, 'Any history'],
          ['yes', 'Has past campaigns'],
        ]}
      />

      {years.length > 0 && (
        <FilterSelect
          label="Year"
          value={current('year')}
          onChange={(value) => apply({ year: value })}
          options={[[ALL, 'Any year'], ...years.map((y) => [String(y), String(y)] as [string, string])]}
        />
      )}
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: [string, string][]
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-auto min-w-[150px]" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([optionValue, optionLabel]) => (
          <SelectItem key={optionValue} value={optionValue}>
            {optionLabel}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
