import { NextRequest } from 'next/server'
import { ok, fail, serverError } from '@/lib/api'
import { requirePermission } from '@/lib/rbac'
import { blogSeriesSchema } from '@/lib/blog/schemas'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const series = await prisma.blogSeries.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { posts: { where: { status: 'PUBLISHED' } } } },
      },
    })
    return ok(series)
  } catch (error: unknown) {
    return serverError('Failed to fetch series', error)
  }
}

export async function POST(req: NextRequest) {
  try {
    await requirePermission('content:write')
    const body = await req.json()
    const parsed = blogSeriesSchema.safeParse(body)
    if (!parsed.success) {
      return fail(`Validation error: ${parsed.error.issues[0].message}`)
    }
    const existing = await prisma.blogSeries.findUnique({ where: { slug: parsed.data.slug } })
    if (existing) return fail('A series with this slug already exists', 409)
    const created = await prisma.blogSeries.create({ data: parsed.data })
    return ok(created, 201)
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('Unauthorized'))
      return fail('Unauthorized', 401)
    if (error instanceof Error && error.message.includes('Forbidden'))
      return fail('Forbidden', 403)
    return serverError('Failed to create series', error)
  }
}
