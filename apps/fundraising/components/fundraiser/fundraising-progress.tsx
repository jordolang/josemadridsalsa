'use client'

import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'

export interface FundraisingProgressProps {
  raised: number
  goal: number
  supporterCount?: number
  currency?: string
  /** When true, formats the currency as $X,XXX (default). Set false for raw integer display. */
  formatted?: boolean
  className?: string
}

/**
 * Hero progress block for a fundraising page — big $raised amount, supporter
 * count, animated Progress bar, and "X% of $Y goal" caption.
 */
export function FundraisingProgress({
  raised,
  goal,
  supporterCount,
  currency = 'USD',
  formatted = true,
  className,
}: FundraisingProgressProps) {
  const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0

  const fmt = (n: number) =>
    formatted
      ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency,
          maximumFractionDigits: 0,
        }).format(n)
      : String(n)

  return (
    <div className={cn('w-full space-y-2', className)}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-3xl font-bold tracking-tight sm:text-4xl">
            {fmt(raised)}
          </div>
          {typeof supporterCount === 'number' && (
            <div className="text-sm text-muted-foreground">
              {supporterCount.toLocaleString()} Supporter
              {supporterCount === 1 ? '' : 's'}
            </div>
          )}
        </div>
        <div className="text-right text-xs font-medium text-muted-foreground sm:text-sm">
          {pct}% of {fmt(goal)} goal
        </div>
      </div>
      <Progress
        value={pct}
        aria-label={`${pct} percent of ${fmt(goal)} goal raised`}
      />
    </div>
  )
}
