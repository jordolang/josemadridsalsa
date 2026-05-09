import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasAnyPermission, hasPermission } from '@/lib/rbac'
import { Card } from '@/components/ui/card'
import { logAudit } from '@/lib/audit'
import {
  TemplateEditForm,
  type TemplateEditState,
} from './_components/template-edit-form'

type PageProps = {
  params: Promise<{ id: string }>
}

async function updateTemplate(
  templateId: string,
  _prevState: TemplateEditState,
  formData: FormData,
): Promise<TemplateEditState> {
  'use server'

  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'content:write'))) {
    return { status: 'error', message: 'You do not have permission to edit this template.' }
  }

  const name = formData.get('name')
  const subject = formData.get('subject')
  const html = formData.get('html')
  const text = formData.get('text')

  if (typeof name !== 'string' || name.trim().length === 0) {
    return { status: 'error', message: 'Template name is required.' }
  }

  if (typeof subject !== 'string' || subject.trim().length === 0) {
    return { status: 'error', message: 'Subject is required.' }
  }

  if (typeof html !== 'string' || html.trim().length === 0) {
    return { status: 'error', message: 'HTML content is required.' }
  }

  try {
    await prisma.emailTemplate.update({
      where: { id: templateId },
      data: {
        name: name.trim(),
        subject: subject.trim(),
        html: html,
        text: typeof text === 'string' && text.trim().length > 0 ? text : null,
      },
    })
  } catch (error) {
    console.error('[email-template/update] Failed to update template:', error)
    return { status: 'error', message: 'Failed to save template. Please try again.' }
  }

  await logAudit({
    userId: user.id,
    action: 'email_template.update',
    entityType: 'EmailTemplate',
    entityId: templateId,
  })

  revalidatePath(`/admin/emails/${templateId}`)
  revalidatePath('/admin/emails')

  return { status: 'success', message: 'Template saved.' }
}

export default async function EmailTemplateDetailPage(props: PageProps) {
  const params = await props.params
  const templateId = params.id

  const user = await getCurrentUser()
  if (!user || !(await hasAnyPermission(user, ['content:read', 'content:write']))) {
    redirect('/admin')
  }

  const template = await prisma.emailTemplate.findUnique({
    where: { id: templateId },
  })

  if (!template) {
    notFound()
  }

  const canEdit = await hasPermission(user, 'content:write')
  const updateAction = updateTemplate.bind(null, templateId)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{template.name}</h1>
          <p className="text-muted-foreground">
            Update the copy and layout for this automated email.
          </p>
        </div>
        <div className="rounded-lg bg-muted px-4 py-2 text-sm text-muted-foreground">
          Template key: <span className="font-mono text-foreground">{template.key}</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-6">
          <TemplateEditForm
            action={updateAction}
            template={{
              name: template.name,
              subject: template.subject,
              html: template.html,
              text: template.text,
            }}
            canEdit={canEdit}
          />
        </Card>

        <Card className="space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold">Template Details</h2>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Template key:</span>{' '}
                <span className="font-mono">{template.key}</span>
              </p>
              <p>
                <span className="font-medium text-foreground">Created:</span>{' '}
                {template.createdAt.toLocaleString()}
              </p>
              <p>
                <span className="font-medium text-foreground">Last updated:</span>{' '}
                {template.updatedAt.toLocaleString()}
              </p>
              <p>
                <span className="font-medium text-foreground">Plain text version:</span>{' '}
                {template.text ? 'Yes' : 'No'}
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold">HTML Preview</h2>
            <div className="mt-3 overflow-hidden rounded-lg border border-border bg-card">
              <div
                className="prose max-w-none p-4"
                dangerouslySetInnerHTML={{ __html: template.html }}
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
