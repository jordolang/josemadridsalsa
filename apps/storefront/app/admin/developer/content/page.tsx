import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { getDeveloperPageContent } from '@/lib/developer/page-content'
import { DeveloperPageContentEditor } from '@/components/admin/developer/DeveloperPageContentEditor'
import { createMetadata } from '@/lib/metadata'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = createMetadata({
  title: 'Page Content - Developer Console',
  description: 'Customize the public developer page.',
  pathname: '/admin/developer/content',
})

export default async function DeveloperContentPage() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'developer:content'))) {
    redirect('/admin')
  }

  const content = await getDeveloperPageContent()

  return <DeveloperPageContentEditor initialContent={content} />
}
