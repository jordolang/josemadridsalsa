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
import { expenseQueue, supportedUploadFormats } from '@/lib/financials/config'
import QuickBooksExpensesCard from '@/components/admin/financials/quickbooks-expenses-card'
import { FinancialUploadPanel } from '@/components/admin/financials/financial-upload-panel'
import { createMetadata } from '@/lib/metadata'
import Link from 'next/link'

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
          <p className="text-xs uppercase tracking-[0.35em] text-primary">Expenses</p>
          <h1 className="text-3xl font-serif font-semibold text-foreground">Expense management</h1>
          <p className="text-sm text-muted-foreground">
            Upload receipts, classify spend, and sync reimbursements to QuickBooks, Quicken, or Xero.
          </p>
        </div>
        <Button variant="default" asChild>
          <Link href="/admin/settings/integrations?service=quickbooks">Connect accounting suite</Link>
        </Button>
      </header>

      <FinancialUploadPanel acceptedExtensions={supportedUploadFormats} />

      {/* Renders nothing when QuickBooks isn't connected. */}
      <QuickBooksExpensesCard />

      <Card className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Submission queue</h2>
            <p className="text-sm text-muted-foreground">
              Filter by status and push approved expenses directly to your general ledger.
            </p>
          </div>
          <Badge className="bg-muted text-muted-foreground">
            {awaitingApproval.length} awaiting approval
          </Badge>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Submitted by</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenseQueue.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="font-medium text-foreground">{expense.vendor}</TableCell>
                  <TableCell>{expense.category}</TableCell>
                  <TableCell>{expense.submittedBy}</TableCell>
                  <TableCell>{new Date(expense.submittedAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right font-semibold text-foreground">{formatPrice(expense.amount)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        expense.status === 'reimbursed'
                          ? 'default'
                          : expense.status === 'approved'
                            ? 'secondary'
                            : 'outline'
                      }
                    >
                      {expense.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="rounded-xl border border-border bg-muted/50 p-4 text-xs text-muted-foreground">
          Tip: attach PDF or JPG receipts to each expense entry. Approved reimbursements sync nightly when the QuickBooks
          integration is connected.
        </div>
      </Card>

      <Card className="space-y-3 p-6">
        <h2 className="text-xl font-semibold text-foreground">Automation roadmap</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• OCR receipt scanning and auto-category suggestions</li>
          <li>• Mileage reimbursement calculator with IRS rates</li>
          <li>• Sync to virtual card spend (Ramp, Brex) for instant reconciliation</li>
        </ul>
      </Card>
    </div>
  )
}
