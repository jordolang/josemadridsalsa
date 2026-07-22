import { TriangleAlert } from 'lucide-react'
import { getConnection } from '@/lib/quickbooks/connection'
import { listAllExpenses, listVendors, type QuickBooksExpense } from '@/lib/quickbooks/reports'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatPrice } from '@/lib/utils'

/**
 * Expenses and payables read from QuickBooks.
 *
 * QBO is the source of truth for money going out — including receipts captured
 * with its own capture tool — so nothing here is entered or stored on our side.
 */
export default async function QuickBooksExpensesCard() {
  const connection = await getConnection()
  if (!connection) return null

  let expenses: QuickBooksExpense[] = []
  let owed = 0
  let error: string | null = null

  try {
    const [rows, vendors] = await Promise.all([listAllExpenses(25), listVendors()])
    expenses = rows
    owed = vendors.reduce((sum, vendor) => sum + vendor.balance, 0)
  } catch (err) {
    error = err instanceof Error ? err.message : 'Could not reach QuickBooks'
  }

  const unpaid = expenses.filter((e) => e.kind === 'bill' && (e.balance ?? 0) > 0)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Expenses &amp; Payables</CardTitle>
            <CardDescription>
              Live from QuickBooks{connection.companyName ? ` · ${connection.companyName}` : ''}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {unpaid.length > 0 && (
              <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                {unpaid.length} unpaid bill{unpaid.length === 1 ? '' : 's'}
              </Badge>
            )}
            {owed > 0 && <Badge variant="outline">{formatPrice(owed)} owed</Badge>}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {error ? (
          <p className="flex items-center gap-2 text-sm text-destructive">
            <TriangleAlert className="h-4 w-4" />
            {error}
          </p>
        ) : expenses.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No expenses or bills recorded in QuickBooks yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[38rem] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">Vendor</th>
                  <th className="py-2 pr-3 font-medium">Account</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={`${expense.kind}-${expense.id}`} className="border-b last:border-0">
                    <td className="py-2 pr-3 text-muted-foreground">{expense.date || '—'}</td>
                    <td className="py-2 pr-3 font-medium">{expense.vendor ?? '—'}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{expense.account ?? '—'}</td>
                    <td className="py-2 pr-3">
                      <Badge variant="outline" className="text-xs">
                        {expense.kind === 'bill' ? `Bill · ${expense.paymentType}` : 'Purchase'}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {formatPrice(expense.total)}
                      {expense.kind === 'bill' && (expense.balance ?? 0) > 0 && (
                        <span className="block text-xs text-amber-700 dark:text-amber-400">
                          {formatPrice(expense.balance ?? 0)} due
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
