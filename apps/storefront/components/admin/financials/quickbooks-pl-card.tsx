import { TriangleAlert } from 'lucide-react'
import { getConnection } from '@/lib/quickbooks/connection'
import { getProfitAndLoss, type ProfitAndLoss } from '@/lib/quickbooks/reports'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatPrice } from '@/lib/utils'

/**
 * Profit & loss straight from QuickBooks.
 *
 * QBO owns expenses and the chart of accounts, so these figures are read from
 * it rather than recomputed here — recomputing would invent a second set of
 * books that quietly disagrees with the real one.
 */

const HEADLINE: Array<{ group: string; label: string }> = [
  { group: 'Income', label: 'Income' },
  { group: 'COGS', label: 'Cost of goods' },
  { group: 'GrossProfit', label: 'Gross profit' },
  { group: 'Expenses', label: 'Expenses' },
  { group: 'NetIncome', label: 'Net income' },
]

export default async function QuickBooksProfitAndLossCard({
  start,
  end,
}: {
  start: Date
  end: Date
}) {
  const connection = await getConnection()
  if (!connection) return null

  let report: ProfitAndLoss | null = null
  let error: string | null = null
  try {
    report = await getProfitAndLoss(start, end)
  } catch (err) {
    error = err instanceof Error ? err.message : 'Could not reach QuickBooks'
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Profit &amp; Loss</CardTitle>
            <CardDescription>
              Live from QuickBooks
              {connection.companyName ? ` · ${connection.companyName}` : ''}
              {report?.startDate ? ` · ${report.startDate} to ${report.endDate}` : ''}
            </CardDescription>
          </div>
          <Badge variant="outline">{connection.environment}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <p className="flex items-center gap-2 text-sm text-destructive">
            <TriangleAlert className="h-4 w-4" />
            {error}
          </p>
        )}

        {report && !error && (
          <>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {HEADLINE.map(({ group, label }) => {
                const value = report.totals[group]
                return (
                  <div key={group} className="rounded-lg border p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {label}
                    </p>
                    <p
                      className={`mt-1 text-lg font-semibold ${
                        value !== undefined && value < 0 ? 'text-destructive' : ''
                      }`}
                    >
                      {value === undefined ? '—' : formatPrice(value)}
                    </p>
                  </div>
                )
              })}
            </div>

            {report.sections.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No activity recorded in QuickBooks for this period.
              </p>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                {report.sections.map((section) => (
                  <div key={section.group}>
                    <div className="mb-2 flex items-baseline justify-between border-b pb-1">
                      <h3 className="text-sm font-semibold">{section.title}</h3>
                      <span className="text-sm font-medium">{formatPrice(section.total)}</span>
                    </div>
                    <ul className="space-y-1">
                      {section.lines.map((line, index) => (
                        <li
                          key={`${line.accountId ?? line.name}-${index}`}
                          className="flex justify-between gap-4 text-sm text-muted-foreground"
                        >
                          <span className="truncate">{line.name}</span>
                          <span className="shrink-0 tabular-nums">{formatPrice(line.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
