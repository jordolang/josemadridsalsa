'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useState, useTransition } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

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
    [pathname, router, searchParams]
  )

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="relative">
        <Search className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${isPending ? 'opacity-50' : ''}`} />
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
      <select
        className="rounded-md border border-input px-3 py-2 text-sm bg-background text-foreground"
        value={role}
        onChange={(e) => {
          setRole(e.target.value)
          handleSearch(search, e.target.value)
        }}
        disabled={isPending}
      >
        <option value="all">All Roles</option>
        <option value="CUSTOMER">Customer</option>
        <option value="WHOLESALE">Wholesale</option>
        <option value="STAFF">Staff</option>
        <option value="ADMIN">Admin</option>
        <option value="DEVELOPER">Developer</option>
        <option value="FUNDRAISER">Fundraiser</option>
      </select>
    </div>
  )
}
