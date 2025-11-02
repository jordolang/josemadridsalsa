'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import type { BusinessFormSection } from '@/types/forms'
import type { FormTemplateStatus } from '@prisma/client'

const fieldSchema = z.object({
  id: z.string().min(1, 'Field id is required'),
  label: z.string().min(1, 'Field label is required'),
  type: z.enum(['short-text', 'long-text', 'checkbox', 'table', 'signature', 'date', 'number']),
  placeholder: z.string().optional(),
  helperText: z.string().optional(),
  columns: z.array(z.string().min(1)).optional(),
  defaultRows: z.number().int().min(0).optional(),
})

const sectionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  defaultIncluded: z.boolean().optional(),
  fields: z.array(fieldSchema).min(1, 'Add at least one field to each section'),
})

const templatePayloadSchema = z.object({
  id: z.string().optional(),
  slug: z.string().min(1).optional(),
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  categoryId: z.string().min(1, 'Template category is required'),
  tags: z.array(z.string().min(1)).default([]),
  estimatedCompletion: z.string().optional(),
  recommendedUses: z.array(z.string().min(1)).default([]),
  sections: z.array(sectionSchema).min(1, 'Include at least one section'),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
})

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

async function ensureUniqueSlug(baseSlug: string, existingId?: string | null) {
  let slug = baseSlug || 'form-template'
  let attempt = 1

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const match = await prisma.formTemplate.findFirst({
      where: existingId
        ? { slug, NOT: { id: existingId } }
        : { slug },
      select: { id: true },
    })

    if (!match) {
      return slug
    }

    attempt += 1
    slug = `${baseSlug}-${attempt}`
  }
}

export async function createFormTemplate(rawPayload: unknown) {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'content:write'))) {
    throw new Error('You do not have permission to create form templates.')
  }

  const payload = templatePayloadSchema.parse(rawPayload)
  const baseSlug = payload.slug ? slugify(payload.slug) : slugify(payload.name)
  const slug = await ensureUniqueSlug(baseSlug)

  const structure = JSON.parse(
    JSON.stringify({
      sections: payload.sections,
    }),
  ) as { sections: BusinessFormSection[] }

  const created = await prisma.$transaction(async (tx) => {
    const template = await tx.formTemplate.create({
      data: {
        slug,
        name: payload.name,
        description: payload.description,
        category: payload.categoryId,
        tags: payload.tags,
        estimatedCompletion: payload.estimatedCompletion,
        recommendedUses: payload.recommendedUses,
        status: payload.status as FormTemplateStatus,
        structure,
        createdById: user.id,
        updatedById: user.id,
      },
    })

    await tx.formTemplateVersion.create({
      data: {
        templateId: template.id,
        version: template.version,
        structure,
        createdById: user.id,
      },
    })

    return template
  })

  revalidatePath('/admin/forms')
  revalidatePath(`/forms/${created.slug}`)

  return created
}

export async function updateFormTemplate(id: string, rawPayload: unknown) {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'content:write'))) {
    throw new Error('You do not have permission to update form templates.')
  }

  const payload = templatePayloadSchema.parse(rawPayload)

  const existing = await prisma.formTemplate.findUnique({
    where: { id },
    select: { id: true, version: true, slug: true },
  })

  if (!existing) {
    throw new Error('Form template not found.')
  }

  const baseSlug = payload.slug ? slugify(payload.slug) : slugify(payload.name)
  const slug = await ensureUniqueSlug(baseSlug, existing.id)
  const nextVersion = existing.version + 1

  const structure = JSON.parse(
    JSON.stringify({
      sections: payload.sections,
    }),
  ) as { sections: BusinessFormSection[] }

  const updated = await prisma.$transaction(async (tx) => {
    const template = await tx.formTemplate.update({
      where: { id },
      data: {
        slug,
        name: payload.name,
        description: payload.description,
        category: payload.categoryId,
        tags: payload.tags,
        estimatedCompletion: payload.estimatedCompletion,
        recommendedUses: payload.recommendedUses,
        status: payload.status as FormTemplateStatus,
        version: nextVersion,
        structure,
        updatedById: user.id,
        ...(payload.status === 'PUBLISHED' && { publishedAt: new Date() }),
      },
    })

    await tx.formTemplateVersion.create({
      data: {
        templateId: template.id,
        version: nextVersion,
        structure,
        createdById: user.id,
      },
    })

    return template
  })

  revalidatePath('/admin/forms')
  revalidatePath(`/forms/${updated.slug}`)

  return updated
}
