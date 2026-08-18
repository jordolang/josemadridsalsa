'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowDown, ArrowUp, ChevronsUpDown, Mail, Pencil } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { formatPhone } from '@/lib/fundraising/contact-consolidate'
import type { ContactSortColumn, SortDirection } from '@/lib/fundraising/contact-list'
import { FundraiserContactEditDialog } from './FundraiserContactEditDialog'
import { SolicitContactsDialog } from './SolicitContactsDialog'

export interface FundraiserContactRow {
  id: string
  organizationName: string
  contactName: string | null
  email: string | null
  phone: string | null
  totalJars: number
  totalOrders: number
  campaignCount: number
  years: number[]
  lastCampaignAt: string | null
  lastSolicitedAt: string | null
  solicitationCount: number
  isActive: boolean
  status: string
  source: string
  notes: string | null
}

const STATUS_LABELS: Record<string, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  RESPONDED: 'Responded',
  CONVERTED: 'Converted',
  DO_NOT_CONTACT: 'Do not contact',
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  NEW: 'outline',
  CONTACTED: 'secondary',
  RESPONDED: 'default',
  CONVERTED: 'default',
  DO_NOT_CONTACT: 'destructive',
}

const SOURCE_LABELS: Record<string, string> = {
  ARCHIVE_ORDER_FORM: 'Order form',
  ARCHIVE_ORDER_EXPORT: 'Order export',
  CONSTANT_CONTACT: 'Mailing list',
  WEBSITE_EXPORT: 'Supporter',
  MANUAL: 'Manual',
}

interface Props {
  contacts: FundraiserContactRow[]
  sortBy: ContactSortColumn
  sortDir: SortDirection
  totalMatching: number
  canWrite: boolean
  canSend: boolean
}

