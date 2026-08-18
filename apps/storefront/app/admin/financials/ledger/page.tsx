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

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>
}) {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'financials:read'))) {
    redirect('/admin')
  }

  // The ledger loads its newest page first, so admin search hands the matched entry's text
  // over in `?q=` — without it a link to an older row lands on a list that does not show it.
  const raw = (await searchParams).q
  const initialQuery = (Array.isArray(raw) ? raw[raw.length - 1] : raw)?.trim() ?? ''

  const canWrite = await hasPermission(user, 'financials:write')
  return <LedgerClient canWrite={canWrite} initialQuery={initialQuery} />
}
