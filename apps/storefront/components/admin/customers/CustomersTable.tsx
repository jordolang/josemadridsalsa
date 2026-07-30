'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type {
  CustomerSortColumn,
  SortDirection,
} from '@/lib/customers/customer-list'
import { CustomerEditDialog } from './CustomerEditDialog'
import { CreateMailingListDialog } from './CreateMailingListDialog'

export interface CustomerRow {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  accountType: string
  source: string
  sourceName: string | null
  emailStatus: string | null
  emailPermissionStatus: string | null
  totalOrders: number
  totalSpent: string
  lastOrderAt: string | null
}

interface CustomersTableProps {
  customers: CustomerRow[]
  sortBy: CustomerSortColumn
  sortDir: SortDirection
  /** Total matching the current filters, across every page. */
  totalMatching: number
  canWrite: boolean
  canCreateLists: boolean
}

const SOURCE_LABELS: Record<string, string> = {
  IMPORT: 'Imported',
  GUEST_ORDER: 'Guest order',
  REGISTERED: 'Registered',
  MANUAL: 'Manual',
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  STANDARD: 'Standard',
  FUNDRAISING: 'Fundraising',
  WHOLESALE: 'Wholesale',
}

const COLUMNS: Array<{
  key: CustomerSortColumn
  label: string
  align?: 'right'
  className?: string
}> = [
  { key: 'customer', label: 'Customer' },
  { key: 'phone', label: 'Phone', className: 'hidden md:table-cell' },
  { key: 'accountType', label: 'Account' },
  { key: 'sourceName', label: 'Organization', className: 'hidden lg:table-cell' },
  { key: 'source', label: 'Source', className: 'hidden lg:table-cell' },
  { key: 'emailStatus', label: 'Status', className: 'hidden xl:table-cell' },
  { key: 'orders', label: 'Orders', align: 'right' },
  { key: 'spent', label: 'Spent', align: 'right' },
  { key: 'lastOrder', label: 'Last order', className: 'hidden md:table-cell' },
]

function fullName(c: CustomerRow): string {
  return [c.firstName, c.lastName].filter(Boolean).join(' ').trim()
}

