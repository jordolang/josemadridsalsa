import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, BarChart3, Scale } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DOMAIN_LABELS, datasetsFor } from '@/lib/data-studio/registry'
import { getCurrentUser, getUserPermissions, hasPermission } from '@/lib/rbac'
import type { DatasetDef } from '@/lib/data-studio/types'

export const metadata: Metadata = {
  title: 'Data & Charts',
  description: 'Build charts, tables and exports from any business data source.',
}

const BASIS_NOTE: Record<DatasetDef['basis'], string> = {
  ledger: 'Bookkeeping ledger',
  operational: 'Operational records',
  summary: 'Filed / attested',
  quickbooks: 'QuickBooks',
}

export default async function DataStudioPage() {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'data:read'))) {
    redirect('/admin')
  }

  // The catalog lists only what this person may open. The executor re-checks the same permission on
  // every run, so hiding a card is presentation, not the access control itself.
  const permissions = await getUserPermissions(user)
  const available = datasetsFor(permissions)

  const byDomain = new Map<DatasetDef['domain'], DatasetDef[]>()
  for (const dataset of available) {
    const list = byDomain.get(dataset.domain) ?? []
    list.push(dataset)
    byDomain.set(dataset.domain, list)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Data &amp; Charts</h1>
          <p className="text-muted-foreground">
            Pick a data source, choose a measure and a time grain, and chart it. Every result can be
            read as a spreadsheet, printed or exported.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/data/new">
            <BarChart3 className="mr-2 h-4 w-4" />
            New report
          </Link>
        </Button>
      </div>

      {available.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            You have access to the Data section but not yet to any individual data source. Each
            dataset needs its own domain permission — financials, fundraising, customers or
            operations.
          </CardContent>
        </Card>
      ) : (
        [...byDomain.entries()].map(([domain, datasets]) => (
          <section key={domain} className="space-y-3">
            <h2 className="text-lg font-semibold">{DOMAIN_LABELS[domain]}</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {datasets.map((dataset) => (
                <Card key={dataset.id} className="flex flex-col">
                  <CardHeader className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{dataset.label}</CardTitle>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {BASIS_NOTE[dataset.basis]}
                      </Badge>
                    </div>
                    <CardDescription>{dataset.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      {dataset.measures.length} measures · {dataset.dimensions.length} breakdowns ·
                      grouped by {dataset.timeAxis.label.toLowerCase()}
                    </p>
                    <Button asChild variant="secondary" size="sm" className="w-full">
                      <Link href={`/admin/data/new?dataset=${dataset.id}`}>
                        Chart this
                        <ArrowRight className="ml-2 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))
      )}

      {permissions.includes('financials:read') && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="h-4 w-4" />
              Comparing books
            </CardTitle>
            <CardDescription>
              The ledger and the filed returns are separate books, so the studio charts them
              separately and never adds one to the other. To see how much of each attested year the
              ledger has actually captured, use the reconciliation scoreboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/financials/reconciliation">Open reconciliation</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
