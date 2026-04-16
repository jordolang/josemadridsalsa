'use client'

import { cn } from '@/lib/utils'

export interface FundraisingThermometerProps {
  raised: number
  goal: number
  currency?: string
  className?: string
}

/**
 * Embeddable vertical thermometer widget. Pair with FundraisingProgress for
 * a denser, more playful representation of campaign progress.
 */
export function FundraisingThermometer({
  raised,
  goal,
  currency = 'USD',
  className,
}: FundraisingThermometerProps) {
  const pct = goal > 0 ? Math.min(100, Math.max(0, (raised / goal) * 100)) : 0
  const fmt = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  })

  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm',
        className,
      )}
      role="img"
      aria-label={`${Math.round(pct)}% of ${fmt.format(goal)} goal raised`}
    >
      <div className="relative h-24 w-8 shrink-0 overflow-hidden rounded-full border bg-muted/40">
        <div
          className="absolute bottom-0 left-0 w-full rounded-b-full bg-gradient-to-t from-primary to-primary/70 transition-all duration-700 ease-out"
          style={{ height: `${pct}%` }}
        />
        {/* bulb */}
        <div className="absolute -bottom-2 left-1/2 h-6 w-6 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_0_3px_theme(colors.background)]" />
        {/* tick marks */}
        {[25, 50, 75].map((t) => (
          <span
            key={t}
            className="absolute left-0 h-px w-full bg-border/60"
            style={{ bottom: `${t}%` }}
          />
        ))}
      </div>
      <div>
        <div className="text-2xl font-bold leading-tight">
          {fmt.format(raised)}
        </div>
        <div className="text-xs text-muted-foreground">
          {Math.round(pct)}% of {fmt.format(goal)} goal
        </div>
      </div>
    </div>
  )
}
