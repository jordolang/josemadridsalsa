import type { DocumentationEntry, DocumentationVisibility } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { docSource, docSlugFromParams, type DocPage, type DocVisibility } from './source'

export interface DocRegistryItem {
  slug: string
  title: string
  description?: string
  category?: string
  tags: string[]
  sourcePath: string
  filePath: string
  visibility: DocVisibility
  isPublished: boolean
  dbEntry?: DocumentationEntry
  page: NonNullable<DocPage>
}

export type DocSyncResult = {
  total: number
  created: number
  updated: number
}

export function docSegmentsFromSlug(slug: string) {
  if (!slug || slug === 'index') {
    return []
  }

  return slug.split('/').filter(Boolean)
}

function toFrontendVisibility(value?: DocVisibility | DocumentationVisibility | null): DocVisibility {
  if (!value) return 'public'
  if (typeof value === 'string' && value.toUpperCase() === 'DEVELOPER') {
    return 'developer'
  }
  return value === 'developer' ? 'developer' : 'public'
}

function toDatabaseVisibility(value: DocVisibility): DocumentationVisibility {
  return value === 'developer' ? 'DEVELOPER' : 'PUBLIC'
}

export async function getDocRecord(slug: string) {
  return prisma.documentationEntry.findUnique({
    where: { slug },
  })
}

export async function getDocRegistry(): Promise<DocRegistryItem[]> {
  const pages = docSource.getPages()
  const slugs = pages.map((page) => docSlugFromParams(page.slugs))
  const existingEntries = await prisma.documentationEntry.findMany({
    where: { slug: { in: slugs } },
  })
  const entryMap = new Map(existingEntries.map((entry) => [entry.slug, entry]))

  return pages.map((page) => {
    const slug = docSlugFromParams(page.slugs)
    const entry = entryMap.get(slug)
    const data: any = page.data

    const visibility = entry ? toFrontendVisibility(entry.visibility) : toFrontendVisibility(data.visibility)
    const tags = Array.isArray(entry?.tags) && entry?.tags.length ? entry.tags : Array.isArray(data.tags) ? data.tags : []

    return {
      slug,
      title: (entry?.title ?? data.title ?? 'Untitled').trim(),
      description: entry?.description ?? data.description,
      category: entry?.category ?? data.category,
      tags,
      sourcePath: page.path ?? slug,
      filePath: data.filePath ?? page.path ?? slug,
      visibility,
      isPublished: entry?.isPublished ?? true,
      dbEntry: entry,
      page: page as NonNullable<DocPage>,
    }
  })
}

export async function syncDocumentationEntries(): Promise<DocSyncResult> {
  const pages = docSource.getPages()
  const existing = await prisma.documentationEntry.findMany({ select: { slug: true } })
  const existingSet = new Set(existing.map((entry) => entry.slug))

  let created = 0
  let updated = 0

  await Promise.all(
    pages.map((page) => {
      const slug = docSlugFromParams(page.slugs)
      const data: any = page.data
      const payload = {
        title: (data.title ?? 'Untitled').trim(),
        description: data.description ?? null,
        category: data.category ?? null,
        tags: Array.isArray(data.tags) ? data.tags : [],
        visibility: toDatabaseVisibility(data.visibility ?? 'public'),
        sourcePath: page.path ?? slug,
        filePath: data.filePath ?? page.path ?? slug,
        lastSyncedAt: new Date(),
      }

      if (existingSet.has(slug)) {
        updated += 1
      } else {
        created += 1
      }

      return prisma.documentationEntry.upsert({
        where: { slug },
        create: {
          slug,
          isPublished: true,
          ...payload,
        },
        update: payload,
      })
    })
  )

  return {
    total: pages.length,
    created,
    updated,
  }
}

export async function updateDocEntry(
  slug: string,
  payload: Partial<{
    title: string
    description: string | null
    category: string | null
    tags: string[]
    isPublished: boolean
    visibility: DocVisibility
  }>
) {
  const { visibility, ...rest } = payload

  return prisma.documentationEntry.update({
    where: { slug },
    data: {
      ...rest,
      visibility: visibility ? toDatabaseVisibility(visibility) : undefined,
    },
  })
}

export async function resolveDocAccess(slugParts: string[] | undefined, canViewPrivate: boolean) {
  const slug = docSlugFromParams(slugParts)
  const page = docSource.getPage(slugParts)

  if (!page) {
    console.log('[resolveDocAccess] Page not found for slug:', slug, 'slugParts:', slugParts)
    return null
  }

  const entry = await getDocRecord(slug)
  const visibility = entry ? toFrontendVisibility(entry.visibility) : toFrontendVisibility((page.data as any).visibility)
  const isPublished = entry?.isPublished ?? true

  console.log('[resolveDocAccess]', { slug, hasEntry: !!entry, visibility, isPublished, canViewPrivate })

  if ((!isPublished || visibility === 'developer') && !canViewPrivate) {
    console.log('[resolveDocAccess] Access denied - isPublished:', isPublished, 'visibility:', visibility)
    return null
  }

  return {
    slug,
    page,
    entry,
    visibility,
    isPublished,
  }
}
