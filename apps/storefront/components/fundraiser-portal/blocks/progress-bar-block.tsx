import type { ProgressBarBlock as ProgressBarBlockType } from '@/lib/fundraiser-page-config'
import { FundraisingThermometer } from '@/components/fundraiser/fundraising-thermometer'

type Props = {
  block: ProgressBarBlockType
  fundraiser: {
    goal: any
    totalRevenue: any
  }
}

export function ProgressBarBlock({ block, fundraiser }: Props) {
  const goal = fundraiser.goal ? Number(fundraiser.goal) : null
  const raised = Number(fundraiser.totalRevenue)

  if (!goal || goal <= 0) return null

  const percentage = Math.min((raised / goal) * 100, 100)
  const label = block.label || 'Fundraising Progress'

  if (block.style === 'thermometer') {
    return (
      <section className="mx-auto flex max-w-2xl flex-col items-center px-4 py-8">
        <h3 className="mb-3 text-center text-sm font-semibold uppercase tracking-wider text-gray-500">
          {label}
        </h3>
        <FundraisingThermometer raised={raised} goal={goal} />
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-8">
      <h3 className="mb-3 text-center text-sm font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </h3>
      <div className="h-5 overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-gradient-to-r from-verde-500 to-verde-600 transition-all duration-700"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="mt-2 flex items-baseline justify-between text-sm">
        {block.showAmount && (
          <span className="font-semibold text-gray-900">
            ${raised.toLocaleString()}
          </span>
        )}
        {block.showPercentage && (
          <span className="text-gray-500">
            {Math.round(percentage)}%
          </span>
        )}
        {block.showAmount && (
          <span className="text-gray-500">
            Goal: ${goal.toLocaleString()}
          </span>
        )}
      </div>
    </section>
  )
}
