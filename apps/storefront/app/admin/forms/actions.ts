'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { slugify, ensureUniqueSlug } from '@/lib/forms/utils'
import type { BusinessFormSection } from '@/types/forms'
import type { FormTemplateStatus } from '@prisma/client'
import { templatePayloadSchema } from '@/lib/forms/schema'


const templateVersionHistoryInclude = {
  versions: {
    orderBy: { version: 'desc' as const },
    take: 10,
    select: {
      version: true,
      createdAt: true,
      createdById: true,
      changelogNotes: true,
    },
  },
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
      density: payload.density,
    }),
  ) as { sections: BusinessFormSection[]; density?: 'default' | 'compact' }

  const changelogNotes = payload.changelogNotes?.trim() || ''

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
        changelogNotes: payload.status === 'PUBLISHED' && changelogNotes ? changelogNotes : null,
      },
    })

    const templateWithHistory = await tx.formTemplate.findUnique({
      where: { id: template.id },
      include: templateVersionHistoryInclude,
    })

    return templateWithHistory ?? template
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
      density: payload.density,
    }),
  ) as { sections: BusinessFormSection[]; density?: 'default' | 'compact' }

  const changelogNotes = payload.changelogNotes?.trim() || ''

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
        changelogNotes: payload.status === 'PUBLISHED' && changelogNotes ? changelogNotes : null,
      },
    })

    const templateWithHistory = await tx.formTemplate.findUnique({
      where: { id: template.id },
      include: templateVersionHistoryInclude,
    })

    return templateWithHistory ?? template
  })

  revalidatePath('/admin/forms')
  revalidatePath(`/forms/${updated.slug}`)

  return updated
}