export function FundraiserContactsTable({
  contacts,
  sortBy,
  sortDir,
  totalMatching,
  canWrite,
  canSend,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<FundraiserContactRow | null>(null)
  const [solicitOpen, setSolicitOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const filterKey = [
    'search',
    'status',
    'source',
    'active',
    'hasEmail',
    'withHistory',
    'year',
  ]
    .map((key) => searchParams.get(key) ?? '')
    .join('|')

  // Selection survives paging — picking rows across pages is the point — but must not survive
  // a filter change: the ticked rows would no longer be on screen while the send button still
  // offered to mail them.
  useEffect(() => {
    setSelected(new Set())
  }, [filterKey])

  const pageIds = useMemo(() => contacts.map((c) => c.id), [contacts])
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id))

  const selectedContacts = useMemo(
    () => contacts.filter((c) => selected.has(c.id)),
    [contacts, selected],
  )

  const toggleSort = useCallback(
    (column: ContactSortColumn) => {
      const params = new URLSearchParams(searchParams.toString())
      const nextDir: SortDirection = sortBy === column && sortDir === 'asc' ? 'desc' : 'asc'
      params.set('sortBy', column)
      params.set('sortDir', nextDir)
      params.delete('page')
      startTransition(() => router.push(`${pathname}?${params.toString()}`))
    },
    [pathname, router, searchParams, sortBy, sortDir],
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

  const setActive = useCallback(
    async (contact: FundraiserContactRow, isActive: boolean) => {
      setBusyId(contact.id)
      setError(null)
      try {
        const response = await fetch(`/api/admin/fundraiser-contacts/${contact.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive }),
        })
        if (!response.ok) {
          const body = await response.json().catch(() => null)
          throw new Error(body?.error ?? 'Could not update this contact')
        }
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not update this contact')
      } finally {
        setBusyId(null)
      }
    },
    [router],
  )

  const runBulk = useCallback(
    async (action: 'activate' | 'deactivate') => {
      if (selected.size === 0) return
      setError(null)
      try {
        const response = await fetch('/api/admin/fundraiser-contacts/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: [...selected], action }),
        })
        if (!response.ok) {
          const body = await response.json().catch(() => null)
          throw new Error(body?.error ?? 'Bulk update failed')
        }
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Bulk update failed')
      }
    },
    [router, selected],
  )

  const mailableSelected = selectedContacts.filter(
    (c) => c.email && c.isActive && c.status !== 'DO_NOT_CONTACT',
  )

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-destructive rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {selected.size > 0 ? (
            <>
              <span className="text-foreground font-medium">{selected.size.toLocaleString()}</span>{' '}
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
              Showing {contacts.length.toLocaleString()} of {totalMatching.toLocaleString()}{' '}
              matching contacts
            </>
          )}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {canWrite && selected.size > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={() => runBulk('activate')}>
                Turn on
              </Button>
              <Button variant="outline" size="sm" onClick={() => runBulk('deactivate')}>
                Turn off
              </Button>
            </>
          )}
          {canSend && (
            <Button
              size="sm"
              disabled={mailableSelected.length === 0}
              onClick={() => setSolicitOpen(true)}
            >
              <Mail className="mr-2 h-4 w-4" />
              {mailableSelected.length > 0
                ? `Invite ${mailableSelected.length.toLocaleString()} to sign up`
                : 'Select contacts to invite'}
            </Button>
          )}
        </div>
      </div>

      <div className={cn('rounded-lg border', isPending && 'opacity-60')}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">
                <Checkbox
                  checked={allOnPageSelected}
                  onCheckedChange={togglePage}
                  aria-label="Select all contacts on this page"
                />
              </TableHead>
              <SortHeader column="organization" label="Organization" {...{ sortBy, sortDir, toggleSort }} />
              <SortHeader column="contact" label="Contact" {...{ sortBy, sortDir, toggleSort }} />
              <SortHeader column="jars" label="Jars" className="text-right" {...{ sortBy, sortDir, toggleSort }} />
              <SortHeader column="campaigns" label="Campaigns" className="text-right" {...{ sortBy, sortDir, toggleSort }} />
              <TableHead>Years</TableHead>
              <SortHeader column="status" label="Status" {...{ sortBy, sortDir, toggleSort }} />
              <SortHeader column="lastSolicited" label="Last invited" {...{ sortBy, sortDir, toggleSort }} />
              <TableHead className="w-20 text-center">Active</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-muted-foreground py-10 text-center">
                  No contacts match these filters.
                </TableCell>
              </TableRow>
            )}

            {contacts.map((contact) => (
              <TableRow
                key={contact.id}
                className={cn(
                  selected.has(contact.id) && 'bg-muted/50',
                  !contact.isActive && 'opacity-60',
                )}
              >
                <TableCell>
                  <Checkbox
                    checked={selected.has(contact.id)}
                    onCheckedChange={() => toggleRow(contact.id)}
                    aria-label={`Select ${contact.organizationName}`}
                  />
                </TableCell>

                <TableCell>
                  <div className="font-medium">{contact.organizationName}</div>
                  <div className="text-muted-foreground text-xs">
                    {SOURCE_LABELS[contact.source] ?? contact.source}
                  </div>
                </TableCell>

                <TableCell>
                  <div className="text-sm">{contact.contactName ?? '—'}</div>
                  <div className="text-muted-foreground text-xs">
                    {contact.email ?? (
                      <span className="text-amber-600 dark:text-amber-500">no email</span>
                    )}
                  </div>
                  {contact.phone && (
                    <div className="text-muted-foreground text-xs">{formatPhone(contact.phone)}</div>
                  )}
                </TableCell>

                <TableCell className="text-right tabular-nums">
                  {contact.totalJars > 0 ? contact.totalJars.toLocaleString() : '—'}
                </TableCell>

                <TableCell className="text-right tabular-nums">
                  {contact.campaignCount > 0 ? contact.campaignCount : '—'}
                </TableCell>

                <TableCell className="text-muted-foreground text-xs">
                  {contact.years.length > 0 ? contact.years.join(', ') : '—'}
                </TableCell>

                <TableCell>
                  <Badge variant={STATUS_VARIANTS[contact.status] ?? 'outline'}>
                    {STATUS_LABELS[contact.status] ?? contact.status}
                  </Badge>
                </TableCell>

                <TableCell className="text-muted-foreground text-xs">
                  {contact.lastSolicitedAt
                    ? new Date(contact.lastSolicitedAt).toLocaleDateString()
                    : '—'}
                  {contact.solicitationCount > 1 && ` (${contact.solicitationCount}x)`}
                </TableCell>

                <TableCell className="text-center">
                  <Switch
                    checked={contact.isActive}
                    disabled={!canWrite || busyId === contact.id}
                    onCheckedChange={(checked) => setActive(contact, checked)}
                    aria-label={`${contact.isActive ? 'Deactivate' : 'Activate'} ${contact.organizationName}`}
                  />
                </TableCell>

                <TableCell>
                  {canWrite && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditing(contact)}
                      aria-label={`Edit ${contact.organizationName}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editing && (
        <FundraiserContactEditDialog
          contact={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            router.refresh()
          }}
        />
      )}

      {solicitOpen && (
        <SolicitContactsDialog
          contacts={mailableSelected}
          onClose={() => setSolicitOpen(false)}
          onSent={() => {
            setSolicitOpen(false)
            setSelected(new Set())
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function SortHeader({
  column,
  label,
  className,
  sortBy,
  sortDir,
  toggleSort,
}: {
  column: ContactSortColumn
  label: string
  className?: string
  sortBy: ContactSortColumn
  sortDir: SortDirection
  toggleSort: (column: ContactSortColumn) => void
}) {
  const active = sortBy === column
  const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ChevronsUpDown

  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => toggleSort(column)}
        className={cn(
          'hover:text-foreground inline-flex items-center gap-1',
          active ? 'text-foreground font-medium' : 'text-muted-foreground',
        )}
      >
        {label}
        <Icon className="h-3.5 w-3.5" />
      </button>
    </TableHead>
  )
}
