import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasAnyPermission, hasPermission } from '@/lib/rbac'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { logAudit } from '@/lib/audit'

type PageProps = {
  params: Promise<{ id: string }>
}

async function updateTemplate(templateId: string, formData: FormData) {
  'use server'

  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'content:write'))) {
    throw new Error('Unauthorized')
  }

  const name = formData.get('name')
  const subject = formData.get('subject')
  const html = formData.get('html')
  const text = formData.get('text')

  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('Template name is required')
  }

  if (typeof subject !== 'string' || subject.trim().length === 0) {
    throw new Error('Subject is required')
  }

  if (typeof html !== 'string' || html.trim().length === 0) {
    throw new Error('HTML content is required')
  }

  await prisma.emailTemplate.update({
    where: { id: templateId },
    data: {
      name: name.trim(),
      subject: subject.trim(),
      html: html,
      text: typeof text === 'string' && text.trim().length > 0 ? text : null,
    },
  })

  await logAudit({
    userId: user.id,
    action: 'email_template.update',
    entityType: 'EmailTemplate',
    entityId: templateId,
  })

  revalidatePath(`/admin/emails/${templateId}`)
  revalidatePath('/admin/emails')
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
          <p className="text-slate-600">
            Update the copy and layout for this automated email.
          </p>
        </div>
        <div className="rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-600">
          Template key: <span className="font-mono text-slate-800">{template.key}</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-6">
          <form action={updateAction} className="space-y-5">
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="name">
                Template name
              </label>
              <Input
                id="name"
                name="name"
                defaultValue={template.name}
                disabled={!canEdit}
                className="mt-2"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="subject">
                Email subject
              </label>
              <Input
                id="subject"
                name="subject"
                defaultValue={template.subject}
                disabled={!canEdit}
                className="mt-2"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700" htmlFor="html">
                  HTML content
                </label>
                <span className="text-xs text-slate-500">
                  Supports Handlebars-style variables: <code>{'{{variable}}'}</code>
                </span>
              </div>
              <Textarea
                id="html"
                name="html"
                defaultValue={template.html}
                disabled={!canEdit}
                className="mt-2 h-64 font-mono text-xs"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="text">
                Plain text fallback
              </label>
              <Textarea
                id="text"
                name="text"
                defaultValue={template.text || ''}
                disabled={!canEdit}
                className="mt-2 h-40 font-mono text-xs"
              />
            </div>

            {canEdit ? (
              <div className="flex items-center justify-end">
                <Button type="submit">Save changes</Button>
              </div>
            ) : (
              <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-700">
                You have read-only access to this template.
              </p>
            )}
          </form>
        </Card>

        <Card className="space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold">Template Details</h2>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <p>
                <span className="font-medium text-slate-700">Template key:</span>{' '}
                <span className="font-mono">{template.key}</span>
              </p>
              <p>
                <span className="font-medium text-slate-700">Created:</span>{' '}
                {template.createdAt.toLocaleString()}
              </p>
              <p>
                <span className="font-medium text-slate-700">Last updated:</span>{' '}
                {template.updatedAt.toLocaleString()}
              </p>
              <p>
                <span className="font-medium text-slate-700">Plain text version:</span>{' '}
                {template.text ? 'Yes' : 'No'}
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold">HTML Preview</h2>
            <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
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
