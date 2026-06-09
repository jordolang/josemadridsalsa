import { NextRequest } from 'next/server'
import { ok, fail, serverError } from '@/lib/api'
import { requirePermission } from '@/lib/rbac'
import { blogCategorySchema } from '@/lib/blog/schemas'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const categories = await prisma.blogCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { posts: { where: { status: 'PUBLISHED' } } } },
      },
    })
    return ok(categories)
  } catch (error: unknown) {
    return serverError('Failed to fetch categories', error)
  }
}

export async function POST(req: NextRequest) {
  try {
    await requirePermission('content:write')
    const body = await req.json()
    const parsed = blogCategorySchema.safeParse(body)
    if (!parsed.success) {
      return fail(`Validation error: ${parsed.error.issues[0].message}`)
    }
    const existing = await prisma.blogCategory.findUnique({ where: { slug: parsed.data.slug } })
    if (existing) return fail('Slug already in use', 409)
    const created = await prisma.blogCategory.create({ data: parsed.data })
    return ok(created, 201)
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('Unauthorized'))
      return fail('Unauthorized', 401)
    if (error instanceof Error && error.message.includes('Forbidden'))
      return fail('Forbidden', 403)
    return serverError('Failed to create category', error)
  }
}
