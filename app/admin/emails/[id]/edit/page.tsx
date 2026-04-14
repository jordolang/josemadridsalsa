import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasAnyPermission } from '@/lib/rbac'
import { TemplateEditor } from './_components/template-editor'

async function getTemplate(id: string) {
  const template = await prisma.emailTemplate.findUnique({
    where: { id },
  })

  return template
}

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()

  if (!user || !(await hasAnyPermission(user, ['content:write']))) {
    redirect('/admin')
  }

  const template = await getTemplate(id)

  if (!template) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Edit Email Template</h1>
        <p className="text-muted-foreground mt-1">
          Customize the template content and preview changes
        </p>
      </div>

      <TemplateEditor template={template} />
    </div>
  )
}
