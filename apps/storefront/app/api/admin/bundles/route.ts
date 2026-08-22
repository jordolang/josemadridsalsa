import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail, failFromError } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'
import { bundleProductRows, bundleComponentSchema, slugSchema } from '@/lib/bundles'

const bundleSchema = z.object({
  name: z.string().min(1),
  slug: slugSchema,
  description: z.string().nullable().optional(),
  image: z.string().url().nullable().optional(),
  /** The set price for one bundle, in dollars. */
  price: z.number().nonnegative().max(1_000_000),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  metaTitle: z.string().nullable().optional(),
  metaDescription: z.string().nullable().optional(),
  ogImage: z.string().url().nullable().optional(),
  /** The products in the bundle, each with a quantity. Order becomes each row's sortOrder. */
  components: z.array(bundleComponentSchema).min(1, 'A bundle needs at least one product'),
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

    const [bundles, total] = await Promise.all([
      prisma.bundle.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        skip,
        take: pageSize,
        include: { _count: { select: { products: true } } },
      }),
      prisma.bundle.count({ where }),
    ])

    return ok({ bundles, total, page, pageSize })
  } catch (error) {
    return failFromError(error, 'Failed to load bundles')
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission('products:write')
    const body = await req.json()
    const { components, ...data } = bundleSchema.parse(body)

    const bundle = await prisma.bundle.create({
      data: {
        ...data,
        products: { create: bundleProductRows(components) },
      },
    })

    await logAudit({
      userId: user.id,
      action: 'CREATE',
      entityType: 'Bundle',
      entityId: bundle.id,
      changes: { ...data, components },
    })

    return ok({ bundle }, 201)
  } catch (error: any) {
    if (error instanceof SyntaxError) return fail('Invalid JSON body', 400)
    if (error?.name === 'ZodError') return fail('Invalid bundle data', 400, error.issues)
    if (error.code === 'P2002') {
      return fail('A bundle with this name or slug already exists', 409)
    }
    if (error.code === 'P2003' || error.code === 'P2025') {
      return fail('One or more selected products could not be found', 400)
    }
    return failFromError(error, 'Failed to create bundle')
  }
}
