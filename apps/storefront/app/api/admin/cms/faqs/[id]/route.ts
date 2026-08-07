import prisma from '@/lib/prisma'
import { createItemHandlers } from '@/lib/cms/admin-crud'
import { faqItemSchema } from '@/lib/cms/schemas'

const handlers = createItemHandlers({
  delegate: prisma.faqItem,
  entityType: 'cms.faq',
  createSchema: faqItemSchema,
  orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  include: { category: true },
  collectionKey: 'faqs',
  itemKey: 'faq',
})

export const GET = handlers.GET
export const PATCH = handlers.PATCH
export const DELETE = handlers.DELETE
