'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { dayKey, eventDays, weekendDays } from '@/lib/events/calendar-view'
import { STATUS_STYLES, isDeadStatus, statusStyle } from './event-status'
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  List,
  MapPin,
  Plus,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export interface CalendarEvent {
  id: string
  title: string
  location: string | null
  startDate: string
  endDate: string | null
  applicationDeadline: string | null
  bookingStatus: string
  boothFee: number | null
  isWhereIsJose: boolean
  staffCount: number
  manifestStatus: string | null
}

export default function EventCalendar({ events }: { events: CalendarEvent[] }) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))

  // Recomputed once per render rather than stored — a tab left open overnight
  // should still highlight the right day.
  const today = startOfDay(new Date())

  const { eventsByDay, deadlinesByDay } = useMemo(() => {
    const byDay = new Map<string, CalendarEvent[]>()
    const deadlines = new Map<string, CalendarEvent[]>()

    for (const event of events) {
      for (const day of eventDays(event.startDate, event.endDate)) {
        const key = dayKey(day)
        const list = byDay.get(key)
        if (list) list.push(event)
        else byDay.set(key, [event])
      }

      if (event.applicationDeadline) {
        const d = new Date(event.applicationDeadline)
        if (!Number.isNaN(d.getTime())) {
          const key = dayKey(d)
          const list = deadlines.get(key)
          if (list) list.push(event)
          else deadlines.set(key, [event])
        }
      }
    }

    return { eventsByDay: byDay, deadlinesByDay: deadlines }
  }, [events])

  const grid = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor))
    const end = endOfWeek(endOfMonth(cursor))
    return eachDayOfInterval({ start, end })
  }, [cursor])

  const weekend = useMemo(() => {
    const days = weekendDays(today)
    const seen = new Set<string>()
    const shows: CalendarEvent[] = []
    for (const day of days) {
      for (const event of eventsByDay.get(dayKey(day)) ?? []) {
        if (isDeadStatus(event.bookingStatus) || seen.has(event.id)) continue
        seen.add(event.id)
        shows.push(event)
      }
    }
    return { friday: days[0], sunday: days[2], shows }
  }, [eventsByDay, today])

  const upcomingDeadlines = useMemo(() => {
    return events
      .filter((e) => {
        if (!e.applicationDeadline || isDeadStatus(e.bookingStatus)) return false
        const d = new Date(e.applicationDeadline)
        return !Number.isNaN(d.getTime()) && startOfDay(d) >= today
      })
      .sort(
        (a, b) =>
          new Date(a.applicationDeadline!).getTime() -
          new Date(b.applicationDeadline!).getTime()
      )
      .slice(0, 6)
  }, [events, today])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Event Calendar</h1>
          <p className="text-muted-foreground">
            Booked shows and application deadlines at a glance.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/events">
            <Button variant="outline">
              <List className="mr-2 h-4 w-4" />
              List view
            </Button>
          </Link>
          <Link href="/admin/events/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Event
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <WeekendPanel weekend={weekend} />
        <DeadlinePanel deadlines={upcomingDeadlines} today={today} />
      </div>

      <Card className="p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{format(cursor, 'MMMM yyyy')}</h2>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCursor(startOfMonth(new Date()))}
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous month"
              onClick={() => setCursor((c) => subMonths(c, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next month"
              onClick={() => setCursor((c) => addMonths(c, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[46rem]">
            <div className="grid grid-cols-7 gap-px border-b pb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div
                  key={d}
                  className="text-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-px bg-border">
              {grid.map((day) => {
                const key = dayKey(day)
                const dayEvents = eventsByDay.get(key) ?? []
                const dayDeadlines = deadlinesByDay.get(key) ?? []
                const outside = !isSameMonth(day, cursor)
                const isWeekendDay = day.getDay() === 0 || day.getDay() === 6

                return (
                  <div
                    key={key}
                    className={[
                      'min-h-28 bg-background p-1.5 align-top',
                      outside ? 'opacity-40' : '',
                      isWeekendDay && !outside ? 'bg-muted/30' : '',
                    ].join(' ')}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className={[
                          'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs',
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
                        <Link
                          key={`dl-${event.id}`}
                          href={`/admin/events/${event.id}/edit`}
                          className="flex items-start gap-1 rounded border border-amber-400/60 bg-amber-50 px-1 py-0.5 text-[11px] leading-tight text-amber-900 hover:bg-amber-100 dark:border-amber-700/60 dark:bg-amber-950/60 dark:text-amber-200 dark:hover:bg-amber-900/60"
                          title={`Application deadline: ${event.title}`}
                        >
                          <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
                          <span className="truncate">Due: {event.title}</span>
                        </Link>
                      ))}

                      {dayEvents.map((event) => {
                        const style = statusStyle(event.bookingStatus)
                        return (
                          <Link
                            key={`ev-${event.id}`}
                            href={`/admin/events/${event.id}/edit`}
                            className={[
                              'flex items-center gap-1 rounded px-1 py-0.5 text-[11px] leading-tight hover:bg-muted',
                              isDeadStatus(event.bookingStatus)
                                ? 'text-muted-foreground line-through'
                                : '',
                            ].join(' ')}
                            title={`${event.title} — ${style.label}${
                              event.location ? ` · ${event.location}` : ''
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`}
                              aria-hidden
                            />
                            <span className="truncate">{event.title}</span>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t pt-4">
          {Object.entries(STATUS_STYLES).map(([value, style]) => (
            <span key={value} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${style.dot}`} aria-hidden />
              {style.label}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlertTriangle className="h-3 w-3 text-amber-600" aria-hidden />
            Application deadline
          </span>
        </div>
      </Card>
    </div>
  )
}

function WeekendPanel({
  weekend,
}: {
  weekend: { friday: Date; sunday: Date; shows: CalendarEvent[] }
}) {
  return (
    <Card className="p-6 lg:col-span-2">
      <div className="mb-4 flex items-center gap-2">
        <CalendarDays className="h-5 w-5" />
        <div>
          <h2 className="text-lg font-semibold">This Weekend</h2>
          <p className="text-sm text-muted-foreground">
            {format(weekend.friday, 'EEE MMM d')} – {format(weekend.sunday, 'EEE MMM d')}
          </p>
        </div>
      </div>

      {weekend.shows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No shows booked this weekend.
        </p>
      ) : (
        <div className="space-y-2">
          {weekend.shows.map((event) => {
            const style = statusStyle(event.bookingStatus)
            return (
              <Link
                key={event.id}
                href={`/admin/events/${event.id}/edit`}
                className="flex items-start justify-between gap-3 rounded-lg border p-3 hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{event.title}</span>
                    <Badge className={`text-xs ${style.badge}`}>{style.label}</Badge>
                    {event.manifestStatus && (
                      <Badge variant="outline" className="text-xs">
                        Manifest: {event.manifestStatus}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span>{format(new Date(event.startDate), 'EEE MMM d')}</span>
                    {event.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {event.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {event.staffCount} staff
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </Card>
  )
}

function DeadlinePanel({ deadlines, today }: { deadlines: CalendarEvent[]; today: Date }) {
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5" />
        <h2 className="text-lg font-semibold">Upcoming Deadlines</h2>
      </div>

      {deadlines.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No application deadlines on file.
        </p>
      ) : (
        <div className="space-y-2">
          {deadlines.map((event) => {
            const due = new Date(event.applicationDeadline!)
            const daysOut = Math.round(
              (startOfDay(due).getTime() - today.getTime()) / 86_400_000
            )
            const urgent = daysOut <= 7
            return (
              <Link
                key={event.id}
                href={`/admin/events/${event.id}/edit`}
                className="flex items-center justify-between gap-2 rounded-lg border p-2.5 hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{event.title}</p>
                  <p className="text-xs text-muted-foreground">{format(due, 'MMM d, yyyy')}</p>
                </div>
                <Badge
                  className={
                    urgent
                      ? 'shrink-0 bg-red-100 text-xs text-red-900 dark:bg-red-950 dark:text-red-300'
                      : 'shrink-0 bg-muted text-xs text-muted-foreground'
                  }
                >
                  {daysOut === 0 ? 'Today' : `${daysOut}d`}
                </Badge>
              </Link>
            )
          })}
        </div>
      )}
    </Card>
  )
}
