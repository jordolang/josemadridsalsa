import prisma from '@/lib/prisma'
import { createCollectionHandlers } from '@/lib/cms/admin-crud'
import { faqCategorySchema } from '@/lib/cms/schemas'

const handlers = createCollectionHandlers({
  delegate: prisma.faqCategory,
  entityType: 'cms.faqCategory',
  createSchema: faqCategorySchema,
  orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  include: { _count: { select: { items: true } } },
  collectionKey: 'categories',
  itemKey: 'category',
})

export const GET = handlers.GET
export const POST = handlers.POST
