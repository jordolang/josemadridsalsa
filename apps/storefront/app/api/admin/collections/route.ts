import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail, failFromError } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'
import { collectionProductRows } from '@/lib/collections'

const collectionSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullable().optional(),
  image: z.string().url().nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  metaTitle: z.string().nullable().optional(),
  metaDescription: z.string().nullable().optional(),
  ogImage: z.string().url().nullable().optional(),
  /** Ordered product ids that make up the collection. Order becomes each row's sortOrder. */
  productIds: z.array(z.string()).optional(),
})

export async function GET(req: NextRequest) {
  try {
    await requirePermission('products:read')

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const isActive = searchParams.get('isActive')

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (isActive === 'true') where.isActive = true
    if (isActive === 'false') where.isActive = false

    const rawPage = Number(searchParams.get('page'))
    const rawLimit = Number(searchParams.get('limit'))
    const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1
    const pageSize =
      Number.isSafeInteger(rawLimit) && rawLimit > 0 ? Math.min(100, rawLimit) : 100
    const skip = (page - 1) * pageSize

    const [collections, total] = await Promise.all([
      prisma.collection.findMany({
        where,
        // sortOrder first, then id as a stable tie-breaker so paging is deterministic when
        // several collections share the default sortOrder.
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        skip,
        take: pageSize,
        include: { _count: { select: { products: true } } },
      }),
      prisma.collection.count({ where }),
    ])

    return ok({ collections, total, page, pageSize })
  } catch (error) {
    return failFromError(error, 'Failed to load collections')
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission('products:write')
    const body = await req.json()
    const { productIds, ...data } = collectionSchema.parse(body)

    const collection = await prisma.collection.create({
      data: {
        ...data,
        products: productIds
          ? { create: collectionProductRows(productIds) }
          : undefined,
      },
    })

    await logAudit({
      userId: user.id,
      action: 'CREATE',
      entityType: 'Collection',
      entityId: collection.id,
      changes: { ...data, productIds },
    })

    return ok({ collection }, 201)
  } catch (error: any) {
    if (error instanceof SyntaxError) return fail('Invalid JSON body', 400)
    if (error?.name === 'ZodError') return fail('Invalid collection data', 400, error.issues)
    if (error.code === 'P2002') {
      return fail('Collection with this name or slug already exists', 409)
    }
    if (error.code === 'P2003' || error.code === 'P2025') {
      return fail('One or more selected products could not be found', 400)
    }
    return failFromError(error, 'Failed to create collection')
  }
}
