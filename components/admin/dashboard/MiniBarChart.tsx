'use client'

interface MiniBarChartProps {
  data: number[]
  color?: string
  height?: number
  barWidth?: number
}

export function MiniBarChart({
  data,
  color = '#3b82f6',
  height = 40,
  barWidth = 6,
}: MiniBarChartProps) {
  const max = Math.max(...data, 1)
  const gap = 2

  return (
    <svg
      width={data.length * (barWidth + gap) - gap}
      height={height}
      className="inline-block"
    >
      {data.map((value, i) => {
        const barHeight = (value / max) * height
        return (
          <rect
            key={i}
            x={i * (barWidth + gap)}
            y={height - barHeight}
            width={barWidth}
            height={barHeight}
            rx={1.5}
            fill={color}
            opacity={0.3 + (value / max) * 0.7}
          />
        )
      })}
    </svg>
  )
}
