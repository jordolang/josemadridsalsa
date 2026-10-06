'use client'

import { clsx } from 'clsx'

interface HpBarProps {
  hpCurrent: number
  hpMax: number
  teamColor: string
  showLabel?: boolean
  className?: string
}

export function HpBar({
  hpCurrent,
  hpMax,
  teamColor,
  showLabel = true,
  className,
}: HpBarProps) {
  const safeMax = Math.max(1, hpMax)
  const pct = Math.max(0, Math.min(100, (hpCurrent / safeMax) * 100))
  const critical = pct <= 25
  const warn = pct <= 50

  return (
    <div className={clsx('w-full', className)}>
      {showLabel && (
        <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
          <span
            className={clsx(
              'text-emerald-400/80',
              warn && !critical && 'text-amber-400/90',
              critical && 'animate-pulse text-red-400',
            )}
          >
            HP
          </span>
          <span className="font-mono tabular-nums text-slate-400">
            {hpCurrent.toLocaleString()} / {safeMax.toLocaleString()}
          </span>
        </div>
      )}
      <div
        className={clsx(
          'relative h-3 overflow-hidden rounded-full border bg-neutral-900',
          critical
            ? 'border-red-500/60 shadow-[0_0_12px_rgba(239,68,68,0.4)]'
            : 'border-neutral-700',
        )}
      >
        <div
          className={clsx(
            'h-full',
            critical
              ? 'bg-gradient-to-r from-red-600 to-red-400'
              : warn
                ? 'bg-gradient-to-r from-amber-500 to-amber-300'
                : 'bg-gradient-to-r from-emerald-500 to-green-400',
          )}
          style={{
            width: `${pct}%`,
            transition: 'width 0.7s ease-out',
            boxShadow: critical
              ? '0 0 12px rgba(239, 68, 68, 0.6)'
              : `0 0 10px ${teamColor}55`,
          }}
        />
      </div>
    </div>
  )
}
