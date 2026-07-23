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

interface CustomersFilterProps {
  initialSearch?: string
  initialSource?: string
}

export function CustomersFilter({
  initialSearch = '',
  initialSource = 'all',
}: CustomersFilterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState(initialSearch)
  const [source, setSource] = useState(initialSource)

  const handleFilter = useCallback(
    (newSearch: string, newSource: string) => {
      const params = new URLSearchParams(searchParams.toString())

      if (newSearch) params.set('search', newSearch)
      else params.delete('search')

      if (newSource && newSource !== 'all') params.set('source', newSource)
      else params.delete('source')

      params.delete('page')

      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`)
      })
    },
    [pathname, router, searchParams]
  )

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="relative">
        <Search
          className={cn(
            'absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground',
            isPending && 'opacity-50'
          )}
        />
        <Input
          type="search"
          placeholder="Search name or email..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            handleFilter(e.target.value, source)
          }}
          className="pl-9"
        />
      </div>
      <Select
        value={source}
        onValueChange={(value) => {
          setSource(value)
          handleFilter(search, value)
        }}
        disabled={isPending}
      >
        <SelectTrigger>
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
    </div>
  )
}
