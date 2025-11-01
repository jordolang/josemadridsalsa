import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail, parsePagination } from '@/lib/api'
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

export async function GET(req: NextRequest) {
  try {
    await requirePermission('content:read')

    const { searchParams } = new URL(req.url)
    const page = Number(searchParams.get('page')) || 1
    const take = 50
    const skip = (page - 1) * take
    const search = searchParams.get('search') || ''
    const isActive = searchParams.get('isActive')

    const where: any = {}

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (isActive === 'true') where.isActive = true
    if (isActive === 'false') where.isActive = false

    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        where,
        skip,
        take,
        orderBy: { sortOrder: 'asc' },
        include: {
          _count: {
            select: { products: true },
          },
        },
      }),
      prisma.category.count({ where }),
    ])

    return ok({ categories, total })
  } catch (error: any) {
    return fail(error.message, error.status)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission('content:write')
    const body = await req.json()
    const data = categorySchema.parse(body)

    const category = await prisma.category.create({ data })

    await logAudit({
      userId: user.id,
      action: 'CREATE',
      entityType: 'Category',
      entityId: category.id,
      changes: data,
    })

    return ok({ category }, 201)
  } catch (error: any) {
    if (error.code === 'P2002') {
      return fail('Category with this name or slug already exists', 409)
    }
    return fail(error.message, 400)
  }
}
