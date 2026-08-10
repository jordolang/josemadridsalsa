import prisma from '@/lib/prisma'
import { createCollectionHandlers } from '@/lib/cms/admin-crud'
import { faqItemSchema } from '@/lib/cms/schemas'

const handlers = createCollectionHandlers({
  delegate: prisma.faqItem,
  entityType: 'cms.faq',
  createSchema: faqItemSchema,
  orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  include: { category: true },
  collectionKey: 'faqs',
  itemKey: 'faq',
})

export const GET = handlers.GET
export const POST = handlers.POST
