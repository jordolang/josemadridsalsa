import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { DeveloperBlogPostForm } from '@/components/admin/developer/DeveloperBlogPostForm'
import { createMetadata } from '@/lib/metadata'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = createMetadata({
  title: 'New Post - Developer Console',
  description: 'Create a developer blog post.',
  pathname: '/admin/developer/blog/new',
})

export default async function NewDeveloperBlogPostPage() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'developer:blog'))) {
    redirect('/admin')
  }

  return <DeveloperBlogPostForm />
}
