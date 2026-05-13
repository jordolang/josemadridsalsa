'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'

type Props = {
  value: number
  onChange: (rating: number) => void
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  ariaLabel?: string
}

const sizeMap = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' }

export function StarRatingInput({
  value,
  onChange,
  size = 'md',
  disabled = false,
  ariaLabel = 'Rating',
}: Props) {
  const [hover, setHover] = useState(0)
  const display = hover || value
  const cls = sizeMap[size]

  return (
    <div className="inline-flex items-center gap-1" role="radiogroup" aria-label={ariaLabel}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= display
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n === 1 ? '' : 's'}`}
            disabled={disabled}
            onClick={() => onChange(n)}
            onMouseEnter={() => !disabled && setHover(n)}
            onMouseLeave={() => !disabled && setHover(0)}
            className="rounded transition focus:outline-none focus-visible:ring-2 focus-visible:ring-salsa-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Star
              className={`${cls} ${filled ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-muted-foreground'} transition`}
              strokeWidth={1.5}
            />
          </button>
        )
      })}
    </div>
  )
}

export function StarRatingDisplay({
  value,
  size = 'sm',
  showValue = false,
}: {
  value: number
  size?: 'sm' | 'md' | 'lg'
  showValue?: boolean
}) {
  const cls = sizeMap[size]
  return (
    <div className="inline-flex items-center gap-1" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${cls} ${n <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-muted-foreground'}`}
          strokeWidth={1.5}
        />
      ))}
      {showValue ? <span className="ml-1 text-sm text-muted-foreground">{value.toFixed(1)}</span> : null}
    </div>
  )
}
