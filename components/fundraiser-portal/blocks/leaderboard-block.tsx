import type { ParticipantLeaderboardBlock } from '@/lib/fundraiser-page-config'

type Props = {
  block: ParticipantLeaderboardBlock
  fundraiser: {
    participants: Array<{
      id: string
      name: string
      totalOrders: number
      totalRevenue: any
    }>
  }
}

export function LeaderboardBlock({ block, fundraiser }: Props) {
  const title = block.title || 'Top Supporters'
  const topParticipants = fundraiser.participants.slice(0, block.topN)

  if (topParticipants.length === 0) return null

  return (
    <section className="px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <h2 className="mb-6 text-center font-serif text-2xl font-bold text-gray-900">
          {title}
        </h2>
        <div className="space-y-3">
          {topParticipants.map((participant, index) => {
            const revenue = Number(participant.totalRevenue)
            return (
              <div
                key={participant.id}
                className="flex items-center gap-4 rounded-lg border border-gray-100 bg-white p-4 shadow-sm"
              >
                <div
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full font-bold text-white ${
                    index === 0
                      ? 'bg-yellow-500'
                      : index === 1
                        ? 'bg-gray-400'
                        : index === 2
                          ? 'bg-amber-700'
                          : 'bg-gray-300'
                  }`}
                >
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">
                    {participant.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {participant.totalOrders} order
                    {participant.totalOrders !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-verde-600">
                    ${revenue.toFixed(2)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
