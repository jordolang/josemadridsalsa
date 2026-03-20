'use client'

import { useEffect, useState, useRef } from 'react'
import { MapPin } from 'lucide-react'

type TickerEvent = {
  id: string
  title: string
  location: string | null
  start: string | null
  isAllDay: boolean
}

function formatEventLabel(event: TickerEvent): string {
  if (!event.location) return event.title

  const start = event.start ? new Date(event.start) : null
  if (!start || isNaN(start.getTime())) return `${event.title} — ${event.location}`

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  const eventDay = new Date(start)
  eventDay.setHours(0, 0, 0, 0)

  let dayLabel: string
  if (eventDay.getTime() === today.getTime()) {
    dayLabel = 'Today'
  } else if (eventDay.getTime() === tomorrow.getTime()) {
    dayLabel = 'Tomorrow'
  } else {
    dayLabel = start.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  }

  return `${dayLabel} — ${event.title} at ${event.location}`
}

export function EventTicker() {
  const [events, setEvents] = useState<TickerEvent[]>([])
  const [loading, setLoading] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/calendar?limit=10')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const withLocation = (data?.events ?? []).filter((e: TickerEvent) => Boolean(e.location))
        setEvents(withLocation)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Don't render anything if no events with locations
  if (loading || events.length === 0) return null

  const labels = events.map(formatEventLabel)
  // Duplicate for seamless loop
  const items = [...labels, ...labels]

  return (
    <div className="bg-salsa-700 text-white overflow-hidden w-full" style={{ height: '36px' }}>
      <div className="flex items-center h-full">
        {/* Static left label */}
        <div className="flex-shrink-0 flex items-center gap-1.5 px-4 bg-salsa-800 h-full border-r border-salsa-600 text-sm font-bold uppercase tracking-wider whitespace-nowrap">
          <MapPin className="w-3.5 h-3.5 text-yellow-300" />
          <span>Find Us</span>
        </div>

        {/* Scrolling ticker */}
        <div className="flex-1 overflow-hidden relative h-full">
          <div
            ref={containerRef}
            className="flex items-center h-full gap-0 animate-ticker whitespace-nowrap"
          >
            {items.map((label, i) => (
              <span key={i} className="flex items-center gap-2 text-sm px-8">
                <span className="text-yellow-300">🌶️</span>
                <span>{label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-ticker {
          animation: ticker ${Math.max(events.length * 8, 20)}s linear infinite;
        }
        .animate-ticker:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  )
}
