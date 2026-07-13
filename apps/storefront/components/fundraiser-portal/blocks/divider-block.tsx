import type { DividerBlock as DividerBlockType } from '@/lib/fundraiser-page-config'

const spacingClasses: Record<DividerBlockType['spacing'], string> = {
  sm: 'py-2',
  md: 'py-6',
  lg: 'py-12',
}

type Props = {
  block: DividerBlockType
}

export function DividerBlock({ block }: Props) {
  const { style, color, spacing } = block
  const padClass = spacingClasses[spacing]

  if (style === 'line') {
    return (
      <div className={`px-4 ${padClass}`}>
        <hr className="border-gray-200" style={color ? { borderColor: color } : undefined} />
      </div>
    )
  }

  if (style === 'dots') {
    return (
      <div className={`${padClass} flex items-center justify-center gap-3`}>
        {[0, 1, 2].map((i) => (
          <span key={i} className="text-2xl leading-none text-gray-300" style={color ? { color } : undefined}>
            &middot;
          </span>
        ))}
      </div>
    )
  }

  if (style === 'wave') {
    return (
      <div className={`${padClass} flex justify-center`}>
        <svg
          viewBox="0 0 200 20"
          className="h-5 w-48 text-gray-300"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={color ? { color } : undefined}
        >
          <path d="M0 10 Q25 0 50 10 Q75 20 100 10 Q125 0 150 10 Q175 20 200 10" />
        </svg>
      </div>
    )
  }

  // salsa style
  return (
    <div className={`${padClass} flex items-center justify-center gap-4`}>
      <span className="h-px flex-1 max-w-[120px] bg-gray-200" style={color ? { backgroundColor: color } : undefined} />
      <span className="text-2xl">🌶️</span>
      <span className="h-px flex-1 max-w-[120px] bg-gray-200" style={color ? { backgroundColor: color } : undefined} />
    </div>
  )
}
