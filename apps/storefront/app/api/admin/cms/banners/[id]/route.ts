import prisma from '@/lib/prisma'
import { createItemHandlers } from '@/lib/cms/admin-crud'
import { bannerSchema } from '@/lib/cms/schemas'

const handlers = createItemHandlers({
  delegate: prisma.banner,
  entityType: 'cms.banner',
  createSchema: bannerSchema,
  orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
  collectionKey: 'banners',
  itemKey: 'banner',
})

export const GET = handlers.GET
export const PATCH = handlers.PATCH
export const DELETE = handlers.DELETE
