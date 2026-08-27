import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { SqlConsole } from '@/components/admin/developer/SqlConsole'
import { createMetadata } from '@/lib/metadata'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = createMetadata({
  title: 'Database Console - Developer Console',
  description: 'Run guarded SQL statements against the platform database.',
  pathname: '/admin/developer/database',
})

export default async function DeveloperDatabasePage() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'developer:database'))) {
    redirect('/admin')
  }

  return <SqlConsole />
}
