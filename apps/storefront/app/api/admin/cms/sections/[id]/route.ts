import prisma from '@/lib/prisma'
import { createItemHandlers } from '@/lib/cms/admin-crud'
import { reusableSectionSchema } from '@/lib/cms/schemas'

const handlers = createItemHandlers({
  delegate: prisma.reusableSection,
  entityType: 'cms.reusableSection',
  createSchema: reusableSectionSchema,
  orderBy: [{ name: 'asc' }],
  collectionKey: 'sections',
  itemKey: 'section',
})

export const GET = handlers.GET
export const PATCH = handlers.PATCH
export const DELETE = handlers.DELETE
