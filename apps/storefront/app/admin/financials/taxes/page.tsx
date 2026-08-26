import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { createMetadata } from '@/lib/metadata'
import { formatPrice } from '@/lib/utils'
import { getTaxReport } from '@/lib/analytics/tax-report.server'
import {
  isTaxPeriodKey,
  TAX_PERIOD_OPTIONS,
  UNKNOWN_JURISDICTION,
  type TaxPeriodKey,
} from '@/lib/analytics/tax-report'

export const metadata: Metadata = createMetadata({
  title: 'Taxes - Jose Madrid Salsa Admin',
  description: 'Sales tax collected by period and jurisdiction, plus filing tasks.',
  pathname: '/admin/financials/taxes',
})

const CHANNEL_LABELS: Record<string, string> = {
  WEBSITE: 'Website',
  POS: 'In person',
  FUNDRAISER: 'Fundraiser',
  WHOLESALE: 'Wholesale',
  MANUAL: 'Manual',
  MARKETPLACE: 'Marketplace',
  PHONE: 'Phone',
  IMPORT: 'Imported',
}

export default async function TaxesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'financials:read'))) {
    redirect('/admin')
  }

  const params = await searchParams
  const period: TaxPeriodKey = isTaxPeriodKey(params.period) ? params.period : 'this-quarter'
  const report = await getTaxReport(period)
  const { summary } = report

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-primary">Tax prep</p>
          <h1 className="text-3xl font-serif font-semibold text-foreground">Tax compliance hub</h1>
          <p className="text-sm text-muted-foreground">
            What was collected, and the filings it has to go on.
          </p>
        </div>
        <Button variant="default" asChild>
          <a href="mailto:mike@josemadridsalsa.com?subject=Tax%20CPA%20Review">Request CPA review</a>
        </Button>
      </header>

      <Card className="space-y-5 p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Sales tax collected · {report.period.label}
            </h2>
            <p className="text-sm text-muted-foreground">
              Calendar periods, because that is what a return covers. Grouped by the destination
              state on the order.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {TAX_PERIOD_OPTIONS.map((option) => (
              <Button
                key={option.value}
                asChild
                size="sm"
                variant={option.value === period ? 'default' : 'ghost'}
              >
                <Link href={`/admin/financials/taxes?period=${option.value}`}>{option.label}</Link>
              </Button>
            ))}
            <Button asChild size="sm" variant="outline">
              <a href={`/api/admin/financials/tax-report/export?period=${period}`}>Export CSV</a>
            </Button>
          </div>
        </div>

        {summary.orderCount === 0 ? (
          <p className="text-sm text-muted-foreground">No orders in this period.</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Tax collected</p>
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {formatPrice(summary.taxCents / 100)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gross sales</p>
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {formatPrice(summary.grossSalesCents / 100)}
                </p>
                <p className="text-xs text-muted-foreground">before tax, after discounts</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Exempt sales</p>
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {formatPrice(summary.untaxedSalesCents / 100)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {summary.untaxedOrderCount} order{summary.untaxedOrderCount === 1 ? '' : 's'} with
                  no tax
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Orders</p>
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {summary.orderCount.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Jurisdiction</th>
                    <th className="py-2 pr-4 text-right font-medium">Orders</th>
                    <th className="py-2 pr-4 text-right font-medium">Gross sales</th>
                    <th className="py-2 pr-4 text-right font-medium">Tax collected</th>
                    <th className="py-2 text-right font-medium">Effective rate</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byState.map((row) => (
                    <tr key={row.state} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-medium text-foreground">
                        {row.state === UNKNOWN_JURISDICTION ? 'No shipping address' : row.state}
                        {row.untaxedOrderCount > 0 && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {row.untaxedOrderCount} untaxed
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">{row.orderCount}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {formatPrice(row.grossSalesCents / 100)}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {formatPrice(row.taxCents / 100)}
                      </td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">
                        {row.effectiveRate === null
                          ? '—'
                          : `${(row.effectiveRate * 100).toFixed(2)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              {summary.byChannel.map((row) => (
                <span key={row.channel}>
                  {CHANNEL_LABELS[row.channel] ?? row.channel}:{' '}
                  <span className="tabular-nums text-foreground">
                    {formatPrice(row.taxCents / 100)}
                  </span>{' '}
                  ({row.orderCount})
                </span>
              ))}
            </div>

            {/* Both caveats travel with the numbers, so neither gets quoted as a filing figure. */}
            <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50/60 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
              {report.refunded.orderCount > 0 && (
                <p>
                  {report.refunded.orderCount} refunded order
                  {report.refunded.orderCount === 1 ? '' : 's'} in this period carried{' '}
                  {formatPrice(report.refunded.taxCents / 100)} of tax, still counted above.
                  Whether it comes off the return depends on whether each refund included tax.
                </p>
              )}
              {summary.unplaceableOrderCount > 0 && (
                <p>
                  {summary.unplaceableOrderCount} order
                  {summary.unplaceableOrderCount === 1 ? '' : 's'} have no shipping address —
                  counter and most manual sales — so they cannot be assigned to a state. They are
                  in the totals but grouped under &ldquo;No shipping address&rdquo;.
                </p>
              )}
              <p>
                County and city splits are not available: Stripe Tax returns them at checkout but
                only the order total is stored. The effective rate is derived for sanity-checking,
                not a rate to file at.
              </p>
            </div>
          </>
        )}
      </Card>

      <Card className="space-y-3 p-6">
        <h2 className="text-xl font-semibold text-foreground">Documentation checklist</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• Sales tax summaries from the storefront, wholesale invoices, and in-person events</li>
          <li>• Payroll tax exports (ADP, QuickBooks) including Form 941 & W-2 confirmations</li>
          <li>• Ohio CAT filings, federal EIN documentation, and accountant contact details</li>
        </ul>
      </Card>
    </div>
  )
}
