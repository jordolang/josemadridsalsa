'use client'

import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import Link from 'next/link'
import type { ScheduleEvent } from '@/lib/server/google-data'

type TickerEvent = Pick<ScheduleEvent, 'id' | 'title' | 'location' | 'start' | 'isAllDay'>

function buildTickerContent(events: TickerEvent[], todayStr: string, tomorrowStr: string): string[] {
  return events
    .filter(e => e.location && e.start)
    .slice(0, 5)
    .map(e => {
      const eventDate = e.start!.slice(0, 10)
      let dateLabel: string
      if (eventDate === todayStr) {
        dateLabel = 'TODAY'
      } else if (eventDate === tomorrowStr) {
        dateLabel = 'TOMORROW'
      } else {
        const parts = eventDate.split('-')
        if (parts.length === 3) {
          const d = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]))
          const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
          dateLabel = `${months[d.getUTCMonth()]} ${d.getUTCDate()}`
        } else {
          dateLabel = eventDate
        }
      }
      return `${dateLabel} · ${e.title.toUpperCase()} · ${e.location!.toUpperCase()}`
    })
}

interface EventTickerProps {
  /** Pre-fetched events from the server layout — zero client fetch needed */
  initialEvents: TickerEvent[]
}

export function EventTicker({ initialEvents }: EventTickerProps) {
  const [segments, setSegments] = useState<string[]>([])

  useEffect(() => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    const todayStr = toDateStr(now)
    const tomorrow = new Date(now)
    tomorrow.setDate(now.getDate() + 1)
    setSegments(buildTickerContent(initialEvents, todayStr, toDateStr(tomorrow)))
  }, [initialEvents])

  if (segments.length === 0) return null

  const items = [...segments, ...segments]
  const duration = Math.max(60, segments.length * 18)

  return (
    <div className="relative overflow-hidden bg-salsa-900 text-white">
      <div className="mx-auto max-w-[1400px] flex items-stretch">
        <Link
          href="/where-is-jose"
          className="z-[2] inline-flex flex-shrink-0 items-center gap-1.5 bg-salsa-950 px-5 text-[10.5px] font-bold uppercase tracking-[0.22em] text-white transition-colors duration-200 hover:bg-black"
          aria-label="See where Jose Madrid Salsa is appearing next"
        >
          <MapPin className="h-3 w-3 text-chile-400" />
          <span>Find Us</span>
        </Link>
        <div className="relative flex-1 overflow-hidden">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-12 bg-gradient-to-r from-salsa-900 to-transparent"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-12 bg-gradient-to-l from-salsa-900 to-transparent"
          />
          <div
            className="flex w-max items-center gap-12 whitespace-nowrap py-2 will-change-transform animate-marquee hover:[animation-play-state:paused] motion-reduce:animate-none"
            style={{ animationDuration: `${duration}s` }}
          >
            {items.map((seg, i) => (
              <span key={i} className="flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] font-medium text-white/90">
                <span className="text-chile-400">●</span>
                {seg}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
