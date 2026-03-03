import { cn } from '@/lib/utils'

type HeatGaugeProps = {
  value: number
  max?: number
  label?: string
  heatLevel?: string
  className?: string
}

const DEFAULT_MAX = 10

export function HeatGauge({
  value,
  max = DEFAULT_MAX,
  label,
  heatLevel,
  className,
}: HeatGaugeProps) {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0
  const clampedValue = Math.min(safeValue, max)
  const percentage = Math.min((clampedValue / max) * 100, 100)

  const displayLabel =
    label ||
    `${formatValue(safeValue)}/${max.toString().replace(/\.0$/, '')}`

  return (
    <div
      className={cn('space-y-1', className)}
      role="img"
      aria-label={`Heat rating ${displayLabel}`}
    >
      <div className="flex items-center justify-between text-xs text-gray-600">
        <span className="uppercase tracking-wide text-gray-500">Heat</span>
        <span className="font-semibold text-gray-900">{displayLabel}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-200">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300 ease-out',
            resolveGaugeGradient(heatLevel, safeValue)
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

function formatValue(value: number): string {
  return Number.isInteger(value)
    ? value.toString()
    : value.toFixed(1).replace(/\.0$/, '')
}

function resolveGaugeGradient(heatLevel?: string, value?: number): string {
  const level = heatLevel?.toUpperCase()

  switch (level) {
    case 'MILD':
      return 'bg-gradient-to-r from-emerald-400 via-lime-400 to-lime-500'
    case 'MEDIUM':
      return 'bg-gradient-to-r from-yellow-400 via-amber-400 to-amber-500'
    case 'HOT':
      return 'bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600'
    case 'EXTRA_HOT':
      return 'bg-gradient-to-r from-rose-500 via-red-500 to-red-600'
    case 'FRUIT':
      return 'bg-gradient-to-r from-pink-400 via-fuchsia-400 to-fuchsia-500'
    default:
      // Approximate the gradient by intensity if heatLevel isn't provided
      if (value !== undefined) {
        if (value <= 3) {
          return 'bg-gradient-to-r from-emerald-400 via-lime-400 to-lime-500'
        }
        if (value <= 6) {
          return 'bg-gradient-to-r from-yellow-400 via-amber-400 to-amber-500'
        }
        if (value <= 8) {
          return 'bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600'
        }
        return 'bg-gradient-to-r from-rose-500 via-red-500 to-red-600'
      }
      return 'bg-gradient-to-r from-slate-400 via-slate-500 to-slate-600'
  }
}
