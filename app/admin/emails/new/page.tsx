import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { logAudit } from '@/lib/audit'

function slugifyKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

async function createTemplate(formData: FormData) {
  'use server'

  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'content:write'))) {
    throw new Error('Unauthorized')
  }

  const rawName = formData.get('name')
  const rawKey = formData.get('key')
  const subject = formData.get('subject')
  const html = formData.get('html')
  const text = formData.get('text')

  if (typeof rawName !== 'string' || rawName.trim().length === 0) {
    throw new Error('Template name is required')
  }

  if (typeof rawKey !== 'string' || rawKey.trim().length === 0) {
    throw new Error('Template key is required')
  }

  if (typeof subject !== 'string' || subject.trim().length === 0) {
    throw new Error('Subject is required')
  }

  if (typeof html !== 'string' || html.trim().length === 0) {
    throw new Error('HTML content is required')
  }

  const key = slugifyKey(rawKey)

  const existing = await prisma.emailTemplate.findUnique({ where: { key } })
  if (existing) {
    throw new Error('Template key already exists')
  }

  const template = await prisma.emailTemplate.create({
    data: {
      name: rawName.trim(),
      key,
      subject: subject.trim(),
      html,
      text: typeof text === 'string' && text.trim().length > 0 ? text : null,
    },
  })

  await logAudit({
    userId: user.id,
    action: 'email_template.create',
    entityType: 'EmailTemplate',
    entityId: template.id,
  })

  redirect(`/admin/emails/${template.id}`)
}

export default async function NewEmailTemplatePage() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'content:write'))) {
    redirect('/admin')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Email Template</h1>
        <p className="text-slate-600">
          Build reusable email content for order updates, marketing, and support.
        </p>
      </div>

      <Card className="p-6">
        <form action={createTemplate} className="space-y-5">
          <div>
            <label htmlFor="name" className="text-sm font-medium text-slate-700">
              Template name
            </label>
            <Input id="name" name="name" placeholder="Order confirmation" className="mt-2" required />
          </div>
          <div>
            <label htmlFor="key" className="text-sm font-medium text-slate-700">
              Template key
            </label>
            <Input
              id="key"
              name="key"
              placeholder="order_confirmation"
              className="mt-2 font-mono text-sm"
              required
            />
            <p className="mt-1 text-xs text-slate-500">
              Lowercase with underscores. Used when sending emails programmatically.
            </p>
          </div>
          <div>
            <label htmlFor="subject" className="text-sm font-medium text-slate-700">
              Email subject
            </label>
            <Input
              id="subject"
              name="subject"
              placeholder="Your Jose Madrid Salsa order is confirmed!"
              className="mt-2"
              required
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="html" className="text-sm font-medium text-slate-700">
                HTML content
              </label>
              <span className="text-xs text-slate-500">
                Example variables: <code>{'{{customerName}}'}</code>, <code>{'{{orderNumber}}'}</code>
              </span>
            </div>
            <Textarea
              id="html"
              name="html"
              placeholder="<h1>Thank you for your order!</h1>"
              className="mt-2 h-72 font-mono text-xs"
              required
            />
          </div>
          <div>
            <label htmlFor="text" className="text-sm font-medium text-slate-700">
              Plain text fallback (optional)
            </label>
            <Textarea
              id="text"
              name="text"
              placeholder="Thank you for your order!"
              className="mt-2 h-40 font-mono text-xs"
            />
          </div>
          <div className="flex items-center justify-end gap-3">
            <Button type="submit">Create template</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
