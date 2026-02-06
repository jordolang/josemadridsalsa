import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { ok, fail } from '@/lib/api'
import { logAudit } from '@/lib/audit'

/**
 * PATCH /api/admin/blog/posts/[id]
 * Admin can update status (publish, reject) or edit any post
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission('content:write')
    const { id } = await params
    const body = await req.json()
    const { status } = body

    const existing = await prisma.blogPost.findUnique({ where: { id } })
    if (!existing) {
      return fail('Blog post not found', 404)
    }

    const updateData: any = {}

    if (status) {
      updateData.status = status
      if (status === 'PUBLISHED' && !existing.publishedAt) {
        updateData.publishedAt = new Date()
      }
    }

    const post = await prisma.blogPost.update({
      where: { id },
      data: updateData,
      include: {
        author: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    })

    await logAudit({
      userId: user.id,
      action: `blog_post.${status?.toLowerCase() || 'update'}`,
      entityType: 'BlogPost',
      entityId: id,
      changes: { status, title: post.title },
    })

    return ok({ post })
  } catch (error: any) {
    return fail(error.message, error.status || 500)
  }
}

/**
 * DELETE /api/admin/blog/posts/[id]
 * Admin can delete any blog post
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission('content:write')
    const { id } = await params

    const existing = await prisma.blogPost.findUnique({ where: { id } })
    if (!existing) {
      return fail('Blog post not found', 404)
    }

    await prisma.blogPost.delete({ where: { id } })

    await logAudit({
      userId: user.id,
      action: 'blog_post.delete',
      entityType: 'BlogPost',
      entityId: id,
      changes: { title: existing.title },
    })

    return ok({ message: 'Blog post deleted' })
  } catch (error: any) {
    return fail(error.message, error.status || 500)
  }
}
