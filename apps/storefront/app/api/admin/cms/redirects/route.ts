import prisma from '@/lib/prisma'
import { createCollectionHandlers } from '@/lib/cms/admin-crud'
import { redirectSchema } from '@/lib/cms/schemas'

const handlers = createCollectionHandlers({
  delegate: prisma.redirect,
  entityType: 'cms.redirect',
  createSchema: redirectSchema,
  orderBy: [{ createdAt: 'desc' }],
  collectionKey: 'redirects',
  itemKey: 'redirect',
})

export const GET = handlers.GET
export const POST = handlers.POST
