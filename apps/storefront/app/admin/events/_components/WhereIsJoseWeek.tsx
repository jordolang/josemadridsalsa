'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { format, isToday } from 'date-fns'
import {
  AlertTriangle,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  DollarSign,
  Download,
  Edit,
  FileSpreadsheet,
  Link2,
  Mail,
  MapPin,
  Megaphone,
  Share2,
  Star,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from '@/components/ui/pagination'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  dayKey,
  eventDays,
  shiftWeek,
  weekBounds,
  weekDays,
  weekRangeLabel,
  weekStart,
} from '@/lib/events/calendar-view'
import { isDeadStatus, statusStyle } from './event-status'

/**
 * Structurally compatible with the list view's FeaturedEvent, so the Events
 * page can hand the same array to both without a second fetch.
 */
export interface WeekEvent {
  id: string
  title: string
  location?: string
  startDate: string
  endDate?: string
  isWhereIsJose: boolean
  applicationDeadline?: string | null
  bookingStatus?: string | null
  manifest?: { status: string } | null
}

/** How many week buttons sit either side of the current one in the pager. */
const PAGER_RADIUS = 2

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** `<input type="date">` value -> local Date. Parsing the string directly would land in UTC. */
function fromDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const [, y, m, d] = match
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  return Number.isNaN(date.getTime()) ? null : date
}

/** Times only read as meaningful when someone actually entered one. */
function timeLabel(event: WeekEvent): string | null {
  const start = new Date(event.startDate)
  if (Number.isNaN(start.getTime())) return null
  if (start.getHours() === 0 && start.getMinutes() === 0) return null
  return format(start, 'h:mm a')
}

function shareText(event: WeekEvent, siteUrl: string): string {
  const start = new Date(event.startDate)
  const when = Number.isNaN(start.getTime())
    ? null
    : format(start, timeLabel(event) ? "EEEE, MMMM d, yyyy 'at' h:mm a" : 'EEEE, MMMM d, yyyy')

  return [event.title, when, event.location, `${siteUrl}/where-is-jose`]
    .filter(Boolean)
    .join('\n')
}

