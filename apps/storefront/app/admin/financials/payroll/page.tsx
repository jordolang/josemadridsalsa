import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { createMetadata } from '@/lib/metadata'
import Link from 'next/link'

export const metadata: Metadata = createMetadata({
  title: 'Payroll - Jose Madrid Salsa Admin',
  description: 'Approve payroll, sync to ADP, and review employee earnings.',
  pathname: '/admin/financials/payroll',
})

export default async function PayrollPage() {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'financials:read'))) {
    redirect('/admin')
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-primary">Payroll</p>
          <h1 className="text-3xl font-serif font-semibold text-foreground">Payroll workspace</h1>
          <p className="text-sm text-muted-foreground">
            Review hours, taxes, and employee earnings before exporting runs to ADP, QuickBooks, or Xero.
          </p>
        </div>
        <Button variant="default" asChild>
          <Link href="/admin/settings/integrations?service=adp">Connect ADP Workforce Now</Link>
        </Button>
      </header>

      <Card className="space-y-4 p-6">
        <Badge className="bg-muted text-muted-foreground">Not connected</Badge>
        <h2 className="text-xl font-semibold text-foreground">No payroll provider is connected</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Pay runs and employee earnings are read from your payroll provider — Jose Madrid Salsa does
          not store them here. Connect ADP Workforce Now or QuickBooks Payroll to bring runs, hours,
          taxes, and net pay into this workspace.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="default" asChild>
            <Link href="/admin/settings/integrations?service=adp">Connect ADP Workforce Now</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/settings/integrations?service=quickbooks">Connect QuickBooks Payroll</Link>
          </Button>
        </div>
      </Card>

      <Card className="space-y-3 p-6">
        <h2 className="text-xl font-semibold text-foreground">Next steps</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            <span className="font-semibold text-foreground">1.</span> Connect a payroll provider (ADP Workforce Now or QuickBooks Payroll).
          </li>
          <li>
            <span className="font-semibold text-foreground">2.</span> Import time tracking or sync hours from POS terminals.
          </li>
          <li>
            <span className="font-semibold text-foreground">3.</span> Review runs here, then export and log the confirmation number.
          </li>
        </ul>
        <Badge className="bg-primary/10 text-primary">
          Payroll automation roadmap in progress
        </Badge>
      </Card>
    </div>
  )
}
