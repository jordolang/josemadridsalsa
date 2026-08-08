import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { createMetadata } from '@/lib/metadata'
import { getSystemPage } from '@/lib/cms/system-pages'
import { parseBlockData, serializableBlocks, getBlockDefinition } from '@/lib/cms/blocks'
import { PageEditor } from '@/components/admin/cms/page-editor'
import type { EditorSection } from '@/components/admin/cms/page-editor'

export const metadata: Metadata = createMetadata({
  title: 'Edit page - Jose Madrid Salsa Admin',
  description: 'Edit page content.',
  pathname: '/admin/content/pages',
})

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

export default async function EditPage({ params }: Props) {
  await requirePermission('content:read')
  const { slug } = await params

  const definition = getSystemPage(slug)

  // System pages exist in the registry before anyone edits them; create the
  // row lazily on first open rather than shipping a seed script that would
  // duplicate the storefront's copy and then drift from it.
  let page = await prisma.page.findUnique({
    where: { slug },
    include: { sections: { orderBy: { sortOrder: 'asc' } } },
  })

  if (!page && definition) {
    page = await prisma.page.create({
      data: {
        slug,
        title: definition.title,
        kind: 'SYSTEM',
        status: 'DRAFT',
      },
      include: { sections: { orderBy: { sortOrder: 'asc' } } },
    })
  }

  if (!page) notFound()

  const savedByType = new Map(page.sections.map((section) => [section.type, section]))

  let sections: EditorSection[]

  if (definition) {
    // The registry is the source of truth for which sections a system page
    // has; saved rows only supply their content, visibility and order.
    sections = definition.sections
      .map((sectionDef) => {
        const saved = savedByType.get(sectionDef.key)
        const block = getBlockDefinition(sectionDef.block)
        return {
          key: sectionDef.key,
          block: sectionDef.block,
          label: sectionDef.label,
          description: sectionDef.description,
          required: sectionDef.required,
          isVisible: saved?.isVisible ?? true,
          data: saved
            ? parseBlockData(sectionDef.block, saved.data)
            : { ...(block?.defaults ?? {}), ...(sectionDef.defaults ?? {}) },
          sortOrder: saved?.sortOrder ?? Number.MAX_SAFE_INTEGER,
        }
      })
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(({ sortOrder: _sortOrder, ...section }) => section)
  } else {
    sections = page.sections.map((section) => {
      const block = getBlockDefinition(section.type)
      return {
        key: section.id,
        block: section.type,
        label: block?.label ?? section.type,
        description: block?.description,
        isVisible: section.isVisible,
        data: parseBlockData(section.type, section.data),
      }
    })
  }

  return (
    <PageEditor
      page={{
        id: page.id,
        slug: page.slug,
        title: page.title,
        kind: page.kind,
        status: page.status,
        route: definition?.route ?? `/${page.slug}`,
        seoTitle: page.seoTitle ?? '',
        seoDescription: page.seoDescription ?? '',
        ogImage: page.ogImage ?? '',
        canonicalUrl: page.canonicalUrl ?? '',
        noIndex: page.noIndex,
      }}
      sections={sections}
      blocks={serializableBlocks()}
    />
  )
}
