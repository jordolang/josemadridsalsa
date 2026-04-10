'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Facebook, Instagram, Twitter, Music2, Store, Clock, CheckCircle2, AlertCircle, FileText } from 'lucide-react'
import type { SocialMediaPlatform, SocialMediaPostStatus } from '@prisma/client'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { CalendarPost, DashboardTab } from '@/types/social'

const PLATFORM_ICONS: Record<SocialMediaPlatform, React.ElementType> = {
  FACEBOOK: Facebook,
  INSTAGRAM: Instagram,
  TWITTER: Twitter,
  TIKTOK: Music2,
  GOOGLE_MY_BUSINESS: Store,
}

const STATUS_COLORS: Record<SocialMediaPostStatus, string> = {
  DRAFT: 'bg-muted-foreground',
  SCHEDULED: 'bg-blue-500',
  PUBLISHED: 'bg-emerald-500',
  FAILED: 'bg-destructive',
}

const STATUS_BG: Record<SocialMediaPostStatus, string> = {
  DRAFT: 'border-border bg-muted/50',
  SCHEDULED: 'border-blue-200 bg-blue-50',
  PUBLISHED: 'border-emerald-200 bg-emerald-50',
  FAILED: 'border-destructive/30 bg-destructive/10',
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

type Props = {
  posts: CalendarPost[]
  onNavigate: (tab: DashboardTab) => void
}

export function SocialCalendar({ posts, onNavigate }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startOffset = firstDay.getDay()
    const totalDays = lastDay.getDate()

    const days: Array<{ date: Date; dateStr: string; isCurrentMonth: boolean; isToday: boolean }> = []

    // Previous month padding
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(year, month, -i)
      days.push({
        date: d,
        dateStr: d.toISOString().split('T')[0],
        isCurrentMonth: false,
        isToday: false,
      })
    }

    // Current month
    const today = new Date().toISOString().split('T')[0]
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month, i)
      const dateStr = d.toISOString().split('T')[0]
      days.push({
        date: d,
        dateStr,
        isCurrentMonth: true,
        isToday: dateStr === today,
      })
    }

    // Next month padding
    const remaining = 42 - days.length
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i)
      days.push({
        date: d,
        dateStr: d.toISOString().split('T')[0],
        isCurrentMonth: false,
        isToday: false,
      })
    }

    return days
  }, [year, month])

  const postsByDate = useMemo(() => {
    const map: Record<string, CalendarPost[]> = {}
    for (const post of posts) {
      const dateStr = post.scheduledAt
        ? new Date(post.scheduledAt).toISOString().split('T')[0]
        : post.publishedAt
          ? new Date(post.publishedAt).toISOString().split('T')[0]
          : null
      if (dateStr) {
        if (!map[dateStr]) map[dateStr] = []
        map[dateStr].push(post)
      }
    }
    return map
  }, [posts])

  const selectedDayPosts = selectedDate ? postsByDate[selectedDate] || [] : []

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Calendar grid */}
        <Card className="overflow-hidden">
          {/* Month header */}
          <div className="flex items-center justify-between border-b bg-muted/50 px-5 py-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentDate(new Date(year, month - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-lg font-semibold text-foreground">
              {MONTHS[month]} {year}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentDate(new Date(year, month + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b bg-muted/50">
            {DAYS.map((day) => (
              <div key={day} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar cells */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, i) => {
              const dayPosts = postsByDate[day.dateStr] || []
              const isSelected = selectedDate === day.dateStr
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedDate(day.dateStr)}
                  className={cn(
                    'relative min-h-[80px] border-b border-r p-1.5 text-left transition hover:bg-muted/50',
                    !day.isCurrentMonth && 'bg-muted/50/50 text-muted-foreground',
                    isSelected && 'ring-2 ring-inset ring-salsa-500',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs',
                      day.isToday && 'bg-salsa-500 font-bold text-white',
                      !day.isToday && day.isCurrentMonth && 'text-foreground',
                    )}
                  >
                    {day.date.getDate()}
                  </span>
                  {dayPosts.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {dayPosts.slice(0, 3).map((post) => (
                        <div
                          key={post.id}
                          className={cn(
                            'flex items-center gap-1 rounded px-1 py-0.5 text-[10px] leading-tight',
                            STATUS_BG[post.status],
                          )}
                        >
                          <div className={cn('h-1.5 w-1.5 rounded-full', STATUS_COLORS[post.status])} />
                          <span className="truncate">{post.content.slice(0, 20)}</span>
                        </div>
                      ))}
                      {dayPosts.length > 3 && (
                        <p className="px-1 text-[10px] text-muted-foreground">+{dayPosts.length - 3} more</p>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </Card>

        {/* Selected day panel */}
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="font-semibold text-foreground">
              {selectedDate
                ? new Date(selectedDate + 'T12:00:00').toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })
                : 'Select a date'}
            </h3>

            {!selectedDate ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Click on a date to see scheduled and published posts.
              </p>
            ) : selectedDayPosts.length === 0 ? (
              <div className="mt-4 text-center">
                <p className="text-sm text-muted-foreground">No posts on this day</p>
                <Button size="sm" className="mt-3" onClick={() => onNavigate('compose')}>
                  Create post
                </Button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {selectedDayPosts.map((post) => (
                  <div
                    key={post.id}
                    className={cn('rounded-lg border p-3', STATUS_BG[post.status])}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Badge
                        className={cn(
                          'text-[10px]',
                          post.status === 'PUBLISHED' && 'bg-emerald-100 text-emerald-700',
                          post.status === 'SCHEDULED' && 'bg-blue-100 text-blue-700',
                          post.status === 'DRAFT' && 'bg-muted text-muted-foreground',
                          post.status === 'FAILED' && 'bg-destructive/10 text-destructive',
                        )}
                      >
                        {post.status}
                      </Badge>
                      {post.scheduledAt && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(post.scheduledAt).toLocaleTimeString(undefined, {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 line-clamp-3 text-sm text-foreground">{post.content}</p>
                    <div className="mt-2 flex gap-1">
                      {post.platforms.map((p) => {
                        const PIcon = PLATFORM_ICONS[p]
                        return <PIcon key={p} className="h-3.5 w-3.5 text-muted-foreground" />
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Legend */}
          <Card className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Status Legend</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(Object.entries(STATUS_COLORS) as [SocialMediaPostStatus, string][]).map(([status, color]) => (
                <div key={status} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className={cn('h-2.5 w-2.5 rounded-full', color)} />
                  {status}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
