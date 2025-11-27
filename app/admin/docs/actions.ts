'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requirePermission } from '@/lib/rbac'
import { syncDocumentationEntries, updateDocEntry } from '@/lib/docs/service'
import type { DocVisibility } from '@/lib/docs/source'

const updatePublishSchema = z.object({
  slug: z.string().min(1),
  isPublished: z.boolean(),
})

const updateVisibilitySchema = z.object({
  slug: z.string().min(1),
  visibility: z.enum(['public', 'developer']),
})

export async function syncDocsAction() {
  await requirePermission('content:publish')
  const summary = await syncDocumentationEntries()
  revalidatePath('/admin/docs')
  revalidatePath('/docs')
  return summary
}

export async function updateDocPublishingAction(slug: string, isPublished: boolean) {
  const payload = updatePublishSchema.parse({ slug, isPublished })
  await requirePermission('content:publish')
  await updateDocEntry(payload.slug, { isPublished: payload.isPublished })
  revalidatePath('/admin/docs')
  revalidatePath('/docs')
}

export async function updateDocVisibilityAction(slug: string, visibility: DocVisibility) {
  const payload = updateVisibilitySchema.parse({ slug, visibility })
  await requirePermission('content:publish')
  await updateDocEntry(payload.slug, { visibility: payload.visibility })
  revalidatePath('/admin/docs')
  revalidatePath('/docs')
}
