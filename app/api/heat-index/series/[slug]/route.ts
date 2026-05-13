import { NextRequest } from 'next/server'
import { ok, fail, notFound, serverError } from '@/lib/api'
import { requirePermission } from '@/lib/rbac'
import { blogSeriesSchema } from '@/lib/blog/schemas'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const series = await prisma.blogSeries.findUnique({
      where: { slug },
      include: {
        posts: {
          where: { status: 'PUBLISHED' },
          orderBy: [{ seriesOrder: 'asc' }, { publishedAt: 'asc' }],
          select: { id: true, slug: true, title: true, excerpt: true, coverImage: true, publishedAt: true, seriesOrder: true },
        },
      },
    })
    if (!series) return notFound('Series not found')
    return ok(series)
  } catch (error: unknown) {
    return serverError('Failed to fetch series', error)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    await requirePermission('content:write')
    const { slug } = await params
    const body = await req.json()
    const parsed = blogSeriesSchema.partial().safeParse(body)
    if (!parsed.success) {
      return fail(`Validation error: ${parsed.error.issues[0].message}`)
    }
    const existing = await prisma.blogSeries.findUnique({ where: { slug } })
    if (!existing) return notFound('Series not found')
    if (parsed.data.slug && parsed.data.slug !== slug) {
      const taken = await prisma.blogSeries.findUnique({ where: { slug: parsed.data.slug } })
      if (taken) return fail('Slug already in use', 409)
    }
    const updated = await prisma.blogSeries.update({ where: { slug }, data: parsed.data })
    return ok(updated)
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('Unauthorized'))
      return fail('Unauthorized', 401)
    if (error instanceof Error && error.message.includes('Forbidden'))
      return fail('Forbidden', 403)
    return serverError('Failed to update series', error)
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    await requirePermission('content:write')
    const { slug } = await params
    const existing = await prisma.blogSeries.findUnique({ where: { slug } })
    if (!existing) return notFound('Series not found')
    await prisma.blogSeries.delete({ where: { slug } })
    return ok({ deleted: true })
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('Unauthorized'))
      return fail('Unauthorized', 401)
    if (error instanceof Error && error.message.includes('Forbidden'))
      return fail('Forbidden', 403)
    return serverError('Failed to delete series', error)
  }
}
