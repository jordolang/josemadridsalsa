import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertTriangle, Boxes, Clock, Repeat, TrendingDown } from 'lucide-react'

import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { StatsCard } from '@/components/admin/StatsCard'
import { Badge } from '@/components/ui/badge'
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
import { formatCents } from '@/lib/analytics/margin'
import {
  SLOW_MOVER_DAYS,
  formatDays,
  formatTurnover,
} from '@/lib/analytics/inventory-turnover'
import { getTurnoverReport } from '@/lib/analytics/inventory-turnover.server'

/**
 * How fast stock is selling, and what is sitting still.
 *
 * Two questions on one page: an overall turnover ratio (how many times the shelf sold through in
 * the window) and a per-product table ranked slowest-first, so the products tying up capital are
 * the ones you see. Deliberately *operational*, not a valuation — see `inventory-turnover.ts`.
 *
 * The value figures carry the share of stock they could cost, exactly as the margin page does: a
 * product with no recorded cost is excluded from the ratio rather than valued at zero. The
 * velocity half of the table needs no cost, so it works even when the catalogue has none.
 */

type SearchParams = { range?: string }

function isValidRange(value: string | undefined): value is AnalyticsRangeKey {
  return value === '7d' || value === '30d' || value === '90d' || value === '365d'
}

export default async function InventoryTurnoverPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'analytics:read'))) {
    redirect('/admin')
  }

  const params = await searchParams
  const range = isValidRange(params.range) ? params.range : '90d'
  const { summary, products, days, uncostedProductCount } = await getTurnoverReport(range)

  const slowMoverCount = products.filter((p) => p.slowMover).length
  const coveragePct = Math.round(summary.coverageRatio * 100)
  // Whether coverage is short is decided on the exact ratio, not the rounded percent — 99.6% must
  // not round to 100 and silently drop the caveat.
  const coverageComplete = summary.coverageRatio >= 1

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Turnover &amp; slow movers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            How fast stock is selling, and what is holding on the shelf
          </p>
        </div>
        <div className="flex rounded-lg border border-border bg-card">
          {RANGE_OPTIONS.map((option) => (
            <Link
              key={option.value}
              href={`/admin/analytics/inventory-turnover?range=${option.value}`}
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
          title="Annualised turnover"
          value={formatTurnover(summary.annualisedTurnover)}
          subtitle={`${formatTurnover(summary.turnoverForPeriod)} over ${days} days`}
          icon={Repeat}
          color="blue"
        />
        <StatsCard
          title="Days on hand"
          value={formatDays(summary.daysOnHand)}
          subtitle="to clear current stock at this pace"
          icon={Clock}
          color="purple"
        />
        <StatsCard
          title="Inventory at cost"
          value={formatCents(summary.costedInventoryValueCents)}
          subtitle={`${coveragePct}% of stock costed`}
          icon={Boxes}
          color="orange"
        />
        <StatsCard
          title="Slow movers"
          value={slowMoverCount}
          subtitle={`selling slower than ${SLOW_MOVER_DAYS} days of supply`}
          icon={TrendingDown}
          color="red"
        />
      </div>

      {/* The caveat travels with the value figures, the same rule as the margin page. */}
      {!coverageComplete && summary.totalStockUnits > 0 && (
        <Card className="border-amber-300 bg-amber-50/60 p-4 dark:bg-amber-950/20">
          <p className="text-sm text-foreground">
            <AlertTriangle className="mr-2 inline h-4 w-4 text-amber-600" />
            Turnover and inventory value cover the {coveragePct}% of stock that has a recorded
            cost.{' '}
            {uncostedProductCount > 0 && (
              <>
                {uncostedProductCount} active{' '}
                {uncostedProductCount === 1 ? 'product has' : 'products have'} no cost price and
                are excluded from those figures — set costs on the{' '}
                <Link href="/admin/products" className="underline">
                  products page
                </Link>{' '}
                to see them. The units and days-of-supply below do not depend on cost.
              </>
            )}
          </p>
        </Card>
      )}

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground">By product</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ranked slowest-first: products holding stock with no sales lead, then the longest days of
          supply. Days of supply projects how long the current shelf lasts at this window&apos;s
          pace.
        </p>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">On hand</TableHead>
                <TableHead className="text-right">Sold</TableHead>
                <TableHead className="text-right">Days of supply</TableHead>
                <TableHead className="text-right">Stock value</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No active products.
                  </TableCell>
                </TableRow>
              ) : (
                products.map((row) => (
                  <TableRow key={row.productId}>
                    <TableCell>
                      <span className="font-medium text-foreground">{row.productName}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {row.productSku}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.currentStock}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.unitsSold}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {/* No sales with stock reads as "no pace", never a number. Empty shelf is 0. */}
                      {row.noSales ? (
                        <span className="text-muted-foreground">no sales</span>
                      ) : (
                        formatDays(row.daysOfSupply)
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {/* An em dash, never a zero: no cost was recorded, the stock is not free. */}
                      {row.stockValueCents === null ? '—' : formatCents(row.stockValueCents)}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.slowMover && (
                        <Badge
                          variant={row.noSales ? 'destructive' : 'secondary'}
                          className="text-[11px]"
                        >
                          {row.noSales ? 'No sales' : 'Slow'}
                        </Badge>
                      )}
                    </TableCell>
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
