import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { createMetadata } from '@/lib/metadata'
import LedgerClient from '../_components/LedgerClient'

export const metadata: Metadata = createMetadata({
  title: 'Bookkeeping Ledger - Jose Madrid Salsa Admin',
  description: 'Every dollar in and out, in one place — editable and exportable.',
  pathname: '/admin/financials/ledger',
})

export default async function LedgerPage() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'financials:read'))) {
    redirect('/admin')
  }

  const canWrite = await hasPermission(user, 'financials:write')
  return <LedgerClient canWrite={canWrite} />
}
