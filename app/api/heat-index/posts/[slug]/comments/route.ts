import { NextRequest } from 'next/server'
import { ok, fail, notFound, serverError, unauthorized } from '@/lib/api'
import { getCurrentUser } from '@/lib/rbac'
import { blogCommentSchema } from '@/lib/blog/schemas'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/heat-index/posts/[slug]/comments
 * Public — approved top-level comments only (replies are nested in payload).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const post = await prisma.blogPost.findUnique({ where: { slug }, select: { id: true } })
    if (!post) return notFound('Post not found')

    const comments = await prisma.blogComment.findMany({
      where: { postId: post.id, status: 'APPROVED' },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        body: true,
        createdAt: true,
        parentId: true,
        user: { select: { name: true } },
      },
    })
    return ok(comments)
  } catch (error: unknown) {
    return serverError('Failed to fetch comments', error)
  }
}

/**
 * POST /api/heat-index/posts/[slug]/comments
 * Authenticated — submit a comment. Goes into PENDING moderation by default.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized('Sign in to comment')

    const { slug } = await params
    const body = await req.json()
    const parsed = blogCommentSchema.safeParse(body)
    if (!parsed.success) {
      return fail(`Validation error: ${parsed.error.issues[0].message}`)
    }

    const post = await prisma.blogPost.findUnique({
      where: { slug },
      select: { id: true, status: true },
    })
    if (!post || post.status !== 'PUBLISHED') return notFound('Post not found')

    if (parsed.data.parentId) {
      const parent = await prisma.blogComment.findUnique({
        where: { id: parsed.data.parentId },
        select: { postId: true, parentId: true },
      })
      if (!parent || parent.postId !== post.id) {
        return fail('Invalid parent comment', 400)
      }
      // Cap depth at one level of replies.
      if (parent.parentId) {
        return fail('Replies cannot be nested further', 400)
      }
    }

    const comment = await prisma.blogComment.create({
      data: {
        postId: post.id,
        userId: user.id,
        body: parsed.data.body,
        parentId: parsed.data.parentId ?? null,
        status: 'PENDING',
      },
      select: { id: true, status: true, createdAt: true },
    })

    return ok(comment, 201)
  } catch (error: unknown) {
    return serverError('Failed to submit comment', error)
  }
}
