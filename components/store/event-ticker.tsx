'use client'

import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import type { ScheduleEvent } from '@/lib/server/google-data'

type TickerEvent = Pick<ScheduleEvent, 'id' | 'title' | 'location' | 'start' | 'isAllDay'>

function buildTickerContent(events: TickerEvent[], todayStr: string, tomorrowStr: string): string[] {
  return events
    .filter(e => e.location && e.start)
    .slice(0, 3)
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
      return `📍 ${dateLabel}  ·  ${e.title.toUpperCase()}  ·  ${e.location!.toUpperCase()}`
    })
}

type EventTickerProps = {
  /** Pre-fetched events from the server layout — zero client fetch needed */
  initialEvents: TickerEvent[]
}

export function EventTicker({ initialEvents }: EventTickerProps) {
  const [segments, setSegments] = useState<string[]>([])

  useEffect(() => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
    const todayStr = toDateStr(now)
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
    setSegments(buildTickerContent(initialEvents, todayStr, toDateStr(tomorrow)))
  }, [initialEvents])

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
  }, [])

  if (segments.length === 0) return null

  const formattedSegments = segments.length > 1
    ? segments.flatMap((seg, i) => i < segments.length - 1 ? [seg, `━━━━━━  UPCOMING  ━━━━━━`] : [seg])
    : segments

  const items = [...formattedSegments, ...formattedSegments]
  const duration = Math.max(60, segments.length * 20)

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

      <div style={{ flex: 1, overflow: 'hidden', height: '100%', position: 'relative' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          height: '100%',
          width: 'max-content',
          animation: `jms-ticker ${duration}s linear infinite`,
          willChange: 'transform',
        }}>
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
