import prisma from '@/lib/prisma'
import { createCollectionHandlers } from '@/lib/cms/admin-crud'
import { reusableSectionSchema } from '@/lib/cms/schemas'

const handlers = createCollectionHandlers({
  delegate: prisma.reusableSection,
  entityType: 'cms.reusableSection',
  createSchema: reusableSectionSchema,
  orderBy: [{ name: 'asc' }],
  collectionKey: 'sections',
  itemKey: 'section',
})

export const GET = handlers.GET
export const POST = handlers.POST
