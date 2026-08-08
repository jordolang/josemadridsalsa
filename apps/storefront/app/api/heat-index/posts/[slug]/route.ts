import { NextRequest } from 'next/server'
import { ok, fail, notFound, serverError } from '@/lib/api'
import { requirePermission } from '@/lib/rbac'
import { blogPostUpdateSchema } from '@/lib/blog/schemas'
import { publishBlogPost } from '@/lib/blog/publish'
import { crosspostAccountIdsSchema, crosspostBlogPost } from '@/lib/social/blog-crosspost'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/heat-index/posts/[slug]
 * Public — single published post.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const post = await prisma.blogPost.findUnique({
      where: { slug },
      include: {
        category: true,
        series: true,
      },
    })
    if (!post || post.status !== 'PUBLISHED') return notFound('Post not found')
    return ok(post)
  } catch (error: unknown) {
    return serverError('Failed to fetch post', error)
  }
}

/**
 * PATCH /api/heat-index/posts/[slug]
 * Admin — update a post. Transition to PUBLISHED triggers subscriber emails.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    await requirePermission('content:write')

    const { slug } = await params
    const body = await req.json()
    const parsed = blogPostUpdateSchema.safeParse(body)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return fail(`Validation error: ${first.message}`)
    }

    const existing = await prisma.blogPost.findUnique({ where: { slug } })
    if (!existing) return notFound('Post not found')

    if (parsed.data.slug && parsed.data.slug !== slug) {
      const taken = await prisma.blogPost.findUnique({ where: { slug: parsed.data.slug } })
      if (taken) return fail('A post with this slug already exists', 409)
    }

    const wasPublished = existing.status === 'PUBLISHED'
    const willBePublished = parsed.data.status === 'PUBLISHED'
    const crosspostParsed = crosspostAccountIdsSchema.safeParse(body.crosspostAccountIds)
    const crosspostAccountIds = crosspostParsed.success ? crosspostParsed.data : []

    const data: Record<string, unknown> = { ...parsed.data }
    if (willBePublished && !existing.publishedAt) {
      data.publishedAt = new Date()
    }

    const updated = await prisma.blogPost.update({
      where: { slug },
      data,
    })

    if (!wasPublished && willBePublished) {
      await publishBlogPost(updated.id).catch((err) => {
        console.error('Failed to send publish notifications:', err)
      })
      if (crosspostAccountIds.length > 0) {
        await crosspostBlogPost(updated.id, crosspostAccountIds).catch((err) => {
          console.error('Failed to cross-post to social media:', err)
        })
      }
    }

    return ok(updated)
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('Unauthorized'))
      return fail('Unauthorized', 401)
    if (error instanceof Error && error.message.includes('Forbidden'))
      return fail('Forbidden', 403)
    return serverError('Failed to update post', error)
  }
}

/**
 * DELETE /api/heat-index/posts/[slug]
 * Admin — delete a post.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    await requirePermission('content:write')
    const { slug } = await params
    const existing = await prisma.blogPost.findUnique({ where: { slug } })
    if (!existing) return notFound('Post not found')
    await prisma.blogPost.delete({ where: { slug } })
    return ok({ deleted: true })
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('Unauthorized'))
      return fail('Unauthorized', 401)
    if (error instanceof Error && error.message.includes('Forbidden'))
      return fail('Forbidden', 403)
    return serverError('Failed to delete post', error)
  }
}
