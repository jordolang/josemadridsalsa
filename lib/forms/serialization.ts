import type { FormTemplate, FormTemplateVersion } from '@prisma/client'

export type SerializedTemplate = {
  slug: string
  name: string
  description?: string | null
  categoryId: string
  status: FormTemplate['status']
  version: number
  tags: string[]
  estimatedCompletion?: string | null
  recommendedUses: string[]
  structure: unknown
  publishedAt?: string | null
  createdAt: string
  updatedAt: string
}

export type SerializedTemplateVersion = {
  version: number
  createdAt: string
  changelogNotes?: string | null
}

export const serializeTemplate = (template: FormTemplate): SerializedTemplate => ({
  slug: template.slug,
  name: template.name,
  description: template.description,
  categoryId: template.category,
  status: template.status,
  version: template.version,
  tags: template.tags,
  estimatedCompletion: template.estimatedCompletion,
  recommendedUses: template.recommendedUses,
  structure: template.structure,
  publishedAt: template.publishedAt?.toISOString() ?? null,
  createdAt: template.createdAt.toISOString(),
  updatedAt: template.updatedAt.toISOString(),
})

export const serializeTemplateVersion = (
  version: FormTemplateVersion,
): SerializedTemplateVersion => ({
  version: version.version,
  createdAt: version.createdAt.toISOString(),
  changelogNotes: version.changelogNotes,
})
