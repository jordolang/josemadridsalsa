import { NextRequest } from 'next/server'
import { ok, fail, notFound, serverError } from '@/lib/api'
import { requirePermission } from '@/lib/rbac'
import { blogCommentModerationSchema } from '@/lib/blog/schemas'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * PATCH /api/heat-index/comments/[id]
 * Admin — moderate a comment (approve, hide, mark spam).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission('content:write')
    const { id } = await params
    const body = await req.json()
    const parsed = blogCommentModerationSchema.safeParse(body)
    if (!parsed.success) {
      return fail(`Validation error: ${parsed.error.issues[0].message}`)
    }
    const existing = await prisma.blogComment.findUnique({ where: { id } })
    if (!existing) return notFound('Comment not found')
    const updated = await prisma.blogComment.update({
      where: { id },
      data: { status: parsed.data.status },
    })
    return ok(updated)
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('Unauthorized'))
      return fail('Unauthorized', 401)
    if (error instanceof Error && error.message.includes('Forbidden'))
      return fail('Forbidden', 403)
    return serverError('Failed to update comment', error)
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission('content:write')
    const { id } = await params
    const existing = await prisma.blogComment.findUnique({ where: { id } })
    if (!existing) return notFound('Comment not found')
    await prisma.blogComment.delete({ where: { id } })
    return ok({ deleted: true })
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('Unauthorized'))
      return fail('Unauthorized', 401)
    if (error instanceof Error && error.message.includes('Forbidden'))
      return fail('Forbidden', 403)
    return serverError('Failed to delete comment', error)
  }
}
