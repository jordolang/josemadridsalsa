import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Repeat, Users, ShoppingBag, Info } from 'lucide-react'

import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { StatsCard } from '@/components/admin/StatsCard'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { RANGE_OPTIONS, type AnalyticsRangeKey } from '@/lib/analytics/date-range'
import { formatRatio } from '@/lib/analytics/margin'
import { formatCohortMonth, formatRetention } from '@/lib/analytics/cohort-retention'
import { getCohortReport } from '@/lib/analytics/cohort-retention.server'

/**
 * Do customers come back?
 *
 * Repeat-purchase rate answers it as one number; the cohort grid answers it over time — of the
 * buyers first seen in a month, what share ordered again in each month that followed. Deliberately
 * *operational*, and honest about two things a retention grid gets misread on: offset 0 is the
 * acquisition month and is 100% by definition, and a cell the data cannot see yet is blank, never
 * 0% (see `cohort-retention.ts`).
 */

type SearchParams = { range?: string }

function isValidRange(value: string | undefined): value is AnalyticsRangeKey {
  return value === '7d' || value === '30d' || value === '90d' || value === '365d'
}

/** A cell's background deepens with retention, so the grid reads at a glance. */
function heatStyle(ratio: number | null): string {
  if (ratio === null) return 'text-muted-foreground/40'
  if (ratio === 0) return 'text-muted-foreground'
  if (ratio >= 0.5) return 'bg-emerald-500/30 text-foreground font-medium'
  if (ratio >= 0.25) return 'bg-emerald-500/20 text-foreground'
  if (ratio >= 0.1) return 'bg-emerald-500/10 text-foreground'
  return 'bg-emerald-500/5 text-foreground'
}

export default async function RetentionPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'analytics:read'))) {
    redirect('/admin')
  }

  const params = await searchParams
  const range = isValidRange(params.range) ? params.range : '365d'
  const { repeat, cohorts, maxOffset, unattributedOrders } = await getCohortReport(range)

  const offsets = Array.from({ length: maxOffset + 1 }, (_, i) => i)

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Retention &amp; repeat purchase</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Whether buyers come back, as one rate and as a cohort grid
          </p>
        </div>
        <div className="flex rounded-lg border border-border bg-card">
          {RANGE_OPTIONS.map((option) => (
            <Link
              key={option.value}
              href={`/admin/analytics/retention?range=${option.value}`}
              className={`px-3 py-1.5 text-sm font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${
                range === option.value
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:bg-muted/50'
              }`}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Repeat rate"
          value={formatRatio(repeat.repeatRate)}
          subtitle={`${repeat.repeatBuyers} of ${repeat.totalBuyers} bought again`}
          icon={Repeat}
          color="green"
        />
        <StatsCard
          title="Buyers"
          value={repeat.totalBuyers}
          subtitle="distinct in this period"
          icon={Users}
          color="blue"
        />
        <StatsCard
          title="Orders per buyer"
          value={repeat.ordersPerBuyer === null ? '—' : repeat.ordersPerBuyer.toFixed(2)}
          subtitle={`${repeat.totalOrders} orders`}
          icon={ShoppingBag}
          color="purple"
        />
        <StatsCard
          title="Cohorts"
          value={cohorts.length}
          subtitle="acquisition months"
          icon={Users}
          color="orange"
        />
      </div>

      {unattributedOrders > 0 && (
        <Card className="border-amber-300 bg-amber-50/60 p-4 dark:bg-amber-950/20">
          <p className="text-sm text-foreground">
            <Info className="mr-2 inline h-4 w-4 text-amber-600" />
            {unattributedOrders} order{unattributedOrders === 1 ? '' : 's'} in this period{' '}
            {unattributedOrders === 1 ? 'has' : 'have'} no customer account or email and cannot be
            tied to a buyer, so {unattributedOrders === 1 ? 'it is' : 'they are'} excluded from
            these figures rather than counted as one-time buyers.
          </p>
        </Card>
      )}

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground">Cohort retention</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Each row is the buyers first seen in that month. Month 0 is when they were acquired
          (always 100%); each later column is the share who ordered again that many months on. A
          blank cell has not happened yet.
        </p>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Cohort</TableHead>
                <TableHead className="text-right">Buyers</TableHead>
                {offsets.map((offset) => (
                  <TableHead key={offset} className="text-right whitespace-nowrap">
                    {offset === 0 ? 'New' : `+${offset}`}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {cohorts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={offsets.length + 2} className="text-center text-muted-foreground">
                    No buyers in this period.
                  </TableCell>
                </TableRow>
              ) : (
                cohorts.map((row) => (
                  <TableRow key={row.cohort}>
                    <TableCell className="whitespace-nowrap font-medium text-foreground">
                      {formatCohortMonth(row.cohort)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.cohortSize}</TableCell>
                    {/* analyseCohorts fills every row to maxOffset + 1, so each already spans all
                        columns; not-yet-observable offsets are null and render as an em dash. */}
                    {row.retentionByOffset.map((ratio, offset) => (
                      <TableCell
                        key={offset}
                        className={`text-right tabular-nums ${heatStyle(ratio)}`}
                      >
                        {formatRetention(ratio)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
