import { redirect } from 'next/navigation'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import TagForm from '@/components/admin/TagForm'

export const metadata = {
  title: 'Add Tag | Admin',
  description: 'Create a new tag',
}

export default async function NewTagPage() {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'content:write'))) {
    redirect('/admin/tags')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Add Tag</h1>
        <p className="text-slate-600">Create a new tag for organizing content</p>
      </div>

      <TagForm />
    </div>
  )
}
