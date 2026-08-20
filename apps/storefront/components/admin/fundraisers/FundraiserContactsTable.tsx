'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Mail,
  Pencil,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'

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

/** Matches the `ids` array cap on POST /api/admin/fundraiser-contacts/bulk, with headroom. */
const BULK_CHUNK = 1000

/** Mirrors MAX_IDS in GET /api/admin/fundraiser-contacts/ids. */
const SELECTION_CAP = 10_000

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
  const [bulkBusy, setBulkBusy] = useState(false)
  // True once the selection was expanded past the visible page, so the banner can say so.
  const [allMatchingSelected, setAllMatchingSelected] = useState(false)
  /**
   * Set when the server could not return every matching id. A capped selection is *not*
   * "everything matching", and saying so would let an operator run a bulk action believing it
   * covered rows it never touched — so this survives alongside the selection rather than
   * living in the transient error slot.
   */
  const [cappedAt, setCappedAt] = useState<{ selected: number; total: number } | null>(null)

  const filterKeyRef = useRef('')
  /**
   * Bumped by every deliberate selection change. `selectAllMatching` captures it and discards
   * its response if it moved — otherwise clicking Clear (or unticking a row) while "Selecting…"
   * is in flight would be undone when the response landed.
   */
  const selectionGeneration = useRef(0)
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
    filterKeyRef.current = filterKey
    setSelected(new Set())
    setAllMatchingSelected(false)
    setCappedAt(null)
  }, [filterKey])

  const clearSelection = useCallback(() => {
    selectionGeneration.current += 1
    setSelected(new Set())
    setAllMatchingSelected(false)
    setCappedAt(null)
  }, [])

  const pageIds = useMemo(() => contacts.map((c) => c.id), [contacts])
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id))
  const someOnPageSelected = pageIds.some((id) => selected.has(id))
  // Radix renders 'indeterminate' as a dash, which is what a partly-ticked page should look
  // like — a plain unchecked box implies clicking it would select nothing new.
  const headerCheckboxState = allOnPageSelected
    ? true
    : someOnPageSelected
      ? 'indeterminate'
      : false

  /** More rows match the filters than the page can show, so "select all" has somewhere to go. */
  const hasMoreThanPage = totalMatching > contacts.length

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
    selectionGeneration.current += 1
    setAllMatchingSelected(false)
    setCappedAt(null)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const togglePage = useCallback(() => {
    selectionGeneration.current += 1
    setAllMatchingSelected(false)
    setCappedAt(null)
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

  /**
   * Pulls every id matching the current filters, not just the visible page. Selecting 2,000
   * contacts one page at a time is the thing this list is worst at, and turning a whole
   * filtered segment on or off is the main reason to bulk-edit at all.
   */
  const selectAllMatching = useCallback(async () => {
    setBulkBusy(true)
    setError(null)
    // The filters this request was issued for. If they change while it is in flight, the
    // response describes a view the operator has already navigated away from, and installing
    // its ids would arm the bulk buttons against rows that are no longer on screen.
    const issuedFor = filterKey
    const generation = selectionGeneration.current
    try {
      const query = new URLSearchParams()
      for (const key of ['search', 'status', 'source', 'active', 'hasEmail', 'withHistory', 'year']) {
        const value = searchParams.get(key)
        if (value) query.set(key, value)
      }
      const response = await fetch(`/api/admin/fundraiser-contacts/ids?${query.toString()}`)
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error ?? 'Could not select all matching contacts')
      // Stale on either axis: the filters moved, or the operator changed the selection by hand.
      if (issuedFor !== filterKeyRef.current || generation !== selectionGeneration.current) return

      // `ok()` serializes its argument directly — there is no `data` envelope.
      const ids: string[] = body?.ids ?? []
      setSelected(new Set(ids))
      setAllMatchingSelected(true)
      setCappedAt(body?.truncated ? { selected: ids.length, total: body?.total ?? ids.length } : null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not select all matching contacts')
    } finally {
      setBulkBusy(false)
    }
  }, [searchParams, filterKey])

  const runBulk = useCallback(
    async (action: 'activate' | 'deactivate') => {
      if (selected.size === 0) return
      setBulkBusy(true)
      setError(null)
      try {
        // The bulk route caps ids per request; a whole-set selection can exceed that, so send
        // it in chunks rather than letting the request bounce.
        const ids = [...selected]
        let applied = 0
        for (let i = 0; i < ids.length; i += BULK_CHUNK) {
          const chunk = ids.slice(i, i + BULK_CHUNK)
          const response = await fetch('/api/admin/fundraiser-contacts/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: chunk, action }),
          })
          const body = await response.json().catch(() => null)
          if (!response.ok) {
            // Chunks commit independently, so a late failure leaves earlier ones applied.
            // Saying how many landed is the difference between "nothing happened, retry" and
            // "part of your selection changed" — the operator cannot tell them apart from the
            // table alone.
            const detail =
              applied > 0
                ? ` ${applied.toLocaleString()} of ${ids.length.toLocaleString()} contacts were already updated before this failed.`
                : ''
            throw new Error(`${body?.error ?? 'Bulk update failed'}.${detail}`)
          }
          // Rows can vanish between id resolution and the update, so trust the route's count
          // rather than the size of what we asked for.
          applied += typeof body?.updated === 'number' ? body.updated : chunk.length
        }
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Bulk update failed')
        // Some chunks may have committed; re-read so the rows on screen match the database.
        router.refresh()
      } finally {
        setBulkBusy(false)
      }
    },
    [router, selected],
  )

  // Loaded rows that look mailable — used for the dialog's preview list only. The real
  // recipient count is resolved server-side, because the selection can cover rows this page
  // never loaded.
  const mailableSelected = selectedContacts.filter(
    (c) => c.email && c.isActive && c.status !== 'DO_NOT_CONTACT',
  )
  const selectedIds = useMemo(() => [...selected], [selected])

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
              <span className="text-foreground font-medium" data-testid="selection-count">
                {selected.size.toLocaleString()}
              </span>{' '}
              selected
              <Button
                variant="link"
                size="sm"
                className="h-auto px-2 py-0"
                onClick={clearSelection}
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
              <Button
                variant="outline"
                size="sm"
                disabled={bulkBusy}
                onClick={() => runBulk('activate')}
              >
                <ToggleRight className="mr-2 h-4 w-4" />
                Set {selected.size.toLocaleString()} active
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={bulkBusy}
                onClick={() => runBulk('deactivate')}
              >
                <ToggleLeft className="mr-2 h-4 w-4" />
                Set {selected.size.toLocaleString()} inactive
              </Button>
            </>
          )}
          {canSend && (
            <Button
              size="sm"
              disabled={selected.size === 0 || bulkBusy}
              onClick={() => setSolicitOpen(true)}
            >
              <Mail className="mr-2 h-4 w-4" />
              {selected.size > 0
                ? `Invite ${selected.size.toLocaleString()} selected`
                : 'Select contacts to invite'}
            </Button>
          )}
        </div>
      </div>

      {/*
        Offered only once the page is fully ticked, which is the moment the page-vs-everything
        distinction becomes real: before that, "select all 2,082" would be a surprise. Once the
        selection has been widened it stays visible regardless — that state has to be
        dismissible, and it is the only thing telling the operator that the buttons above act
        on rows they cannot see.
      */}
      {((allOnPageSelected && hasMoreThanPage) || allMatchingSelected) && (
        <div
          data-testid="selection-banner"
          className="bg-muted/50 flex flex-wrap items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm"
        >
          {allMatchingSelected ? (
            cappedAt ? (
              <>
                <span className="text-amber-700 dark:text-amber-500">
                  Only the first{' '}
                  <span className="font-medium">{cappedAt.selected.toLocaleString()}</span> of{' '}
                  {cappedAt.total.toLocaleString()} matching contacts are selected — this list is
                  capped. Narrow the filters to reach the rest.
                </span>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto px-1 py-0"
                  onClick={clearSelection}
                >
                  Clear selection
                </Button>
              </>
            ) : (
              <>
                <span>
                  All <span className="font-medium">{selected.size.toLocaleString()}</span> contacts
                  matching these filters are selected.
                </span>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto px-1 py-0"
                  onClick={clearSelection}
                >
                  Clear selection
                </Button>
              </>
            )
          ) : (
            <>
              <span>
                All {contacts.length.toLocaleString()} contacts on this page are selected.
              </span>
              <Button
                variant="link"
                size="sm"
                className="h-auto px-1 py-0"
                disabled={bulkBusy}
                onClick={selectAllMatching}
              >
                {bulkBusy
                  ? 'Selecting…'
                  : /* Never advertise more than the endpoint will return. */
                    `Select all ${Math.min(totalMatching, SELECTION_CAP).toLocaleString()} matching these filters`}
              </Button>
            </>
          )}
        </div>
      )}

      <div className={cn('rounded-lg border', isPending && 'opacity-60')}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">
                <Checkbox
                  checked={headerCheckboxState}
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
          contactIds={selectedIds}
          previewContacts={mailableSelected}
          onClose={() => setSolicitOpen(false)}
          onSent={() => {
            setSolicitOpen(false)
            clearSelection()
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
