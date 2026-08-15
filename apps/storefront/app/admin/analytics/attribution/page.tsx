import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Link2, DollarSign, Target, ShoppingBag } from 'lucide-react'

import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { StatsCard } from '@/components/admin/StatsCard'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { RANGE_OPTIONS, type AnalyticsRangeKey } from '@/lib/analytics/date-range'
import { formatCents, formatRatio } from '@/lib/analytics/margin'
import {
  ATTRIBUTION_DIMENSIONS,
  DIRECT_LABEL,
  type AttributionDimension,
} from '@/lib/analytics/utm-report'
import { getAttributionReport } from '@/lib/analytics/utm-report.server'

/**
 * Where sales come from.
 *
 * First-touch UTM attribution: orders grouped by the source, medium, or campaign captured when the
 * buyer first landed. Honest about its own limits — orders with no captured source are their own
 * **Direct / none** row, never folded into a campaign, and the headline states how much of the
 * period could be attributed at all (see `utm-report.ts`).
 */

type SearchParams = { range?: string; dim?: string }

function isValidRange(value: string | undefined): value is AnalyticsRangeKey {
  return value === '7d' || value === '30d' || value === '90d' || value === '365d'
}

function isValidDimension(value: string | undefined): value is AttributionDimension {
  return ATTRIBUTION_DIMENSIONS.some((d) => d.value === value)
}

export default async function AttributionPage({
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
  const dimension = isValidDimension(params.dim) ? params.dim : 'source'
  const { summary, rows } = await getAttributionReport(range, dimension)

  const dimensionLabel =
    ATTRIBUTION_DIMENSIONS.find((d) => d.value === dimension)?.label ?? 'Source'

  // The "no value" row means different things per dimension: on source it is genuinely direct
  // traffic; on medium/campaign/referrer it is an attributed order that simply lacks that one field.
  const emptyLabel = dimension === 'source' ? DIRECT_LABEL : `No ${dimensionLabel.toLowerCase()}`

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Attribution</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Where orders come from, by first-touch UTM source, medium, campaign, and referrer
          </p>
        </div>
        <div className="flex rounded-lg border border-border bg-card">
          {RANGE_OPTIONS.map((option) => (
            <Link
              key={option.value}
              href={`/admin/analytics/attribution?range=${option.value}&dim=${dimension}`}
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
          title="Orders"
          value={summary.totalOrders}
          subtitle="in this period"
          icon={ShoppingBag}
          color="blue"
        />
        <StatsCard
          title="Revenue"
          value={formatCents(summary.totalRevenueCents)}
          subtitle="across all sources"
          icon={DollarSign}
          color="green"
        />
        <StatsCard
          title="Attributed"
          value={formatRatio(summary.coverageRatio)}
          subtitle={`${summary.attributedOrders} of ${summary.totalOrders} carried a source`}
          icon={Target}
          color="purple"
        />
        <StatsCard
          title="Attributed revenue"
          value={formatCents(summary.attributedRevenueCents)}
          subtitle={`${formatCents(summary.directRevenueCents)} direct / none`}
          icon={Link2}
          color="orange"
        />
      </div>

      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">By {dimensionLabel.toLowerCase()}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ranked by revenue. Orders with no captured {dimensionLabel.toLowerCase()} are their
              own row, so the table sums to the period total.
            </p>
          </div>
          <div className="flex rounded-lg border border-border bg-card">
            {ATTRIBUTION_DIMENSIONS.map((d) => (
              <Link
                key={d.value}
                href={`/admin/analytics/attribution?range=${range}&dim=${d.value}`}
                className={`px-3 py-1.5 text-sm font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${
                  dimension === d.value
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:bg-muted/50'
                }`}
              >
                {d.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{dimensionLabel}</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Avg order</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No orders in this period.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell>
                      {row.direct ? (
                        <Badge variant="secondary" className="text-[11px]">
                          {emptyLabel}
                        </Badge>
                      ) : (
                        <span className="font-medium text-foreground">{row.key}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.orders}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCents(row.revenueCents)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {row.aovCents === null ? '—' : formatCents(row.aovCents)}
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
