'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Calendar,
  ClipboardList,
  DollarSign,
  Edit,
  ExternalLink,
  ListFilter,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import Link from 'next/link'
import { BOOKING_STATUSES, isDeadStatus, statusStyle } from './_components/event-status'
import {
  DEFAULT_FILTERS,
  filterEvents,
  type EventFilterState,
  type SortKey,
  type TimeFilter,
} from './_components/EventFilters'

interface FeaturedEvent {
  id: string
  title: string
  description?: string
  location?: string
  startDate: string
  endDate?: string
  featuredFrom: string
  featuredTo?: string
  isWhereIsJose: boolean
  googleEventId?: string
  manuallyModified: boolean
  displayPriority: number
  applicationDeadline?: string | null
  bookingStatus?: string | null
  /** Prisma serialises Decimal as a string over the wire. */
  boothFee?: string | number | null
  source?: string | null
  manifest?: { status: string } | null
  _count?: { staff: number; contacts: number }
}

const TIME_OPTIONS: Array<{ value: TimeFilter; label: string }> = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'weekend', label: 'This weekend' },
  { value: 'deadlines', label: 'Open deadlines' },
  { value: 'past', label: 'Past' },
  { value: 'all', label: 'All dates' },
]

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'startDate', label: 'Event date' },
  { value: 'deadline', label: 'Application deadline' },
  { value: 'title', label: 'Name' },
]

const SOURCE_LABELS: Record<string, string> = {
  GOOGLE_CALENDAR: 'Google',
  FESTIVALNET: 'FestivalNet',
}

const startOfDayLocal = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

