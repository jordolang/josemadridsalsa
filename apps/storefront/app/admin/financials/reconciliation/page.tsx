import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { AlertTriangle, CheckCircle2, CircleSlash, TrendingUp } from 'lucide-react'

import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { createMetadata } from '@/lib/metadata'
import { ANCHOR_GRADE_LABEL, type AnchorGrade } from '@/lib/financials/anchors'
import {
  type ReconciliationStatus,
  type YearReconciliation,
  reconcileYears,
  summariseReconciliation,
} from '@/lib/financials/reconciliation'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export const metadata: Metadata = createMetadata({
  title: 'Ledger Reconciliation - Jose Madrid Salsa Admin',
  description: 'How much of the business the ledger has actually captured, year by year.',
  pathname: '/admin/financials/reconciliation',
})

// Always read live — this page exists to answer "where are we right now?".
export const dynamic = 'force-dynamic'

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

function formatRatio(ratio: number | null): string {
  return ratio === null ? '—' : `${(ratio * 100).toFixed(1)}%`
}

const STATUS_LABEL: Record<ReconciliationStatus, string> = {
  RECONCILED: 'Reconciled',
  UNDER_CAPTURED: 'Under-captured',
  OVER_CAPTURED: 'Over anchor',
  ABOVE_FLOOR: 'Above floor',
  NO_ANCHOR: 'No document',
  NO_LEDGER_DATA: 'Nothing in ledger',
}

/** Only `UNDER_CAPTURED` and `NO_LEDGER_DATA` are problems. Beating a floor is the goal. */
const STATUS_VARIANT: Record<ReconciliationStatus, 'default' | 'secondary' | 'destructive' | 'outline'> =
  {
    RECONCILED: 'default',
    ABOVE_FLOOR: 'default',
    OVER_CAPTURED: 'secondary',
    UNDER_CAPTURED: 'destructive',
    NO_LEDGER_DATA: 'destructive',
    NO_ANCHOR: 'outline',
  }

const GRADE_VARIANT: Record<AnchorGrade, 'default' | 'secondary' | 'outline'> = {
  FILED: 'default',
  PL: 'secondary',
  PARTIAL: 'outline',
  FLOOR: 'outline',
}

/**
 * Ledger income per calendar year, in cents.
 *
 * Grouped in SQL because this is a pure sum over an indexed column with no missing-value problem —
 * every entry has a date, a direction and an amount. The year is taken in the business's timezone
 * so a sale rung up on 31 December does not land in the following tax year; Vercel runs functions
 * with `TZ=UTC`, so without the shift this would misfile every late-December evening sale.
 */
async function ledgerIncomeByYear(): Promise<{ year: number; incomeCents: number }[]> {
  const rows = await prisma.$queryRaw<{ year: number; income_cents: bigint }[]>`
    SELECT
      EXTRACT(YEAR FROM ("date" AT TIME ZONE 'America/New_York'))::int AS year,
      COALESCE(SUM("amountCents"), 0)::bigint AS income_cents
    FROM ledger_entries
    WHERE "direction" = 'INCOME'
    GROUP BY 1
    ORDER BY 1
  `

  return rows.map((r) => ({ year: r.year, incomeCents: Number(r.income_cents) }))
}

export default async function ReconciliationPage() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'financials:read'))) {
    redirect('/admin')
  }

  const rows = reconcileYears(await ledgerIncomeByYear())
  const summary = summariseReconciliation(rows)

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Ledger reconciliation</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Ledger income measured against figures printed on filed tax returns and year-end P&amp;Ls.
          Nothing on this page is derived from the ledger, so it can tell you what the ledger cannot:
          how much of the business it has never been told about.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" aria-hidden />
              Captured
            </CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {formatRatio(summary.capturedRatio)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            of attested revenue across the {summary.completeYears} fully-documented years
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              Never recorded
            </CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {formatCents(summary.missingCents)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            proven by paperwork, absent from the ledger
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              Years reconciled
            </CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {summary.reconciledYears} / {summary.completeYears}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            within $1 of the filed figure
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <CircleSlash className="h-3.5 w-3.5" aria-hidden />
              Attested revenue
            </CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {formatCents(summary.anchorCents)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            filed returns and year-end P&amp;Ls combined
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Year by year</CardTitle>
          <CardDescription>
            <strong>Documented floor</strong> years are lower bounds, not targets — the ledger
            exceeding one is progress, not an error, and they are excluded from the headline figures
            above.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Year</th>
                  <th className="py-2 pr-4 text-right font-medium">In ledger</th>
                  <th className="py-2 pr-4 text-right font-medium">Attested</th>
                  <th className="py-2 pr-4 text-right font-medium">Variance</th>
                  <th className="py-2 pr-4 text-right font-medium">Captured</th>
                  <th className="py-2 pr-4 font-medium">Evidence</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <ReconciliationRow key={row.year} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ReconciliationRow({ row }: { row: YearReconciliation }) {
  const shortfall = row.varianceCents !== null && row.varianceCents < 0

  return (
    <tr className="border-b last:border-0 align-top">
      <td className="py-2 pr-4 font-medium tabular-nums">{row.year}</td>
      <td className="py-2 pr-4 text-right tabular-nums">{formatCents(row.ledgerIncomeCents)}</td>
      <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
        {row.anchorCents === null ? '—' : formatCents(row.anchorCents)}
      </td>
      <td
        className={`py-2 pr-4 text-right tabular-nums ${shortfall ? 'text-destructive' : 'text-muted-foreground'}`}
      >
        {row.varianceCents === null ? '—' : formatCents(row.varianceCents)}
      </td>
      <td className="py-2 pr-4 text-right tabular-nums">{formatRatio(row.capturedRatio)}</td>
      <td className="py-2 pr-4">
        {row.grade ? (
          <div className="space-y-1">
            <Badge variant={GRADE_VARIANT[row.grade]}>{ANCHOR_GRADE_LABEL[row.grade]}</Badge>
            {row.anchor?.coverageNote ? (
              <p className="max-w-md text-xs leading-snug text-muted-foreground">
                {row.anchor.coverageNote}
              </p>
            ) : null}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="py-2">
        <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABEL[row.status]}</Badge>
      </td>
    </tr>
  )
}
