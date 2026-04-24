'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { RANGE_OPTIONS, type AnalyticsRangeKey } from '@/lib/analytics/date-range'

interface AnalyticsRangeSelectProps {
  value: AnalyticsRangeKey
}

export function AnalyticsRangeSelect({ value }: AnalyticsRangeSelectProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.set('range', next)
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  return (
    <select
      name="range"
      value={value}
      onChange={handleChange}
      disabled={isPending}
      className="h-9 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
    >
      {RANGE_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
