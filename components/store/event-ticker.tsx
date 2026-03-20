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
  const dayAfter = new Date(today)
  dayAfter.setDate(today.getDate() + 2)

  const eventDay = new Date(start)
  eventDay.setHours(0, 0, 0, 0)

  // Only include today and tomorrow
  if (eventDay.getTime() > tomorrow.getTime()) return ''

  let dayLabel: string
  if (eventDay.getTime() === today.getTime()) {
    dayLabel = 'TODAY'
  } else {
    dayLabel = 'TOMORROW'
  }

  return `${dayLabel}  ·  ${event.title}  ·  ${event.location}`
}

export function EventTicker() {
  const [labels, setLabels] = useState<string[]>([])

  useEffect(() => {
    // Inject keyframes
    if (typeof document !== 'undefined' && !document.getElementById('jms-ticker-style')) {
      const style = document.createElement('style')
      style.id = 'jms-ticker-style'
      style.textContent = `
        @keyframes jms-ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `
      document.head.appendChild(style)
    }

    fetch('/api/calendar?limit=15')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const items: string[] = (data?.events ?? [])
          .map(formatEventLabel)
          .filter(Boolean)
        setLabels(items)
      })
      .catch(() => {})
  }, [])

  if (labels.length === 0) return null

  // Each item repeated many times so the strip is ALWAYS wider than the screen
  const repeat = Math.max(8, Math.ceil(20 / labels.length))
  const base = Array.from({ length: repeat }, () => labels).flat()
  // Duplicate the whole set — animation goes from 0 to -50%
  const items = [...base, ...base]

  const duration = labels.length * 12

  return (
    <div style={{
      background: 'linear-gradient(90deg, #b91c1c 0%, #9a1515 100%)',
      height: '44px',
      overflow: 'hidden',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      borderBottom: '2px solid #7f1d1d',
      position: 'relative',
    }}>
      {/* FIND US badge */}
      <div style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '0 20px',
        background: '#7f1d1d',
        height: '100%',
        borderRight: '2px solid #991b1b',
        zIndex: 2,
        position: 'relative',
      }}>
        <MapPin style={{ width: '15px', height: '15px', color: '#fde047', flexShrink: 0 }} />
        <span style={{
          color: '#fde047',
          fontWeight: 900,
          fontSize: '13px',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
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
            width: 'max-content',
            animation: `jms-ticker ${duration}s linear infinite`,
            willChange: 'transform',
          }}
          onMouseEnter={e => (e.currentTarget.style.animationPlayState = 'paused')}
          onMouseLeave={e => (e.currentTarget.style.animationPlayState = 'running')}
        >
          {items.map((label, i) => (
            <span key={i} style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '0 40px',
              color: '#fef9c3',
              fontWeight: 900,
              fontSize: '13px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}>
              <span style={{ color: '#fde047', fontSize: '15px', flexShrink: 0 }}>🌶️</span>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
