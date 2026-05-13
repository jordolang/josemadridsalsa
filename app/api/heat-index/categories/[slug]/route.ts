import { NextRequest } from 'next/server'
import { ok, fail, notFound, serverError } from '@/lib/api'
import { requirePermission } from '@/lib/rbac'
import { blogCategorySchema } from '@/lib/blog/schemas'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    await requirePermission('content:write')
    const { slug } = await params
    const body = await req.json()
    const parsed = blogCategorySchema.partial().safeParse(body)
    if (!parsed.success) {
      return fail(`Validation error: ${parsed.error.issues[0].message}`)
    }
    const existing = await prisma.blogCategory.findUnique({ where: { slug } })
    if (!existing) return notFound('Category not found')
    if (parsed.data.slug && parsed.data.slug !== slug) {
      const taken = await prisma.blogCategory.findUnique({ where: { slug: parsed.data.slug } })
      if (taken) return fail('Slug already in use', 409)
    }
    const updated = await prisma.blogCategory.update({ where: { slug }, data: parsed.data })
    return ok(updated)
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('Unauthorized'))
      return fail('Unauthorized', 401)
    if (error instanceof Error && error.message.includes('Forbidden'))
      return fail('Forbidden', 403)
    return serverError('Failed to update category', error)
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    await requirePermission('content:write')
    const { slug } = await params
    const existing = await prisma.blogCategory.findUnique({ where: { slug } })
    if (!existing) return notFound('Category not found')
    await prisma.blogCategory.delete({ where: { slug } })
    return ok({ deleted: true })
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('Unauthorized'))
      return fail('Unauthorized', 401)
    if (error instanceof Error && error.message.includes('Forbidden'))
      return fail('Forbidden', 403)
    return serverError('Failed to delete category', error)
  }
}
