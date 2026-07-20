'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import type { EmailTemplateCategory } from '@prisma/client'

function slugifyKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

const CATEGORIES = ['TRANSACTIONAL', 'MARKETING', 'ADMINISTRATIVE'] as const

export interface CreateFromUploadInput {
  name: string
  key: string
  subject: string
  category: string
  html: string
  text?: string
}

export type CreateFromUploadResult =
  | { ok: true; templateId: string }
  | { ok: false; error: string }

/**
 * Create an EmailTemplate from an uploaded/edited HTML document.
 * Mirrors the createTemplate action in app/admin/emails/new/page.tsx so uploaded
 * templates are indistinguishable from hand-authored ones (editable, mass-sendable).
 */
export async function createTemplateFromUpload(
  input: CreateFromUploadInput,
): Promise<CreateFromUploadResult> {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'content:write'))) {
    return { ok: false, error: 'You do not have permission to create templates.' }
  }

  const name = input.name?.trim()
  const subject = input.subject?.trim()
  const html = input.html
  const text = input.text?.trim()

  if (!name) return { ok: false, error: 'Template name is required.' }
  if (!subject) return { ok: false, error: 'Email subject is required.' }
  if (!html || html.trim().length === 0) {
    return { ok: false, error: 'HTML content is required — upload a file or paste markup.' }
  }

  const key = slugifyKey(input.key?.trim() || name)
  if (!key) return { ok: false, error: 'Could not derive a valid template key from the name.' }

  const category: EmailTemplateCategory = (CATEGORIES as readonly string[]).includes(input.category)
    ? (input.category as EmailTemplateCategory)
    : 'MARKETING'

  const existing = await prisma.emailTemplate.findUnique({ where: { key } })
  if (existing) {
    return { ok: false, error: `A template with the key "${key}" already exists. Choose a different name or key.` }
  }

  const template = await prisma.emailTemplate.create({
    data: {
      name,
      key,
      subject,
      html,
      text: text && text.length > 0 ? text : null,
      category,
    },
  })

  await logAudit({
    userId: user.id,
    action: 'email_template.create',
    entityType: 'EmailTemplate',
    entityId: template.id,
  })

  revalidatePath('/admin/emails')

  return { ok: true, templateId: template.id }
}