export default function EventsPage() {
  const [events, setEvents] = useState<FeaturedEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [filters, setFilters] = useState<EventFilterState>(DEFAULT_FILTERS)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  useEffect(() => {
    fetchEvents()
    checkCalendarStatus()
  }, [])

  async function fetchEvents() {
    try {
      const response = await fetch('/api/admin/events')
      if (response.ok) {
        const data = await response.json()
        setEvents(data)
      }
    } catch (error) {
      console.error('Failed to fetch events:', error)
    } finally {
      setLoading(false)
    }
  }

  async function checkCalendarStatus() {
    try {
      const response = await fetch('/api/admin/events/calendar-status')
      if (response.ok) {
        const data = await response.json()
        setIsConnected(data.connected)
      }
    } catch {
      // silently ignore — status badge will just show Not Connected
    }
  }

  async function handleSync() {
    setSyncing(true)
    try {
      const response = await fetch('/api/admin/events/calendar-sync', {
        method: 'POST',
      })
      const data = await response.json().catch(() => null)
      if (response.ok) {
        toast.success(
          `Calendar synced: ${data?.created ?? 0} added, ${data?.updated ?? 0} updated${
            data?.skipped ? `, ${data.skipped} skipped (manually edited)` : ''
          }`
        )
        await fetchEvents()
      } else {
        toast.error(data?.error || 'Failed to sync calendar')
      }
    } catch (error) {
      console.error('Failed to sync calendar:', error)
      toast.error('Failed to sync calendar')
    } finally {
      setSyncing(false)
    }
  }

  const whereIsJoseEvents = events.filter(e => e.isWhereIsJose)
  const pipelineEvents = useMemo(() => events.filter(e => !e.isWhereIsJose), [events])
  const visibleEvents = useMemo(
    () => filterEvents(pipelineEvents, filters),
    [pipelineEvents, filters]
  )

  const visibleIds = visibleEvents.map(e => e.id)
  const selectedVisible = visibleIds.filter(id => selected.has(id))
  const allVisibleSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length
  const filtersActive =
    filters.search !== DEFAULT_FILTERS.search ||
    filters.statuses.length > 0 ||
    filters.time !== DEFAULT_FILTERS.time ||
    filters.sort !== DEFAULT_FILTERS.sort

  function toggleSelected(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    // Only ever acts on what's on screen, so a hidden past show can't be swept
    // into a bulk delete.
    setSelected(allVisibleSelected ? new Set() : new Set(visibleIds))
  }

  async function runBulk(action: 'status' | 'delete', bookingStatus?: string) {
    const ids = selectedVisible
    if (ids.length === 0) return

    if (
      action === 'delete' &&
      !confirm(
        `Delete ${ids.length} event${ids.length === 1 ? '' : 's'}? Their staff, contacts, and product manifests go too.`
      )
    ) {
      return
    }

    setBulkBusy(true)
    try {
      const response = await fetch('/api/admin/events/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action, bookingStatus }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error || 'Bulk action failed')
        return
      }

      toast.success(
        action === 'delete'
          ? `${data?.deleted ?? 0} event(s) deleted`
          : `${data?.updated ?? 0} event(s) updated`
      )
      setSelected(new Set())
      await fetchEvents()
    } catch (error) {
      console.error('Bulk action failed:', error)
      toast.error('Bulk action failed')
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Events</h1>
          <p className="text-muted-foreground">Track shows from first interest through show day</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/events/calendar">
            <Button variant="outline">
              <Calendar className="mr-2 h-4 w-4" />
              Calendar view
            </Button>
          </Link>
          <Link href="/admin/events/import">
            <Button variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
          </Link>
          <Button onClick={handleSync} disabled={syncing || !isConnected} variant="outline">
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            Sync Calendar
          </Button>
          <Link href="/admin/events/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Event
            </Button>
          </Link>
        </div>
      </div>

      {/* Sync Status Card */}
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-2">Google Calendar Integration</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Sync events from your Google Calendar to display on your website
            </p>
            <Badge className={isConnected ? 'bg-primary/10 text-primary' : 'bg-yellow-100 text-yellow-800'}>
              {isConnected ? 'Connected' : 'Not Connected'}
            </Badge>
          </div>
          {!isConnected && (
            <p className="text-sm text-muted-foreground mt-2">
              Set <code className="text-xs bg-muted px-1 py-0.5 rounded">GOOGLE_CALENDAR_ID</code> in your environment variables to enable calendar sync.
            </p>
          )}
        </div>
      </Card>

      {/* Where is Jose Section */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">"Where is Jose?" Events</h2>
            <p className="text-sm text-muted-foreground">Special events marked for the "Where is Jose?" feature</p>
          </div>
        </div>
        {whereIsJoseEvents.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="mx-auto mb-4 h-12 w-12 text-muted-foreground/60" />
            <p>No "Where is Jose?" events scheduled</p>
          </div>
        ) : (
          <div className="space-y-3">
            {whereIsJoseEvents.map(event => (
              <EventCard key={event.id} event={event} onRefresh={fetchEvents} />
            ))}
          </div>
        )}
      </Card>

      {/* Booking pipeline */}
      <Card className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold">All Shows</h2>
            <p className="text-sm text-muted-foreground">
              Every show we're interested in, applied to, or booked
            </p>
          </div>
          <span className="text-sm text-muted-foreground">
            Showing {visibleEvents.length} of {pipelineEvents.length}
          </span>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[14rem] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              placeholder="Search name or location"
              aria-label="Search events"
              className="pl-8"
            />
          </div>

          <Select
            value={filters.time}
            onValueChange={(v: TimeFilter) => setFilters(f => ({ ...f, time: v }))}
          >
            <SelectTrigger className="w-[11rem]" aria-label="Filter by date">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <ListFilter className="mr-2 h-4 w-4" />
                Status
                {filters.statuses.length > 0 && (
                  <Badge className="ml-2 bg-primary/10 text-primary">{filters.statuses.length}</Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Booking status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {BOOKING_STATUSES.map(status => (
                <DropdownMenuCheckboxItem
                  key={status}
                  checked={filters.statuses.includes(status)}
                  onCheckedChange={() =>
                    setFilters(f => ({
                      ...f,
                      statuses: f.statuses.includes(status)
                        ? f.statuses.filter(s => s !== status)
                        : [...f.statuses, status],
                    }))
                  }
                  onSelect={e => e.preventDefault()}
                >
                  <span className={`mr-2 h-2 w-2 rounded-full ${statusStyle(status).dot}`} aria-hidden />
                  {statusStyle(status).label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Select
            value={filters.sort}
            onValueChange={(v: SortKey) => setFilters(f => ({ ...f, sort: v }))}
          >
            <SelectTrigger className="w-[13rem]" aria-label="Sort events">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>
                  Sort: {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {filtersActive && (
            <Button variant="ghost" onClick={() => setFilters(DEFAULT_FILTERS)}>
              Clear
            </Button>
          )}
        </div>

        {selectedVisible.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 p-3">
            <span className="text-sm font-medium">
              {selectedVisible.length} selected
            </span>
            <Select
              value=""
              disabled={bulkBusy}
              onValueChange={v => runBulk('status', v)}
            >
              <SelectTrigger className="w-[13rem]" aria-label="Set booking status">
                <SelectValue placeholder="Set status to…" />
              </SelectTrigger>
              <SelectContent>
                {BOOKING_STATUSES.map(status => (
                  <SelectItem key={status} value={status}>
                    {statusStyle(status).label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              disabled={bulkBusy}
              onClick={() => runBulk('delete')}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear selection
            </Button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : visibleEvents.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="mx-auto mb-4 h-12 w-12 text-muted-foreground/60" />
            <p>{pipelineEvents.length === 0 ? 'No events yet' : 'No events match these filters'}</p>
          </div>
        ) : (
          <>
            <label className="mb-2 flex w-fit items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={allVisibleSelected}
                onCheckedChange={toggleSelectAll}
                aria-label="Select all shown events"
              />
              Select all shown
            </label>
            <div className="space-y-3">
              {visibleEvents.map(event => (
                <EventCard
                  key={event.id}
                  event={event}
                  onRefresh={fetchEvents}
                  selected={selected.has(event.id)}
                  onToggleSelected={() => toggleSelected(event.id)}
                />
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

function EventCard({
  event,
  onRefresh,
  selected,
  onToggleSelected,
}: {
  event: FeaturedEvent
  onRefresh: () => void
  selected?: boolean
  onToggleSelected?: () => void
}) {
  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this event?')) return

    try {
      const response = await fetch(`/api/admin/events/${event.id}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        toast.success('Event deleted')
        onRefresh()
      } else {
        toast.error('Failed to delete event')
      }
    } catch (error) {
      console.error('Failed to delete event:', error)
      toast.error('Failed to delete event')
    }
  }

  const staffCount = event._count?.staff ?? 0
  const contactCount = event._count?.contacts ?? 0
  const status = event.bookingStatus ?? 'CONFIRMED'
  const style = statusStyle(status)
  const sourceLabel = event.source ? SOURCE_LABELS[event.source] : undefined
  const boothFee = event.boothFee === null || event.boothFee === undefined ? null : Number(event.boothFee)

  const deadline = event.applicationDeadline ? new Date(event.applicationDeadline) : null
  const validDeadline = deadline && !Number.isNaN(deadline.getTime()) ? deadline : null
  const daysToDeadline = validDeadline
    ? Math.round((startOfDayLocal(validDeadline) - startOfDayLocal(new Date())) / 86_400_000)
    : null
  // Only nag about deadlines we can still act on.
  const deadlineUrgent =
    daysToDeadline !== null && daysToDeadline >= 0 && daysToDeadline <= 14 && !isDeadStatus(status)

  return (
    <div className={`border rounded-lg p-4 hover:bg-muted/50 ${isDeadStatus(status) ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between">
        {onToggleSelected && (
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelected}
            aria-label={`Select ${event.title}`}
            className="mr-3 mt-1"
          />
        )}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="font-semibold">{event.title}</h3>
            <Badge className={`text-xs ${style.badge}`}>{style.label}</Badge>
            {sourceLabel && (
              <Badge variant="outline" className="text-xs">
                <ExternalLink className="h-3 w-3 mr-1" />
                {sourceLabel}
              </Badge>
            )}
            {event.manuallyModified && (
              <Badge variant="outline" className="text-xs bg-primary/5">
                Modified
              </Badge>
            )}
            {event.manifest && (
              <Badge variant="outline" className="text-xs">
                Manifest: {event.manifest.status}
              </Badge>
            )}
          </div>
          {event.description && (
            <p className="text-sm text-muted-foreground mb-2">{event.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {new Date(event.startDate).toLocaleDateString()}
            </span>
            {event.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {event.location}
              </span>
            )}
            {validDeadline && (
              <span
                className={`flex items-center gap-1 ${deadlineUrgent ? 'font-medium text-amber-700 dark:text-amber-400' : ''}`}
              >
                <AlertTriangle className="h-4 w-4" />
                Apply by {validDeadline.toLocaleDateString()}
                {deadlineUrgent && (daysToDeadline === 0 ? ' (today)' : ` (${daysToDeadline}d)`)}
              </span>
            )}
            {boothFee !== null && <span>Booth ${boothFee.toFixed(2)}</span>}
            {(staffCount > 0 || contactCount > 0) && (
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {staffCount} staff · {contactCount} contacts
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 ml-4">
          <Link href={`/admin/events/${event.id}/manifest`}>
            <Button size="sm" variant="ghost" title="Product manifest">
              <ClipboardList className="h-4 w-4" />
            </Button>
          </Link>
          <Link href={`/admin/events/${event.id}/financials`}>
            <Button size="sm" variant="ghost" title="Show financials & break-even">
              <DollarSign className="h-4 w-4" />
            </Button>
          </Link>
          <Link href={`/admin/events/${event.id}/edit`}>
            <Button size="sm" variant="ghost" title="Edit event">
              <Edit className="h-4 w-4" />
            </Button>
          </Link>
          <Button size="sm" variant="ghost" onClick={handleDelete} title="Delete event">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
