import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const categorySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullable().optional(),
  image: z.string().url().nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  metaTitle: z.string().nullable().optional(),
  metaDescription: z.string().nullable().optional(),
  ogImage: z.string().url().nullable().optional(),
})

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission('content:read')
    const category = await prisma.category.findUnique({
      where: { id: params.id },
      include: {
        _count: { select: { products: true } },
      },
    })
    if (!category) return fail('Category not found', 404)
    return ok({ category })
  } catch (error: any) {
    return fail(error.message, error.status)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission('content:write')
    const body = await req.json()
    const data = categorySchema.partial().parse(body)

    const existing = await prisma.category.findUnique({ where: { id: params.id } })
    if (!existing) return fail('Category not found', 404)

    const category = await prisma.category.update({
      where: { id: params.id },
      data,
    })

    await logAudit({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Category',
      entityId: category.id,
      changes: data,
    })

    return ok({ category })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return fail('Category with this name or slug already exists', 409)
    }
    return fail(error.message, 400)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission('content:write')

    const existing = await prisma.category.findUnique({
      where: { id: params.id },
      include: { _count: { select: { products: true } } },
    })
    if (!existing) return fail('Category not found', 404)
    if (existing._count.products > 0) {
      return fail('Cannot delete category with products', 400)
    }

    await prisma.category.delete({ where: { id: params.id } })

    await logAudit({
      userId: user.id,
      action: 'DELETE',
      entityType: 'Category',
      entityId: params.id,
      changes: { name: existing.name },
    })

    return ok({ message: 'Category deleted' })
  } catch (error: any) {
    return fail(error.message, 400)
  }
}
