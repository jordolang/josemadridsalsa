import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatMeasure } from '@/lib/data-studio/display'
import type { ReportResult } from '@/lib/data-studio/types'

/**
 * The spreadsheet view of a result.
 *
 * A `null` cell renders as an em dash, never as `0` — the distinction between "nothing was recorded"
 * and "the recorded figure is zero" is the whole reason the aggregator carries nulls through, and it
 * would be thrown away here by a `?? 0`.
 *
 * The footer shows totals only when the aggregator supplied them. A truncated scan yields `null`
 * totals, and in that case no total is printed at all rather than a partial sum that reads as final.
 */
export function ReportTable({ result }: { result: ReportResult }) {
  const hasTotals = result.columns.some((column) => {
    if (column.kind !== 'measure') return false
    return result.totals[column.id] !== undefined && result.totals[column.id] !== null
  })

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {result.columns.map((column) => (
              <TableHead
                key={column.id}
                className={column.kind === 'measure' ? 'text-right whitespace-nowrap' : 'whitespace-nowrap'}
              >
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={result.columns.length} className="py-8 text-center text-muted-foreground">
                No rows matched.
              </TableCell>
            </TableRow>
          ) : (
            result.rows.map((row) => (
              <TableRow key={row.key}>
                {result.columns.map((column) => {
                  const value = row.cells[column.id]
                  if (column.kind === 'measure') {
                    return (
                      <TableCell key={column.id} className="text-right font-mono tabular-nums">
                        {formatMeasure(typeof value === 'number' ? value : null, column.unit)}
                      </TableCell>
                    )
                  }
                  return (
                    <TableCell key={column.id} className="max-w-[22rem] truncate">
                      {value === null || value === '' ? '—' : String(value)}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))
          )}
        </TableBody>
        {hasTotals && (
          <TableFooter>
            <TableRow>
              {result.columns.map((column, index) => {
                if (column.kind !== 'measure') {
                  return (
                    <TableCell key={column.id} className="font-medium">
                      {index === 0 ? 'Total' : null}
                    </TableCell>
                  )
                }
                const total = result.totals[column.id]
                return (
                  <TableCell key={column.id} className="text-right font-mono font-semibold tabular-nums">
                    {total === null || total === undefined ? '—' : formatMeasure(total, column.unit)}
                  </TableCell>
                )
              })}
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  )
}
