import Link from 'next/link'
import { RANGE_OPTIONS, type AnalyticsRangeKey } from '@/lib/analytics/date-range'

interface AnalyticsHeaderProps {
  activeRange: AnalyticsRangeKey
}

export function AnalyticsHeader({ activeRange }: AnalyticsHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">Store performance overview and key trends</p>
      </div>
      <div className="flex items-center gap-2 rounded-lg bg-card p-1 shadow-sm">
        {RANGE_OPTIONS.map((option) => {
          const isActive = option.value === activeRange
          return (
            <Link
              key={option.value}
              href={`/admin/analytics?range=${option.value}`}
              className={`rounded-md px-3 py-1 text-sm font-medium ${
                isActive
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {option.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
