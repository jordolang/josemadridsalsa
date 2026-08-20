import { StatsCard } from '@/components/admin/StatsCard'
import { formatMeasure } from '@/lib/data-studio/display'
import type { ReportResult } from '@/lib/data-studio/types'

/**
 * Headline figures for a result.
 *
 * A measure whose total is `null` shows an em dash and says why underneath, rather than a zero — the
 * two mean opposite things and a tile is exactly where that confusion would be most expensive.
 */
export function ReportKpis({ result }: { result: ReportResult }) {
  const measures = result.columns.filter((column) => column.kind === 'measure')
  if (measures.length === 0) return null

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {measures.map((column) => {
        const total = result.totals[column.id]
        const unknown = result.meta.unknownCounts[column.id] ?? 0
        const subtitle =
          total === null || total === undefined
            ? result.meta.truncated
              ? 'Too many rows to total — narrow the range'
              : 'Not recorded in any matching row'
            : unknown > 0
              ? `${unknown.toLocaleString('en-US')} row${unknown === 1 ? '' : 's'} had no figure recorded`
              : undefined

        return (
          <StatsCard
            key={column.id}
            title={column.label}
            value={formatMeasure(total ?? null, column.unit)}
            subtitle={subtitle}
            color={column.unit === 'cents' ? 'green' : 'blue'}
          />
        )
      })}
    </div>
  )
}
