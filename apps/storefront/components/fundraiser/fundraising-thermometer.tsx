import { cn } from '@/lib/utils'

export interface FundraisingThermometerProps {
  raised: number
  goal: number
  currency?: string
  /** Show the amount raised and the goal. */
  showAmount?: boolean
  /** Show the percentage of the goal. */
  showPercentage?: boolean
  className?: string
}

// SVG geometry: the tube runs from TUBE_TOP to TUBE_BOTTOM, the bulb sits under it.
const TUBE_TOP = 6
const TUBE_BOTTOM = 92
const TUBE_HEIGHT = TUBE_BOTTOM - TUBE_TOP

/**
 * Vertical thermometer for a campaign goal. Drawn as SVG so the fill level is a geometry
 * attribute rather than an inline style.
 */
export function FundraisingThermometer({
  raised,
  goal,
  currency = 'USD',
  showAmount = true,
  showPercentage = true,
  className,
}: FundraisingThermometerProps) {
  const pct = goal > 0 ? Math.min(100, Math.max(0, (raised / goal) * 100)) : 0
  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 })
  const fillHeight = (TUBE_HEIGHT * pct) / 100

  return (
    <div
      className={cn('flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm', className)}
      role="img"
      aria-label={`${Math.round(pct)}% of ${fmt.format(goal)} goal raised`}
    >
      <svg viewBox="0 0 32 112" className="h-28 w-8 shrink-0" aria-hidden="true">
        <rect x="9" y={TUBE_TOP} width="14" height={TUBE_HEIGHT} rx="7" className="fill-muted stroke-border" />
        <rect
          x="9"
          y={TUBE_BOTTOM - fillHeight}
          width="14"
          height={fillHeight}
          rx="7"
          className="fill-primary transition-all duration-700 ease-out"
        />
        {[25, 50, 75].map((t) => (
          <line
            key={t}
            x1="9"
            x2="23"
            y1={TUBE_BOTTOM - (TUBE_HEIGHT * t) / 100}
            y2={TUBE_BOTTOM - (TUBE_HEIGHT * t) / 100}
            className="stroke-border"
            strokeWidth="0.75"
          />
        ))}
        <circle cx="16" cy="100" r="10" className="fill-primary" />
      </svg>
      {(showAmount || showPercentage) && (
        <div>
          {showAmount && <div className="text-2xl font-bold leading-tight">{fmt.format(raised)}</div>}
          <div className="text-xs text-muted-foreground">
            {showPercentage && `${Math.round(pct)}% `}
            {showAmount ? `of ${fmt.format(goal)} goal` : showPercentage ? 'of goal' : ''}
          </div>
        </div>
      )}
    </div>
  )
}