export function CustomersTable({
  customers,
  sortBy,
  sortDir,
  totalMatching,
  canWrite,
  canCreateLists,
}: CustomersTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<CustomerRow | null>(null)
  const [listOpen, setListOpen] = useState(false)

  const search = searchParams.get('search') ?? ''
  const source = searchParams.get('source') ?? ''
  const accountType = searchParams.get('accountType') ?? ''

  // Selection deliberately survives paging — picking rows across pages is the
  // point — but must not survive a filter change: the ticked rows would no
  // longer be on screen while the button still offered to build a list from
  // them.
  useEffect(() => {
    setSelected(new Set())
  }, [search, source, accountType])

  // Stable identities: the edit dialog re-seeds its draft when these change, so
  // inline arrows here would wipe whatever the user had typed on any re-render.
  const closeEditor = useCallback(() => setEditing(null), [])
  const onSaved = useCallback(() => {
    setEditing(null)
    router.refresh()
  }, [router])

  const pageIds = useMemo(() => customers.map((c) => c.id), [customers])
  const allOnPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id))

  const toggleSort = useCallback(
    (column: CustomerSortColumn) => {
      const params = new URLSearchParams(searchParams.toString())
      // First click on a new column sorts ascending; clicking the active column
      // flips it. Paging resets so you land on the first row of the new order.
      const nextDir: SortDirection =
        sortBy === column && sortDir === 'asc' ? 'desc' : 'asc'
      params.set('sortBy', column)
      params.set('sortDir', nextDir)
      params.delete('page')
      startTransition(() => router.push(`${pathname}?${params.toString()}`))
    },
    [pathname, router, searchParams, sortBy, sortDir]
  )

  const toggleRow = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const togglePage = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev)
      const selectAll = !pageIds.every((id) => next.has(id))
      for (const id of pageIds) {
        if (selectAll) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }, [pageIds])

  const filters = useMemo(
    () => ({
      search: search || undefined,
      source: source || undefined,
      accountType: accountType || undefined,
    }),
    [search, source, accountType]
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {selected.size > 0 ? (
            <>
              <span className="font-medium text-foreground">
                {selected.size.toLocaleString()}
              </span>{' '}
              selected
              <Button
                variant="link"
                size="sm"
                className="h-auto px-2 py-0"
                onClick={() => setSelected(new Set())}
              >
                Clear
              </Button>
            </>
          ) : (
            <>
              Showing {customers.length.toLocaleString()} of{' '}
              {totalMatching.toLocaleString()} matching customers
            </>
          )}
        </p>
        {canCreateLists && (
          <Button
            variant={selected.size > 0 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setListOpen(true)}
          >
            Create mailing list
            {selected.size > 0
              ? ` from ${selected.size.toLocaleString()} selected`
              : ` from all ${totalMatching.toLocaleString()}`}
          </Button>
        )}
      </div>

      <div className={cn('rounded-lg border', isPending && 'opacity-60')}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-9 w-9 px-2">
                <Checkbox
                  checked={allOnPageSelected}
                  onCheckedChange={togglePage}
                  aria-label="Select all on this page"
                />
              </TableHead>
              {COLUMNS.map((col) => {
                const active = sortBy === col.key
                return (
                  <TableHead
                    key={col.key}
                    className={cn(
                      'h-9 px-2',
                      col.align === 'right' && 'text-right',
                      col.className
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs font-medium uppercase tracking-wide hover:text-foreground',
                        active ? 'text-foreground' : 'text-muted-foreground'
                      )}
                      aria-label={`Sort by ${col.label}`}
                    >
                      {col.label}
                      {active ? (
                        sortDir === 'asc' ? (
                          <ArrowUp className="size-3" />
                        ) : (
                          <ArrowDown className="size-3" />
                        )
                      ) : (
                        <ChevronsUpDown className="size-3 opacity-40" />
                      )}
                    </button>
                  </TableHead>
                )
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c) => (
              <TableRow
                key={c.id}
                className={cn(
                  canWrite && 'cursor-pointer',
                  selected.has(c.id) && 'bg-muted/50'
                )}
                onClick={canWrite ? () => setEditing(c) : undefined}
              >
                <TableCell
                  className="px-2 py-1"
                  // The checkbox selects; it must not also open the editor.
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={selected.has(c.id)}
                    onCheckedChange={() => toggleRow(c.id)}
                    aria-label={`Select ${c.email}`}
                  />
                </TableCell>
                <TableCell className="max-w-[22rem] truncate px-2 py-1">
                  <span className="font-medium">{fullName(c) || 'No name'}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {c.email}
                  </span>
                </TableCell>
                <TableCell className="hidden whitespace-nowrap px-2 py-1 text-muted-foreground md:table-cell">
                  {c.phone || '—'}
                </TableCell>
                <TableCell className="px-2 py-1">
                  <Badge
                    variant={c.accountType === 'STANDARD' ? 'outline' : 'secondary'}
                    className="px-1.5 py-0 text-[11px] font-normal"
                  >
                    {ACCOUNT_TYPE_LABELS[c.accountType] ?? c.accountType}
                  </Badge>
                </TableCell>
                <TableCell className="hidden max-w-[16rem] truncate px-2 py-1 text-muted-foreground lg:table-cell">
                  {c.sourceName || '—'}
                </TableCell>
                <TableCell className="hidden whitespace-nowrap px-2 py-1 text-muted-foreground lg:table-cell">
                  {SOURCE_LABELS[c.source] ?? c.source}
                </TableCell>
                <TableCell className="hidden whitespace-nowrap px-2 py-1 text-muted-foreground xl:table-cell">
                  {c.emailStatus || '—'}
                </TableCell>
                <TableCell className="px-2 py-1 text-right tabular-nums">
                  {c.totalOrders}
                </TableCell>
                <TableCell className="px-2 py-1 text-right tabular-nums">
                  ${Number(c.totalSpent).toFixed(2)}
                </TableCell>
                <TableCell className="hidden whitespace-nowrap px-2 py-1 text-muted-foreground md:table-cell">
                  {c.lastOrderAt
                    ? new Date(c.lastOrderAt).toLocaleDateString()
                    : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {canWrite && (
        <CustomerEditDialog
          customer={editing}
          onClose={closeEditor}
          onSaved={onSaved}
        />
      )}

      {canCreateLists && (
        <CreateMailingListDialog
          open={listOpen}
          onOpenChange={setListOpen}
          selectedIds={[...selected]}
          totalMatching={totalMatching}
          filters={filters}
        />
      )}
    </div>
  )
}
