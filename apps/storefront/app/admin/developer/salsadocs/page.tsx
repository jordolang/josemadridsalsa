import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { SalsadocsManager } from '@/components/admin/developer/SalsadocsManager'
import { createMetadata } from '@/lib/metadata'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = createMetadata({
  title: 'Salsadocs - Developer Console',
  description: 'Manage Salsadocs documentation from the admin panel.',
  pathname: '/admin/developer/salsadocs',
})

export default async function DeveloperSalsadocsPage() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'developer:salsadocs'))) {
    redirect('/admin')
  }

  return <SalsadocsManager />
}
