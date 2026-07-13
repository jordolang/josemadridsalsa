import { NextRequest } from 'next/server'
import { ok, fail, notFound, serverError, unauthorized } from '@/lib/api'
import { getCurrentUser } from '@/lib/rbac'
import { blogReactionSchema } from '@/lib/blog/schemas'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/heat-index/posts/[slug]/reactions
 * Authenticated — toggle a reaction kind for the current user on the post.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized('Sign in to react')

    const { slug } = await params
    const body = await req.json()
    const parsed = blogReactionSchema.safeParse(body)
    if (!parsed.success) {
      return fail(`Validation error: ${parsed.error.issues[0].message}`)
    }

    const post = await prisma.blogPost.findUnique({
      where: { slug },
      select: { id: true, status: true },
    })
    if (!post || post.status !== 'PUBLISHED') return notFound('Post not found')

    const existing = await prisma.blogReaction.findUnique({
      where: {
        postId_userId_kind: {
          postId: post.id,
          userId: user.id,
          kind: parsed.data.kind,
        },
      },
    })

    if (existing) {
      await prisma.blogReaction.delete({ where: { id: existing.id } })
      return ok({ active: false })
    }

    await prisma.blogReaction.create({
      data: {
        postId: post.id,
        userId: user.id,
        kind: parsed.data.kind,
      },
    })
    return ok({ active: true })
  } catch (error: unknown) {
    return serverError('Failed to save reaction', error)
  }
}
