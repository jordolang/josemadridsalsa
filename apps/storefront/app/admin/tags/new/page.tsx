import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import TagForm from '@/components/admin/TagForm'
import { createMetadata } from '@/lib/metadata'

export const metadata: Metadata = createMetadata({
  title: 'Add Tag - Jose Madrid Salsa Admin',
  description: 'Create a new tag for Jose Madrid Salsa content.',
  pathname: '/admin/tags',
})

export default async function NewTagPage() {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'content:write'))) {
    redirect('/admin/tags')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Add Tag</h1>
        <p className="text-muted-foreground">Create a new tag for organizing content</p>
      </div>

      <TagForm />
    </div>
  )
}
