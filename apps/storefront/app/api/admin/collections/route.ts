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
    await requirePermission('content:read')

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

    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 100))
    const skip = (page - 1) * pageSize

    const [collections, total] = await Promise.all([
      prisma.collection.findMany({
        where,
        orderBy: { sortOrder: 'asc' },
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
    const user = await requirePermission('content:write')
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
