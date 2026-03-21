import type { StatCardsBlock as StatCardsBlockType } from '@/lib/fundraiser-page-config'

const iconMap: Record<string, string> = {
  heart: '❤️',
  star: '⭐',
  fire: '🔥',
  trophy: '🏆',
  dollar: '💵',
  people: '👥',
}

type Props = {
  block: StatCardsBlockType
}

export function StatCardsBlock({ block }: Props) {
  const { title, cards, columns } = block

  const gridCols =
    columns === 2
      ? 'sm:grid-cols-2'
      : columns === 4
        ? 'sm:grid-cols-2 lg:grid-cols-4'
        : 'sm:grid-cols-3'

  return (
    <section className="px-4 py-10">
      <div className="mx-auto max-w-6xl">
        {title && (
          <h2 className="mb-6 text-center font-serif text-2xl font-bold text-gray-900">
            {title}
          </h2>
        )}
        <div className={`grid grid-cols-1 gap-4 ${gridCols}`}>
          {cards.map((card, i) => (
            <div
              key={i}
              className="flex flex-col items-center rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              {card.icon && (
                <span className="mb-2 text-3xl">{iconMap[card.icon] ?? card.icon}</span>
              )}
              <p className="text-3xl font-bold text-salsa-600">{card.value}</p>
              <p className="mt-1 text-sm text-gray-500">{card.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
