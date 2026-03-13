'use client'

import { Loader2, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PullToRefreshIndicatorProps {
  pullDistance: number
  isRefreshing: boolean
  threshold?: number
}

export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  threshold = 80,
}: PullToRefreshIndicatorProps) {
  if (pullDistance === 0 && !isRefreshing) return null

  const progress = Math.min(pullDistance / threshold, 1)

  return (
    <div
      className="flex items-center justify-center overflow-hidden transition-[height] duration-200 ease-out"
      style={{ height: isRefreshing ? 48 : pullDistance }}
    >
      <span
        aria-live="polite"
        role="status"
        className="sr-only"
      >
        {isRefreshing ? 'Refreshing...' : progress >= 1 ? 'Release to refresh' : 'Pull to refresh'}
      </span>
      {isRefreshing ? (
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      ) : (
        <ArrowDown
          className={cn(
            'h-6 w-6 text-muted-foreground transition-transform duration-200',
            progress >= 1 && 'rotate-180 text-primary'
          )}
        />
      )}
    </div>
  )
}
