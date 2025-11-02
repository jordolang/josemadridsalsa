import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { formatPrice } from '@/lib/utils'
import { payrollRuns, payrollEmployees } from '@/lib/financials/config'

export const metadata = {
  title: 'Payroll',
  description: 'Approve payroll, sync to ADP, and review employee earnings.',
}

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
          <p className="text-xs uppercase tracking-[0.35em] text-salsa-500">Payroll</p>
          <h1 className="text-3xl font-serif font-semibold text-slate-900">Payroll workspace</h1>
          <p className="text-sm text-slate-600">
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
            <p className="text-xs uppercase text-slate-500">Current pay run</p>
            <h2 className="text-xl font-semibold text-slate-900">{latestRun.period}</h2>
            <p className="text-sm text-slate-600">
              Pay date {new Date(latestRun.payDate).toLocaleDateString()} • Status{' '}
              <span className="font-semibold text-slate-900">{latestRun.status}</span>
            </p>
          </div>
          <div className="flex gap-3 text-sm text-slate-500">
            <div>
              <p className="text-xs uppercase text-slate-500">Gross pay</p>
              <p className="text-sm font-semibold text-slate-900">{formatPrice(latestRun.grossPay)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Taxes</p>
              <p className="text-sm font-semibold text-slate-900">{formatPrice(latestRun.taxesWithheld)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Net pay</p>
              <p className="text-sm font-semibold text-slate-900">{formatPrice(latestRun.netPay)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Export this run to ADP or QuickBooks Payroll once you confirm hours below. Need to adjust rates? Update
          employee profiles and regenerate the run.
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Employee earnings</h2>
            <p className="text-sm text-slate-600">
              Hours, gross pay, taxes, and net pay for the current period.
            </p>
          </div>
          <Button variant="outline" size="sm">
            Export CSV
          </Button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="px-4 py-2 text-left font-semibold">Employee</th>
                <th className="px-4 py-2 text-left font-semibold">Role</th>
                <th className="px-4 py-2 text-left font-semibold">Pay type</th>
                <th className="px-4 py-2 text-right font-semibold">Rate</th>
                <th className="px-4 py-2 text-right font-semibold">Hours</th>
                <th className="px-4 py-2 text-right font-semibold">Gross</th>
                <th className="px-4 py-2 text-right font-semibold">Taxes</th>
                <th className="px-4 py-2 text-right font-semibold">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payrollEmployees.map((employee) => (
                <tr key={employee.id} className="text-slate-700">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{employee.name}</p>
                  </td>
                  <td className="px-4 py-3">{employee.role}</td>
                  <td className="px-4 py-3 capitalize">{employee.payType}</td>
                  <td className="px-4 py-3 text-right">{formatPrice(employee.rate)}</td>
                  <td className="px-4 py-3 text-right">{employee.hoursThisPeriod.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">{formatPrice(employee.grossPay)}</td>
                  <td className="px-4 py-3 text-right">{formatPrice(employee.taxes)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatPrice(employee.netPay)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="space-y-3 p-6">
        <h2 className="text-xl font-semibold text-slate-900">Next steps</h2>
        <ul className="space-y-2 text-sm text-slate-600">
          <li>
            <span className="font-semibold text-slate-900">1.</span> Import time tracking CSV or sync from POS terminals.
          </li>
          <li>
            <span className="font-semibold text-slate-900">2.</span> Approve hours and adjust overtime rules, benefits, or deductions.
          </li>
          <li>
            <span className="font-semibold text-slate-900">3.</span> Export to ADP Workforce Now or QuickBooks Payroll and log the confirmation number.
          </li>
        </ul>
        <Badge className="bg-emerald-100 text-emerald-700">
          Payroll automation roadmap in progress
        </Badge>
      </Card>
    </div>
  )
}
