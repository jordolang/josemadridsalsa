import type { MissionStatementBlock as MissionStatementBlockType } from '@/lib/fundraiser-page-config'

type Props = {
  block: MissionStatementBlockType
  fundraiser: {
    missionStatement: string | null
    description: string | null
    goal: any
    totalRevenue: any
  }
}

export function MissionStatementBlock({ block, fundraiser }: Props) {
  const text =
    block.text || fundraiser.missionStatement || fundraiser.description || ''
  const goal = fundraiser.goal ? Number(fundraiser.goal) : null
  const raised = Number(fundraiser.totalRevenue)

  if (!text) return null

  return (
    <section className="mx-auto max-w-3xl px-4 py-10 text-center">
      <h2 className="mb-4 font-serif text-2xl font-bold text-gray-900">
        Our Mission
      </h2>
      <p className="whitespace-pre-line text-lg leading-relaxed text-gray-700">
        {text}
      </p>

      {block.showGoalProgress && goal && goal > 0 && (
        <div className="mt-8">
          <div className="mx-auto max-w-md">
            <div className="mb-2 flex items-baseline justify-between text-sm">
              <span className="font-semibold text-salsa-600">
                ${raised.toLocaleString()} raised
              </span>
              <span className="text-gray-500">
                of ${goal.toLocaleString()} goal
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-salsa-500 transition-all duration-500"
                style={{ width: `${Math.min((raised / goal) * 100, 100)}%` }}
              />
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {Math.round((raised / goal) * 100)}% of goal
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
