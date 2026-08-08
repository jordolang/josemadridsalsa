import prisma from '@/lib/prisma'
import { createCollectionHandlers } from '@/lib/cms/admin-crud'
import { announcementSchema } from '@/lib/cms/schemas'

const handlers = createCollectionHandlers({
  delegate: prisma.announcement,
  entityType: 'cms.announcement',
  createSchema: announcementSchema,
  orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
  collectionKey: 'announcements',
  itemKey: 'announcement',
})

export const GET = handlers.GET
export const POST = handlers.POST
