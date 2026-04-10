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

interface UsersFilterProps {
  initialSearch?: string
  initialRole?: string
}

export function UsersFilter({ initialSearch = '', initialRole = 'all' }: UsersFilterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState(initialSearch)
  const [role, setRole] = useState(initialRole)

  const handleSearch = useCallback(
    (newSearch: string, newRole: string) => {
      const params = new URLSearchParams(searchParams.toString())

      if (newSearch) {
        params.set('search', newSearch)
      } else {
        params.delete('search')
      }

      if (newRole && newRole !== 'all') {
        params.set('role', newRole)
      } else {
        params.delete('role')
      }

      // Reset to page 1 when filtering
      params.delete('page')

      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`)
      })
    },
    [pathname, router, searchParams],
  )

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="relative">
        <Search
          className={cn(
            'absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground',
            isPending && 'opacity-50',
          )}
        />
        <Input
          type="search"
          placeholder="Search users..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            handleSearch(e.target.value, role)
          }}
          className="pl-9"
        />
      </div>
      <Select
        value={role}
        onValueChange={(value) => {
          setRole(value)
          handleSearch(search, value)
        }}
        disabled={isPending}
      >
        <SelectTrigger>
          <SelectValue placeholder="All Roles" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Roles</SelectItem>
          <SelectItem value="CUSTOMER">Customer</SelectItem>
          <SelectItem value="WHOLESALE">Wholesale</SelectItem>
          <SelectItem value="STAFF">Staff</SelectItem>
          <SelectItem value="ADMIN">Admin</SelectItem>
          <SelectItem value="DEVELOPER">Developer</SelectItem>
          <SelectItem value="FUNDRAISER">Fundraiser</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
