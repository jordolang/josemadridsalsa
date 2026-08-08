import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertTriangle, DollarSign, Percent, TrendingUp } from 'lucide-react'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { StatsCard } from '@/components/admin/StatsCard'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { RANGE_OPTIONS, getDateRange, type AnalyticsRangeKey } from '@/lib/analytics/date-range'
import {
  describeCoverage,
  formatCents,
  formatRatio,
  marginConfidence,
} from '@/lib/analytics/margin'
import { getMarginReport } from '@/lib/analytics/margin-report.server'

/**
 * Which salsas actually make money.
 *
 * Deliberately *operational* margin, not accounting: QuickBooks Online remains the source of
 * truth for the books, and a second net-income figure that disagreed with it would be worse
 * than none. This answers what QBO answers badly, from the cost snapshotted onto each order
 * line at the moment it sold.
 *
 * Every figure carries the share of revenue it could actually see. A product with no recorded
 * cost is excluded from profit and counted against coverage rather than being averaged in as
 * free stock, so the page under-claims rather than flattering itself.
 */

type SearchParams = { range?: string }

function isValidRange(value: string | undefined): value is AnalyticsRangeKey {
  return value === '7d' || value === '30d' || value === '90d' || value === '365d'
}

export default async function MarginAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'analytics:read'))) {
    redirect('/admin')
  }

  const params = await searchParams
  const range = isValidRange(params.range) ? params.range : '30d'
  const data = await getMarginReport(range)
  const { summary, contribution } = data
  const confidence = marginConfidence(summary)
  const coverage = describeCoverage(summary)

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Margin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            What each product earns, from the cost recorded when it sold
          </p>
        </div>
        <div className="flex rounded-lg border border-border bg-card">
          {RANGE_OPTIONS.map((option) => (
            <Link
              key={option.value}
              href={`/admin/analytics/margin?range=${option.value}`}
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

      {/* With nothing costed there is no margin to show, and a row of dashes reads as broken.
          Lead with what to do about it instead. */}
      {confidence === 'none' ? (
        <Card className="p-8">
          <div className="mx-auto max-w-2xl text-center">
            <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-amber-500" />
            <h2 className="text-lg font-semibold text-foreground">
              No margin to report yet
            </h2>
            <p className="mt-3 text-muted-foreground">{coverage}</p>
            {data.uncostedProductCount > 0 && (
              <p className="mt-4 text-sm text-muted-foreground">
                {data.uncostedProductCount} active{' '}
                {data.uncostedProductCount === 1 ? 'product has' : 'products have'} no cost
                price. Select them on the products page and use <strong>Set cost</strong>, or{' '}
                <strong>Cost from purchases</strong> to take what a supplier most recently
                charged.
              </p>
            )}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link href="/admin/products">Set product costs</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/admin/purchase-orders">Record a purchase order</Link>
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="Revenue"
              value={formatCents(summary.revenueCents)}
              subtitle={`${data.orderCount} order${data.orderCount === 1 ? '' : 's'}`}
              icon={DollarSign}
              color="blue"
            />
            <StatsCard
              title="Cost of goods"
              value={formatCents(summary.costCents)}
              subtitle={`on ${formatCents(summary.costedRevenueCents)} of revenue`}
              icon={DollarSign}
              color="orange"
            />
            <StatsCard
              title="Gross profit"
              value={formatCents(summary.grossProfitCents)}
              subtitle="before fundraiser commission"
              icon={TrendingUp}
              color="green"
            />
            <StatsCard
              title="Margin"
              value={formatRatio(summary.marginRatio)}
              subtitle={`${Math.round(summary.coverageRatio * 100)}% of revenue costed`}
              icon={Percent}
              color="purple"
            />
          </div>

          {/* The caveat travels with the numbers. Without it the margin gets quoted as fact. */}
          <Card
            className={`p-4 ${
              confidence === 'good'
                ? 'border-border'
                : 'border-amber-300 bg-amber-50/60 dark:bg-amber-950/20'
            }`}
          >
            <p className="text-sm text-foreground">
              {confidence !== 'good' && (
                <AlertTriangle className="mr-2 inline h-4 w-4 text-amber-600" />
              )}
              {coverage}
            </p>
          </Card>

          {contribution.commissionCents > 0 && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-foreground">
                After fundraiser commission
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Fundraiser orders owe roughly half the merchandise value to the group, so gross
                profit overstates what those sales left behind. Shown separately rather than
                blended into the margin above, which would net commission on some orders and
                not others.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Gross profit</p>
                  <p className="text-xl font-semibold text-foreground">
                    {formatCents(contribution.grossProfitCents)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Paid to groups</p>
                  <p className="text-xl font-semibold text-foreground">
                    −{formatCents(contribution.commissionCents)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Contribution</p>
                  <p
                    className={`text-xl font-semibold ${
                      contribution.contributionCents < 0 ? 'text-red-600' : 'text-foreground'
                    }`}
                  >
                    {formatCents(contribution.contributionCents)}
                  </p>
                </div>
              </div>
            </Card>
          )}

          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground">By product</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ranked by revenue, since a product with no recorded cost has no profit to rank by.
            </p>
            <div className="mt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.products.map((row) => (
                    <TableRow key={row.productId}>
                      <TableCell>
                        <span className="font-medium text-foreground">{row.productName}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {row.productSku}
                          {row.uncosted && ' · no cost recorded'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.summary.unitsTotal}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCents(row.summary.revenueCents)}
                      </TableCell>
                      {/* An em dash, never a zero: nothing was recorded, nothing was free. */}
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {row.uncosted ? '—' : formatCents(row.summary.costCents)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.uncosted ? '—' : formatCents(row.summary.grossProfitCents)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatRatio(row.summary.marginRatio)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
