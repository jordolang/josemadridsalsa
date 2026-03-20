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
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const tomorrow = new Date(today)
        tomorrow.setDate(today.getDate() + 1)

        const grouped: GroupedEvents = { today: [], tomorrow: [] }

        ;(data?.events ?? []).forEach((e: TickerEvent) => {
          if (!e.location || !e.start) return
          const d = new Date(e.start)
          d.setHours(0, 0, 0, 0)
          if (d.getTime() === today.getTime()) grouped.today.push(e)
          else if (d.getTime() === tomorrow.getTime()) grouped.tomorrow.push(e)
        })

        setSegments(buildTickerContent(grouped))
      })
      .catch(() => {})
  }, [])

  if (segments.length === 0) return null

  // Repeat enough times to fill screen, then duplicate for seamless loop
  const repeat = Math.max(4, Math.ceil(12 / segments.length))
  const base = Array.from({ length: repeat }, () => segments).flat()
  const items = [...base, ...base] // duplicate for the -50% animation

  // Slow: 30 seconds per segment
  const duration = segments.length * repeat * 30

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
          onMouseEnter={e => (e.currentTarget.style.animationPlayState = 'paused')}
          onMouseLeave={e => (e.currentTarget.style.animationPlayState = 'running')}
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
