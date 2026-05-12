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
    <div className="jms-ticker-band">
      <div className="mx-auto max-w-[1400px] flex items-stretch">
        <Link
          href="/where-is-jose"
          className="jms-ticker-anchor"
          aria-label="See where Jose Madrid Salsa is appearing next"
        >
          <MapPin className="h-3 w-3 text-chile-400" />
          <span>Find Us</span>
        </Link>
        <div className="relative flex-1 overflow-hidden">
          <span className="jms-ticker-fade-left" aria-hidden />
          <span className="jms-ticker-fade-right" aria-hidden />
          <div
            className="jms-ticker-track flex items-center gap-12 whitespace-nowrap py-2"
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
      <style jsx>{`
        .jms-ticker-band {
          background: #7f1d1d;
          color: white;
          position: relative;
          overflow: hidden;
        }
        .jms-ticker-anchor {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0 1.25rem;
          background: #450a0a;
          color: white;
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          flex-shrink: 0;
          z-index: 2;
          transition: background-color 200ms ease;
        }
        .jms-ticker-anchor:hover {
          background: #000;
        }
        .jms-ticker-fade-left,
        .jms-ticker-fade-right {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 3rem;
          pointer-events: none;
          z-index: 1;
        }
        .jms-ticker-fade-left {
          left: 0;
          background: linear-gradient(to right, #7f1d1d, transparent);
        }
        .jms-ticker-fade-right {
          right: 0;
          background: linear-gradient(to left, #7f1d1d, transparent);
        }
        .jms-ticker-track {
          width: max-content;
          animation: jms-ticker linear infinite;
          will-change: transform;
        }
        .jms-ticker-track:hover {
          animation-play-state: paused;
        }
        @keyframes jms-ticker {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .jms-ticker-track {
            animation: none;
          }
        }
      `}</style>
    </div>
  )
}
