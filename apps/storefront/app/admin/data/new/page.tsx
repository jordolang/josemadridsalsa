import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { ReportBuilder } from '../_components/ReportBuilder'
import { datasetsFor } from '@/lib/data-studio/registry'
import { getCurrentUser, getUserPermissions, hasPermission } from '@/lib/rbac'

export const metadata: Metadata = {
  title: 'New report · Data & Charts',
}

export default async function NewReportPage({
  searchParams,
}: {
  searchParams: Promise<{ dataset?: string }>
}) {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'data:read'))) {
    redirect('/admin')
  }

  const params = await searchParams
  const permissions = await getUserPermissions(user)
  const available = datasetsFor(permissions)

  // A dataset named in the URL is honoured only if it is one this person may read, so a hand-edited
  // query string cannot widen access.
  const requested = available.some((dataset) => dataset.id === params.dataset)
    ? params.dataset
    : undefined

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">New report</h1>
        <p className="text-muted-foreground">
          Choose what to measure and how to group it. Nothing is saved until you say so.
        </p>
      </div>
      <ReportBuilder datasets={available} initialDatasetId={requested} />
    </div>
  )
}
