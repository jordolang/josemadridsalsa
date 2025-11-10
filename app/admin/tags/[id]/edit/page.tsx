import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import TagForm from '@/components/admin/TagForm'
import prisma from '@/lib/prisma'
import { createMetadata } from '@/lib/metadata'

export const metadata: Metadata = createMetadata({
  title: 'Edit Tag - Jose Madrid Salsa Admin',
  description: 'Edit tag details.',
  pathname: '/admin/tags',
})

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
  params: Promise<{ id: string }>
}) {
  const { id } = await params;
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'content:write'))) {
    redirect('/admin/tags')
  }

  const tag = await getTag(id)

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
