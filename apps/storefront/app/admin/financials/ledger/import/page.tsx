import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { createMetadata } from '@/lib/metadata'
import { Button } from '@/components/ui/button'

import StatementImportClient from '../../_components/StatementImportClient'

export const metadata: Metadata = createMetadata({
  title: 'Import a Statement - Jose Madrid Salsa Admin',
  description: 'Read a bank or card statement into the bookkeeping ledger.',
  pathname: '/admin/financials/ledger/import',
})

export const dynamic = 'force-dynamic'

export default async function LedgerImportPage() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'financials:write'))) {
    redirect('/admin')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/financials/ledger">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Import a statement</h1>
          <p className="text-muted-foreground">
            Read a bank or card statement into the ledger — the expenses it holds that nothing else
            records.
          </p>
        </div>
      </div>

      <StatementImportClient />
    </div>
  )
}
