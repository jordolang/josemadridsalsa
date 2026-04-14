import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { formatPrice } from '@/lib/utils'
import { payrollRuns, payrollEmployees } from '@/lib/financials/config'
import { createMetadata } from '@/lib/metadata'

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

  const latestRun = payrollRuns[0]

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
          <a href="/admin/settings/integrations?service=adp">Connect ADP Workforce Now</a>
        </Button>
      </header>

      <Card className="space-y-4 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Current pay run</p>
            <h2 className="text-xl font-semibold text-foreground">{latestRun.period}</h2>
            <p className="text-sm text-muted-foreground">
              Pay date {new Date(latestRun.payDate).toLocaleDateString()} • Status{' '}
              <span className="font-semibold text-foreground">{latestRun.status}</span>
            </p>
          </div>
          <div className="flex gap-3 text-sm text-muted-foreground">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Gross pay</p>
              <p className="text-sm font-semibold text-foreground">{formatPrice(latestRun.grossPay)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Taxes</p>
              <p className="text-sm font-semibold text-foreground">{formatPrice(latestRun.taxesWithheld)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Net pay</p>
              <p className="text-sm font-semibold text-foreground">{formatPrice(latestRun.netPay)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          Export this run to ADP or QuickBooks Payroll once you confirm hours below. Need to adjust rates? Update
          employee profiles and regenerate the run.
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Employee earnings</h2>
            <p className="text-sm text-muted-foreground">
              Hours, gross pay, taxes, and net pay for the current period.
            </p>
          </div>
          <Button variant="outline" size="sm">
            Export CSV
          </Button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Pay type</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Taxes</TableHead>
                <TableHead className="text-right">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payrollEmployees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>
                    <p className="font-medium text-foreground">{employee.name}</p>
                  </TableCell>
                  <TableCell>{employee.role}</TableCell>
                  <TableCell className="capitalize">{employee.payType}</TableCell>
                  <TableCell className="text-right">{formatPrice(employee.rate)}</TableCell>
                  <TableCell className="text-right">{employee.hoursThisPeriod.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{formatPrice(employee.grossPay)}</TableCell>
                  <TableCell className="text-right">{formatPrice(employee.taxes)}</TableCell>
                  <TableCell className="text-right font-semibold text-foreground">{formatPrice(employee.netPay)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card className="space-y-3 p-6">
        <h2 className="text-xl font-semibold text-foreground">Next steps</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            <span className="font-semibold text-foreground">1.</span> Import time tracking CSV or sync from POS terminals.
          </li>
          <li>
            <span className="font-semibold text-foreground">2.</span> Approve hours and adjust overtime rules, benefits, or deductions.
          </li>
          <li>
            <span className="font-semibold text-foreground">3.</span> Export to ADP Workforce Now or QuickBooks Payroll and log the confirmation number.
          </li>
        </ul>
        <Badge className="bg-primary/10 text-primary">
          Payroll automation roadmap in progress
        </Badge>
      </Card>
    </div>
  )
}