export default function WhereIsJoseWeek({
  events,
  loading,
  onRefresh,
}: {
  events: WeekEvent[]
  loading: boolean
  onRefresh: () => void
}) {
  const [cursor, setCursor] = useState(() => weekStart(new Date()))
  const [openDay, setOpenDay] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const days = useMemo(() => weekDays(cursor), [cursor])

  const { eventsByDay, deadlinesByDay } = useMemo(() => {
    const byDay = new Map<string, WeekEvent[]>()
    const deadlines = new Map<string, WeekEvent[]>()

    for (const event of events) {
      for (const day of eventDays(event.startDate, event.endDate)) {
        const key = dayKey(day)
        const list = byDay.get(key)
        if (list) list.push(event)
        else byDay.set(key, [event])
      }

      if (event.applicationDeadline) {
        const due = new Date(event.applicationDeadline)
        if (!Number.isNaN(due.getTime())) {
          const key = dayKey(due)
          const list = deadlines.get(key)
          if (list) list.push(event)
          else deadlines.set(key, [event])
        }
      }
    }

    // "Where is Jose?" events lead each cell — they are the point of this view.
    for (const list of byDay.values()) {
      list.sort((a, b) => Number(b.isWhereIsJose) - Number(a.isWhereIsJose))
    }

    return { eventsByDay: byDay, deadlinesByDay: deadlines }
  }, [events])

  const weekHasWij = days.some((day) =>
    (eventsByDay.get(dayKey(day)) ?? []).some((e) => e.isWhereIsJose)
  )

  const exportHref = (params: Record<string, string>) =>
    `/api/admin/events/export?${new URLSearchParams(params).toString()}`

  const { start: rangeStart, end: rangeEnd } = weekBounds(cursor)

  const selectedDay = openDay ? fromDateInput(openDay) : null

  async function toggleWhereIsJose(event: WeekEvent) {
    setBusyId(event.id)
    try {
      const response = await fetch(`/api/admin/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isWhereIsJose: !event.isWhereIsJose }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        toast.error(data?.error || 'Failed to update event')
        return
      }
      toast.success(
        event.isWhereIsJose
          ? `Removed "${event.title}" from Where is Jose?`
          : `Added "${event.title}" to Where is Jose?`
      )
      onRefresh()
    } catch (error) {
      console.error('Failed to toggle Where is Jose:', error)
      toast.error('Failed to update event')
    } finally {
      setBusyId(null)
    }
  }

  async function copyDetails(event: WeekEvent) {
    try {
      await navigator.clipboard.writeText(shareText(event, window.location.origin))
      toast.success('Event details copied')
    } catch {
      toast.error('Could not reach the clipboard')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <WeekPager cursor={cursor} onChange={setCursor} />

        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>This week</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <a
                  href={exportHref({
                    format: 'ics',
                    scope: 'range',
                    from: rangeStart.toISOString(),
                    to: rangeEnd.toISOString(),
                  })}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Calendar file (.ics)
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a
                  href={exportHref({
                    format: 'csv',
                    scope: 'range',
                    from: rangeStart.toISOString(),
                    to: rangeEnd.toISOString(),
                  })}
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Spreadsheet (.csv)
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Everything</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <a href={exportHref({ format: 'ics', scope: 'wij' })}>
                  <Star className="mr-2 h-4 w-4" />
                  All &ldquo;Where is Jose?&rdquo; (.ics)
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Link href="/admin/events/import">
            <Button variant="outline" size="sm">
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[44rem] grid-cols-7 gap-px rounded-lg border bg-border">
          {days.map((day) => {
            const key = dayKey(day)
            const dayEvents = eventsByDay.get(key) ?? []
            const dayDeadlines = deadlinesByDay.get(key) ?? []
            const isWeekend = day.getDay() === 0 || day.getDay() === 6

            return (
              <button
                key={key}
                type="button"
                onClick={() => setOpenDay(key)}
                aria-label={`${format(day, 'EEEE, MMMM d')} — ${dayEvents.length} event${
                  dayEvents.length === 1 ? '' : 's'
                }`}
                className={[
                  'flex min-h-32 flex-col gap-1 p-2 text-left transition-colors hover:bg-muted/60',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isWeekend ? 'bg-muted/30' : 'bg-background',
                ].join(' ')}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {DAY_HEADERS[day.getDay()]}
                  </span>
                  <span
                    className={[
                      'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs',
                      isToday(day)
                        ? 'bg-primary font-semibold text-primary-foreground'
                        : 'text-muted-foreground',
                    ].join(' ')}
                  >
                    {format(day, 'd')}
                  </span>
                </div>

                <div className="space-y-1">
                  {dayDeadlines.map((event) => (
                    <span
                      key={`dl-${event.id}`}
                      className="flex items-start gap-1 rounded border border-amber-400/60 bg-amber-50 px-1 py-0.5 text-[11px] leading-tight text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/60 dark:text-amber-200"
                    >
                      <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
                      <span className="truncate">Due: {event.title}</span>
                    </span>
                  ))}

                  {dayEvents.map((event) => {
                    const style = statusStyle(event.bookingStatus ?? 'CONFIRMED')
                    return (
                      <span
                        key={`ev-${event.id}`}
                        className={[
                          'flex items-center gap-1 rounded px-1 py-0.5 text-[11px] leading-tight',
                          event.isWhereIsJose
                            ? 'bg-primary/10 font-medium text-foreground'
                            : 'text-muted-foreground opacity-70',
                          isDeadStatus(event.bookingStatus ?? 'CONFIRMED') ? 'line-through' : '',
                        ].join(' ')}
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`}
                          aria-hidden
                        />
                        <span className="truncate">{event.title}</span>
                      </span>
                    )
                  })}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {!loading && !weekHasWij && (
        <p className="text-center text-sm text-muted-foreground">
          No &ldquo;Where is Jose?&rdquo; events this week.
        </p>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary/70" aria-hidden />
          &ldquo;Where is Jose?&rdquo; event
        </span>
        <span className="flex items-center gap-1.5 opacity-70">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/60" aria-hidden />
          Other show
        </span>
        <span className="flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3 text-amber-600" aria-hidden />
          Application deadline
        </span>
        <span>Click any day to view, edit, add, or share.</span>
      </div>

      <Sheet open={openDay !== null} onOpenChange={(open) => !open && setOpenDay(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selectedDay && openDay && (
            <>
              <SheetHeader>
                <SheetTitle>{format(selectedDay, 'EEEE, MMMM d, yyyy')}</SheetTitle>
                <SheetDescription>
                  {(eventsByDay.get(openDay) ?? []).length === 0
                    ? 'Nothing scheduled on this day.'
                    : `${(eventsByDay.get(openDay) ?? []).length} event${
                        (eventsByDay.get(openDay) ?? []).length === 1 ? '' : 's'
                      } on this day.`}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                <Link
                  href={`/admin/events/new?date=${openDay}&whereIsJose=1`}
                  className="block"
                >
                  <Button className="w-full">
                    <CalendarPlus className="mr-2 h-4 w-4" />
                    Add an event on this day
                  </Button>
                </Link>

                {(deadlinesByDay.get(openDay) ?? []).length > 0 && (
                  <div className="rounded-lg border border-amber-400/60 bg-amber-50 p-3 dark:border-amber-700/60 dark:bg-amber-950/40">
                    <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-amber-900 dark:text-amber-200">
                      <AlertTriangle className="h-4 w-4" />
                      Applications due today
                    </p>
                    <ul className="space-y-1">
                      {(deadlinesByDay.get(openDay) ?? []).map((event) => (
                        <li key={event.id} className="text-sm">
                          <Link
                            href={`/admin/events/${event.id}/edit`}
                            className="underline underline-offset-2"
                          >
                            {event.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(eventsByDay.get(openDay) ?? []).map((event) => (
                  <DayEventRow
                    key={event.id}
                    event={event}
                    busy={busyId === event.id}
                    onToggleWhereIsJose={() => toggleWhereIsJose(event)}
                    onCopyDetails={() => copyDetails(event)}
                  />
                ))}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function WeekPager({
  cursor,
  onChange,
}: {
  cursor: Date
  onChange: (next: Date) => void
}) {
  const offsets = Array.from(
    { length: PAGER_RADIUS * 2 + 1 },
    (_, i) => i - PAGER_RADIUS
  )

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Pagination className="mx-0 w-auto justify-start">
        <PaginationContent>
          <PaginationItem>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous week"
              onClick={() => onChange(shiftWeek(cursor, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </PaginationItem>

          {offsets.map((offset) => {
            const week = shiftWeek(cursor, offset)
            const active = offset === 0
            return (
              <PaginationItem key={offset} className="hidden sm:block">
                <Button
                  variant={active ? 'outline' : 'ghost'}
                  size="sm"
                  aria-label={`Week of ${format(week, 'MMMM d, yyyy')}`}
                  aria-current={active ? 'page' : undefined}
                  className={active ? 'font-semibold' : 'text-muted-foreground'}
                  onClick={() => onChange(week)}
                >
                  {format(week, 'MMM d')}
                </Button>
              </PaginationItem>
            )
          })}

          <PaginationItem>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next week"
              onClick={() => onChange(shiftWeek(cursor, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>

      <span className="text-sm font-medium">{weekRangeLabel(cursor)}</span>

      <Button variant="ghost" size="sm" onClick={() => onChange(weekStart(new Date()))}>
        This week
      </Button>

      <Input
        type="date"
        aria-label="Jump to week"
        className="w-[9.5rem]"
        value={dayKey(cursor)}
        onChange={(e) => {
          const picked = fromDateInput(e.target.value)
          if (picked) onChange(weekStart(picked))
        }}
      />
    </div>
  )
}

function DayEventRow({
  event,
  busy,
  onToggleWhereIsJose,
  onCopyDetails,
}: {
  event: WeekEvent
  busy: boolean
  onToggleWhereIsJose: () => void
  onCopyDetails: () => void
}) {
  const status = event.bookingStatus ?? 'CONFIRMED'
  const style = statusStyle(status)
  const time = timeLabel(event)

  const campaignHref = `/admin/email-campaigns/new?template=event_invitation&name=${encodeURIComponent(
    event.title
  )}&subject=${encodeURIComponent(`You're invited: ${event.title}`)}`

  const socialHref = `/admin/social?tab=compose&content=${encodeURIComponent(
    [event.title, time, event.location].filter(Boolean).join(' · ')
  )}`

  return (
    <div className="rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{event.title}</span>
        {event.isWhereIsJose && (
          <Badge className="bg-primary/10 text-xs text-primary">
            <Star className="mr-1 h-3 w-3" />
            Where is Jose?
          </Badge>
        )}
        <Badge className={`text-xs ${style.badge}`}>{style.label}</Badge>
        {event.manifest && (
          <Badge variant="outline" className="text-xs">
            Manifest: {event.manifest.status}
          </Badge>
        )}
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        {time && <span>{time}</span>}
        {event.location && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {event.location}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/admin/events/${event.id}/edit`}>
          <Button size="sm" variant="outline">
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </Link>
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

        <Button size="sm" variant="ghost" disabled={busy} onClick={onToggleWhereIsJose}>
          <Star
            className={`mr-2 h-4 w-4 ${event.isWhereIsJose ? 'fill-current' : ''}`}
          />
          {event.isWhereIsJose ? 'Remove from WIJ' : 'Add to WIJ'}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost">
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={onCopyDetails}>
              <Link2 className="mr-2 h-4 w-4" />
              Copy details &amp; link
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={`/api/admin/events/${event.id}/ics`}>
                <Download className="mr-2 h-4 w-4" />
                Download .ics
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={socialHref}>
                <Megaphone className="mr-2 h-4 w-4" />
                Draft a social post
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={campaignHref}>
                <Mail className="mr-2 h-4 w-4" />
                Start an email campaign
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
