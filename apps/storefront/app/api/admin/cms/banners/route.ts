import prisma from '@/lib/prisma'
import { createCollectionHandlers } from '@/lib/cms/admin-crud'
import { bannerSchema } from '@/lib/cms/schemas'

const handlers = createCollectionHandlers({
  delegate: prisma.banner,
  entityType: 'cms.banner',
  createSchema: bannerSchema,
  orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
  collectionKey: 'banners',
  itemKey: 'banner',
})

export const GET = handlers.GET
export const POST = handlers.POST
