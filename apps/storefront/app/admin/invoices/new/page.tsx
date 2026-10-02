import Link from 'next/link'
import { redirect } from 'next/navigation'

import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { createInvoiceAction } from './actions'
import { InvoiceForm } from './invoice-form'

export const metadata = { title: 'New invoice | Jose Madrid Salsa Admin' }

export default async function NewInvoicePage() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'financials:write'))) {
    redirect('/admin/invoices')
  }

  // Same source and cap as the desktop shell's customer picker.
  const customers = await prisma.customer.findMany({
    orderBy: [{ lastOrderAt: 'desc' }, { email: 'asc' }],
    take: 500,
    select: { id: true, email: true, firstName: true, lastName: true },
  })

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/invoices" className="text-sm text-muted-foreground hover:underline">
          ← Invoices
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">New invoice</h1>
        <p className="text-sm text-muted-foreground">
          The total is calculated from the lines when you save.
        </p>
      </div>

      <InvoiceForm
        action={createInvoiceAction}
        customers={customers.map((c) => ({
          id: c.id,
          label: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email,
          email: c.email,
        }))}
      />
    </div>
  )
}
