import prisma from '@/lib/prisma'
import { createItemHandlers } from '@/lib/cms/admin-crud'
import { announcementSchema } from '@/lib/cms/schemas'

const handlers = createItemHandlers({
  delegate: prisma.announcement,
  entityType: 'cms.announcement',
  createSchema: announcementSchema,
  orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
  collectionKey: 'announcements',
  itemKey: 'announcement',
})

export const GET = handlers.GET
export const PATCH = handlers.PATCH
export const DELETE = handlers.DELETE
