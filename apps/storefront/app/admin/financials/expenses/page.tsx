import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { getConnection } from '@/lib/quickbooks/connection'
import { supportedUploadFormats } from '@/lib/financials/config'
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

  const connection = await getConnection()

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

      {connection ? (
        <QuickBooksExpensesCard />
      ) : (
        <Card className="space-y-3 p-6">
          <h2 className="text-xl font-semibold text-foreground">Expenses &amp; payables</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            QuickBooks Online is the source of truth for money going out — purchases, bills, and
            vendor balances, including receipts captured with its own tool. Connect QuickBooks to
            read them here. Nothing is entered or stored on this side.
          </p>
          <div>
            <Button variant="default" asChild>
              <Link href="/admin/settings/integrations?service=quickbooks">Connect QuickBooks</Link>
            </Button>
          </div>
        </Card>
      )}

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
