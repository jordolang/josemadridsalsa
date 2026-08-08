import { NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, fail, notFound, serverError } from '@/lib/api'
import { requirePermission } from '@/lib/rbac'
import { crosspostBlogPost, getBlogCrosspostStatus } from '@/lib/social/blog-crosspost'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const crosspostSchema = z.object({
  accountIds: z.array(z.string().min(1)).min(1, 'Select at least one channel'),
})

/**
 * GET /api/heat-index/posts/[slug]/crosspost
 * Admin — current cross-post status (which channels the article was posted to).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    await requirePermission('content:write')
    const { slug } = await params
    const post = await prisma.blogPost.findUnique({ where: { slug }, select: { id: true } })
    if (!post) return notFound('Post not found')
    return ok(await getBlogCrosspostStatus(post.id))
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('Unauthorized'))
      return fail('Unauthorized', 401)
    if (error instanceof Error && error.message.includes('Forbidden'))
      return fail('Forbidden', 403)
    return serverError('Failed to load cross-post status', error)
  }
}

/**
 * POST /api/heat-index/posts/[slug]/crosspost
 * Admin — cross-post the article to the selected connected accounts now.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    await requirePermission('content:write')
    const { slug } = await params

    const body = await req.json()
    const parsed = crosspostSchema.safeParse(body)
    if (!parsed.success) {
      return fail(`Validation error: ${parsed.error.issues[0].message}`)
    }

    const post = await prisma.blogPost.findUnique({ where: { slug }, select: { id: true } })
    if (!post) return notFound('Post not found')

    const { results } = await crosspostBlogPost(post.id, parsed.data.accountIds)

    if (results.length === 0) {
      return fail('No eligible connected channels were selected', 400)
    }

    const failures = results.filter((r) => !r.success)
    return ok({
      results,
      allSucceeded: failures.length === 0,
      message:
        failures.length === 0
          ? 'Cross-posted to all selected channels'
          : `Cross-posted with ${failures.length} failure(s)`,
    })
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('Unauthorized'))
      return fail('Unauthorized', 401)
    if (error instanceof Error && error.message.includes('Forbidden'))
      return fail('Forbidden', 403)
    return serverError('Failed to cross-post', error)
  }
}
