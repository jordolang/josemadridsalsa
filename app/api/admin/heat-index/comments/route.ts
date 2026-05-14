import { NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, fail, notFound, serverError } from '@/lib/api'
import { requirePermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const adminCommentSchema = z.object({
  postId: z.string().min(1),
  body: z.string().trim().min(2).max(2000),
  parentId: z.string().optional().nullable(),
})

/**
 * POST /api/admin/heat-index/comments
 * Admin-authored comment on a post. Auto-approved, attributed to the current admin user.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission('content:write')

    const body = await req.json()
    const parsed = adminCommentSchema.safeParse(body)
    if (!parsed.success) {
      return fail(`Validation error: ${parsed.error.issues[0].message}`)
    }

    const post = await prisma.blogPost.findUnique({
      where: { id: parsed.data.postId },
      select: { id: true },
    })
    if (!post) return notFound('Post not found')

    if (parsed.data.parentId) {
      const parent = await prisma.blogComment.findUnique({
        where: { id: parsed.data.parentId },
        select: { postId: true, parentId: true },
      })
      if (!parent || parent.postId !== post.id) {
        return fail('Invalid parent comment', 400)
      }
      if (parent.parentId) {
        return fail('Replies cannot be nested further', 400)
      }
    }

    const created = await prisma.blogComment.create({
      data: {
        postId: post.id,
        userId: user.id,
        body: parsed.data.body,
        parentId: parsed.data.parentId ?? null,
        status: 'APPROVED',
      },
      select: { id: true, status: true, createdAt: true },
    })

    return ok(created, 201)
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('Unauthorized'))
      return fail('Unauthorized', 401)
    if (error instanceof Error && error.message.includes('Forbidden'))
      return fail('Forbidden', 403)
    return serverError('Failed to post comment', error)
  }
}
