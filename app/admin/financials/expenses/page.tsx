import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { formatPrice } from '@/lib/utils'
import { expenseQueue, supportedUploadFormats } from '@/lib/financials/config'
import { FinancialUploadPanel } from '@/components/admin/financials/financial-upload-panel'
import { createMetadata } from '@/lib/metadata'

export const metadata: Metadata = createMetadata({
  title: 'Expenses - Jose Madrid Salsa Admin',
  description: 'Approve reimbursements, sync receipts, and export to your accounting suite.',
  pathname: '/admin/financials/expenses',
})

export default async function ExpensesPage() {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'financials:read'))) {
    redirect('/admin')
  }

  const awaitingApproval = expenseQueue.filter((expense) => expense.status === 'submitted')

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-salsa-500">Expenses</p>
          <h1 className="text-3xl font-serif font-semibold text-slate-900">Expense management</h1>
          <p className="text-sm text-slate-600">
            Upload receipts, classify spend, and sync reimbursements to QuickBooks, Quicken, or Xero.
          </p>
        </div>
        <Button variant="default" asChild>
          <a href="/admin/settings/integrations?service=quickbooks">Connect accounting suite</a>
        </Button>
      </header>

      <FinancialUploadPanel acceptedExtensions={supportedUploadFormats} />

      <Card className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Submission queue</h2>
            <p className="text-sm text-slate-600">
              Filter by status and push approved expenses directly to your general ledger.
            </p>
          </div>
          <Badge className="bg-slate-100 text-slate-600">
            {awaitingApproval.length} awaiting approval
          </Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="px-4 py-2 text-left font-semibold">Vendor</th>
                <th className="px-4 py-2 text-left font-semibold">Category</th>
                <th className="px-4 py-2 text-left font-semibold">Submitted by</th>
                <th className="px-4 py-2 text-left font-semibold">Submitted</th>
                <th className="px-4 py-2 text-right font-semibold">Amount</th>
                <th className="px-4 py-2 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenseQueue.map((expense) => (
                <tr key={expense.id} className="text-slate-700">
                  <td className="px-4 py-3 font-medium text-slate-900">{expense.vendor}</td>
                  <td className="px-4 py-3">{expense.category}</td>
                  <td className="px-4 py-3">{expense.submittedBy}</td>
                  <td className="px-4 py-3">{new Date(expense.submittedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatPrice(expense.amount)}</td>
                  <td className="px-4 py-3">
                    <Badge
                      className={`text-xs ${
                        expense.status === 'reimbursed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : expense.status === 'approved'
                            ? 'bg-sky-100 text-sky-700'
                            : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {expense.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
          Tip: attach PDF or JPG receipts to each expense entry. Approved reimbursements sync nightly when the QuickBooks
          integration is connected.
        </div>
      </Card>

      <Card className="space-y-3 p-6">
        <h2 className="text-xl font-semibold text-slate-900">Automation roadmap</h2>
        <ul className="space-y-2 text-sm text-slate-600">
          <li>• OCR receipt scanning and auto-category suggestions</li>
          <li>• Mileage reimbursement calculator with IRS rates</li>
          <li>• Sync to virtual card spend (Ramp, Brex) for instant reconciliation</li>
        </ul>
      </Card>
    </div>
  )
}
