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

type GroupedEvents = {
  today: TickerEvent[]
  tomorrow: TickerEvent[]
}

function buildTickerContent(grouped: GroupedEvents): string[] {
  const segments: string[] = []

  if (grouped.today.length > 0) {
    grouped.today.forEach(e => {
      if (e.location) {
        segments.push(`📍 TODAY  ·  ${e.title.toUpperCase()}  ·  ${e.location.toUpperCase()}`)
      }
    })
  }

  if (grouped.tomorrow.length > 0) {
    // Separator
    segments.push(`━━━━━━  COMING UP  ━━━━━━`)
    grouped.tomorrow.forEach(e => {
      if (e.location) {
        segments.push(`📍 TOMORROW  ·  ${e.title.toUpperCase()}  ·  ${e.location.toUpperCase()}`)
      }
    })
  }

  return segments
}

export function EventTicker() {
  const [segments, setSegments] = useState<string[]>([])

  useEffect(() => {
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

    fetch('/api/calendar?limit=20')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        // Get today/tomorrow as YYYY-MM-DD strings in LOCAL time (avoids UTC timezone shift)
        const now = new Date()
        const pad = (n: number) => String(n).padStart(2, '0')
        const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
        const todayStr = toDateStr(now)
        const tomorrowDate = new Date(now)
        tomorrowDate.setDate(now.getDate() + 1)
        const tomorrowStr = toDateStr(tomorrowDate)

        const grouped: GroupedEvents = { today: [], tomorrow: [] }

        ;(data?.events ?? []).forEach((e: TickerEvent) => {
          if (!e.location || !e.start) return
          // Compare just the date portion (first 10 chars) — avoids any TZ issues
          const eventDate = e.start.slice(0, 10)
          if (eventDate === todayStr) grouped.today.push(e)
          else if (eventDate === tomorrowStr) grouped.tomorrow.push(e)
        })

        setSegments(buildTickerContent(grouped))
      })
      .catch(() => {})
  }, [])

  if (segments.length === 0) return null

  // Each unique segment appears ONCE per pass. Duplicate the full pass for the
  // seamless -50% loop trick — that's all we need.
  const items = [...segments, ...segments]

  // ~6 seconds per segment so the ticker moves at a comfortable reading pace.
  const duration = Math.max(20, segments.length * 6)

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

        >
          {items.map((seg, i) => (
            <span key={i} style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '0 48px',
              color: seg.includes('COMING UP') ? '#fde047' : '#fef9c3',
              fontWeight: 900,
              fontSize: seg.includes('COMING UP') ? '12px' : '13px',
              letterSpacing: seg.includes('COMING UP') ? '0.2em' : '0.1em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              opacity: seg.includes('COMING UP') ? 0.8 : 1,
            }}>
              {seg}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
