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
  productIds: z.array(z.string()).optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('products:read')
    const { id } = await params
    const collection = await prisma.collection.findUnique({
      where: { id },
      include: {
        products: {
          orderBy: { sortOrder: 'asc' },
          include: {
            product: {
              select: { id: true, name: true, slug: true, sku: true, featuredImage: true, price: true },
            },
          },
        },
        _count: { select: { products: true } },
      },
    })
    if (!collection) return fail('Collection not found', 404)
    return ok({ collection })
  } catch (error) {
    return failFromError(error, 'Failed to load collection')
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('products:write')
    const body = await req.json()
    const { productIds, ...data } = collectionSchema.partial().parse(body)
    const { id } = await params

    const existing = await prisma.collection.findUnique({ where: { id } })
    if (!existing) return fail('Collection not found', 404)

    // When the product set is supplied, replace it wholesale so the new order sticks; the scalar
    // fields update alongside it in one transaction. When it is omitted, only the scalar fields
    // change and the membership is left untouched.
    const collection = await prisma.$transaction(async (tx) => {
      if (productIds) {
        await tx.collectionProduct.deleteMany({ where: { collectionId: id } })
      }
      return tx.collection.update({
        where: { id },
        data: {
          ...data,
          ...(productIds
            ? { products: { create: collectionProductRows(productIds) } }
            : {}),
        },
      })
    })

    await logAudit({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Collection',
      entityId: collection.id,
      changes: { ...data, productIds },
    })

    return ok({ collection })
  } catch (error: any) {
    if (error instanceof SyntaxError) return fail('Invalid JSON body', 400)
    if (error?.name === 'ZodError') return fail('Invalid collection data', 400, error.issues)
    if (error.code === 'P2002') {
      return fail('Collection with this name or slug already exists', 409)
    }
    if (error.code === 'P2003' || error.code === 'P2025') {
      return fail('One or more selected products could not be found', 400)
    }
    return failFromError(error, 'Failed to update collection')
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('products:write')
    const { id } = await params

    const existing = await prisma.collection.findUnique({ where: { id } })
    if (!existing) return fail('Collection not found', 404)

    // A collection is just a curated grouping — deleting it detaches its products (the join rows
    // cascade) and never touches the products themselves.
    await prisma.collection.delete({ where: { id } })

    await logAudit({
      userId: user.id,
      action: 'DELETE',
      entityType: 'Collection',
      entityId: id,
      changes: { name: existing.name },
    })

    return ok({ message: 'Collection deleted' })
  } catch (error) {
    return failFromError(error, 'Failed to delete collection')
  }
}
