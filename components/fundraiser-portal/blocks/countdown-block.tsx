'use client'

import { useEffect, useState } from 'react'
import type { CountdownBlock as CountdownBlockType } from '@/lib/fundraiser-page-config'

type TimeLeft = {
  days: number
  hours: number
  minutes: number
  seconds: number
}

function calcTimeLeft(targetDate: string): TimeLeft | null {
  const diff = new Date(targetDate).getTime() - Date.now()
  if (diff <= 0) return null
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  }
}

type Props = {
  block: CountdownBlockType
}

export function CountdownBlock({ block }: Props) {
  const { targetDate, title, expiredMessage } = block
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(() => calcTimeLeft(targetDate))

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(calcTimeLeft(targetDate))
    }, 1000)
    return () => clearInterval(interval)
  }, [targetDate])

  return (
    <section className="px-4 py-10">
      <div className="mx-auto max-w-2xl text-center">
        {title && (
          <h2 className="mb-6 font-serif text-2xl font-bold text-gray-900">{title}</h2>
        )}
        {timeLeft === null ? (
          <p className="text-lg text-gray-600">
            {expiredMessage || 'This event has ended.'}
          </p>
        ) : (
          <div className="flex items-start justify-center gap-4">
            {(
              [
                { label: 'Days', value: timeLeft.days },
                { label: 'Hours', value: timeLeft.hours },
                { label: 'Minutes', value: timeLeft.minutes },
                { label: 'Seconds', value: timeLeft.seconds },
              ] as const
            ).map(({ label, value }) => (
              <div
                key={label}
                className="flex min-w-[72px] flex-col items-center rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <span className="text-4xl font-bold tabular-nums text-salsa-600">
                  {String(value).padStart(2, '0')}
                </span>
                <span className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                  {label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
