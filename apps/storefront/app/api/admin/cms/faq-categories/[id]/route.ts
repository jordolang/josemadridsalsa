import prisma from '@/lib/prisma'
import { createItemHandlers } from '@/lib/cms/admin-crud'
import { faqCategorySchema } from '@/lib/cms/schemas'

const handlers = createItemHandlers({
  delegate: prisma.faqCategory,
  entityType: 'cms.faqCategory',
  createSchema: faqCategorySchema,
  orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  include: { _count: { select: { items: true } } },
  collectionKey: 'categories',
  itemKey: 'category',
})

export const GET = handlers.GET
export const PATCH = handlers.PATCH
export const DELETE = handlers.DELETE
