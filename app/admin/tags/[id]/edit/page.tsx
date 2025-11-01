import { redirect, notFound } from 'next/navigation'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import TagForm from '@/components/admin/TagForm'
import prisma from '@/lib/prisma'

export const metadata = {
  title: 'Edit Tag | Admin',
  description: 'Edit tag details',
}

async function getTag(tagId: string) {
  const tag = await prisma.tag.findUnique({
    where: { id: tagId },
  })

  if (!tag) {
    notFound()
  }

  return tag
}

export default async function EditTagPage({
  params,
}: {
  params: { id: string }
}) {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'content:write'))) {
    redirect('/admin/tags')
  }

  const tag = await getTag(params.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Edit Tag</h1>
        <p className="text-slate-600">Update tag details</p>
      </div>

      <TagForm tag={tag} />
    </div>
  )
}
