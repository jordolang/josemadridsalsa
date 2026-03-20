'use client'

import { useEffect, useState } from 'react'
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
  if (!start || isNaN(start.getTime())) return `${event.title}  ·  ${event.location}`

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  const eventDay = new Date(start)
  eventDay.setHours(0, 0, 0, 0)

  let dayLabel: string
  if (eventDay.getTime() === today.getTime()) {
    dayLabel = 'TODAY'
  } else if (eventDay.getTime() === tomorrow.getTime()) {
    dayLabel = 'TOMORROW'
  } else {
    dayLabel = start.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase()
  }

  return `${dayLabel}  ·  ${event.title}  ·  ${event.location}`
}

const TICKER_KEYFRAMES = `
@keyframes jms-ticker {
  0%   { transform: translateX(0%); }
  100% { transform: translateX(-33.333%); }
}
`

export function EventTicker() {
  const [events, setEvents] = useState<TickerEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Inject keyframes once into document head
    if (typeof document !== 'undefined' && !document.getElementById('jms-ticker-style')) {
      const style = document.createElement('style')
      style.id = 'jms-ticker-style'
      style.textContent = TICKER_KEYFRAMES
      document.head.appendChild(style)
    }

    fetch('/api/calendar?limit=15')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const withLocation = (data?.events ?? []).filter((e: TickerEvent) => Boolean(e.location))
        setEvents(withLocation)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading || events.length === 0) return null

  const labels = events.map(formatEventLabel)
  // Triple-duplicate so there's always content filling the screen during the loop
  const items = [...labels, ...labels, ...labels]
  const duration = Math.max(events.length * 10, 30)

  return (
    <div
      style={{
        background: 'linear-gradient(90deg, #b91c1c 0%, #9a1515 100%)',
        height: '44px',
        overflow: 'hidden',
        width: '100%',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        borderBottom: '2px solid #7f1d1d',
      }}
    >
      {/* Static "Find Us" badge */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '0 18px',
          background: '#7f1d1d',
          height: '100%',
          borderRight: '2px solid #991b1b',
          zIndex: 1,
        }}
      >
        <MapPin style={{ width: '15px', height: '15px', color: '#fde047', flexShrink: 0 }} />
        <span
          style={{
            color: '#fde047',
            fontWeight: 900,
            fontSize: '13px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          Find Us
        </span>
      </div>

      {/* Scrolling strip */}
      <div style={{ flex: 1, overflow: 'hidden', height: '100%', position: 'relative' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            height: '100%',
            whiteSpace: 'nowrap',
            animation: `jms-ticker ${duration}s linear infinite`,
            willChange: 'transform',
          }}
          onMouseEnter={e => (e.currentTarget.style.animationPlayState = 'paused')}
          onMouseLeave={e => (e.currentTarget.style.animationPlayState = 'running')}
        >
          {items.map((label, i) => (
            <span
              key={i}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                padding: '0 48px',
                color: '#fef9c3',
                fontWeight: 900,
                fontSize: '13px',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              <span style={{ color: '#fde047', fontSize: '15px' }}>🌶️</span>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
