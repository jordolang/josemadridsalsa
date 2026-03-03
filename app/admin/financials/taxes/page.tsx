import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { taxPreparationTasks } from '@/lib/financials/config'
import { createMetadata } from '@/lib/metadata'

export const metadata: Metadata = createMetadata({
  title: 'Taxes - Jose Madrid Salsa Admin',
  description: 'Track tax filings, due dates, and compliance notes.',
  pathname: '/admin/financials/taxes',
})

export default async function TaxesPage() {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'financials:read'))) {
    redirect('/admin')
  }

  const openTasks = taxPreparationTasks.filter((task) => task.status !== 'completed')

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-salsa-500">Tax prep</p>
          <h1 className="text-3xl font-serif font-semibold text-slate-900">Tax compliance hub</h1>
          <p className="text-sm text-slate-600">
            Organize federal, state, and local filings with owners, due dates, and supporting notes.
          </p>
        </div>
        <Button variant="default" asChild>
          <a href="mailto:finance@josemadridsalsa.com?subject=Tax%20CPA%20Review">Request CPA review</a>
        </Button>
      </header>

      <Card className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Upcoming tasks</h2>
            <p className="text-sm text-slate-600">Assign owners, record confirmations, and mark filings complete.</p>
          </div>
          <Badge className="bg-slate-100 text-slate-600">{openTasks.length} open</Badge>
        </div>
        <div className="space-y-3">
          {taxPreparationTasks.map((task) => (
            <div key={task.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{task.label}</p>
                  <p className="text-xs text-slate-500">
                    Due {new Date(task.dueDate).toLocaleDateString()} • Owner {task.owner}
                  </p>
                </div>
                <Badge
                  className={`text-xs ${
                    task.status === 'completed'
                      ? 'bg-emerald-100 text-emerald-700'
                      : task.status === 'overdue'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {task.status}
                </Badge>
              </div>
              {task.notes ? <p className="mt-2 text-xs text-slate-600">{task.notes}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="h-8 px-3 text-xs">
                  Mark complete
                </Button>
                <Button size="sm" variant="outline" className="h-8 px-3 text-xs">
                  Assign owner
                </Button>
                <Button size="sm" variant="outline" className="h-8 px-3 text-xs">
                  Add note
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="space-y-3 p-6">
        <h2 className="text-xl font-semibold text-slate-900">Documentation checklist</h2>
        <ul className="space-y-2 text-sm text-slate-600">
          <li>• Sales tax summaries from Shopify, wholesale invoices, and in-person events</li>
          <li>• Payroll tax exports (ADP, QuickBooks) including Form 941 & W-2 confirmations</li>
          <li>• Ohio CAT filings, federal EIN documentation, and accountant contact details</li>
        </ul>
      </Card>
    </div>
  )
}
