import prisma from '@/lib/prisma'
import { createItemHandlers } from '@/lib/cms/admin-crud'
import { redirectSchema } from '@/lib/cms/schemas'

const handlers = createItemHandlers({
  delegate: prisma.redirect,
  entityType: 'cms.redirect',
  createSchema: redirectSchema,
  orderBy: [{ createdAt: 'desc' }],
  collectionKey: 'redirects',
  itemKey: 'redirect',
})

export const GET = handlers.GET
export const PATCH = handlers.PATCH
export const DELETE = handlers.DELETE
