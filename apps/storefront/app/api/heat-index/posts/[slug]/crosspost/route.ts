import { NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, fail, notFound, serverError } from '@/lib/api'
import { requirePermission } from '@/lib/rbac'
import { crosspostBlogPost, getBlogCrosspostStatus } from '@/lib/social/blog-crosspost'
import { revalidateBlogPost } from '@/lib/blog/revalidate'
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

    const body = await req.json().catch(() => null)
    const parsed = crosspostSchema.safeParse(body)
    if (!parsed.success) {
      return fail(`Validation error: ${parsed.error.issues[0].message}`)
    }

    const post = await prisma.blogPost.findUnique({ where: { slug }, select: { id: true } })
    if (!post) return notFound('Post not found')

    // Drop the cached render first: the cross-post makes Facebook scrape the
    // article for its preview card, and a stale render would hand it the cover
    // image the page had fifteen minutes ago.
    revalidateBlogPost(slug)

    const requestedIds = Array.from(new Set(parsed.data.accountIds))
    const { results } = await crosspostBlogPost(post.id, requestedIds)

    if (results.length === 0) {
      return fail('No eligible connected channels were selected', 400)
    }

    // Selected accounts that were dropped (inactive, deleted, or on an
    // ineligible platform) never produced a result — surface them rather than
    // reporting the request as fully successful.
    const resultIds = new Set(results.map((r) => r.accountId))
    const skipped = requestedIds.filter((id) => !resultIds.has(id))
    const failures = results.filter((r) => !r.success)
    const allSucceeded = failures.length === 0 && skipped.length === 0

    const parts: string[] = []
    if (failures.length > 0) {
      parts.push(`${failures.length} ${failures.length === 1 ? 'failure' : 'failures'}`)
    }
    if (skipped.length > 0) {
      parts.push(`${skipped.length} ${skipped.length === 1 ? 'channel' : 'channels'} unavailable`)
    }

    return ok({
      results,
      skipped,
      allSucceeded,
      message: allSucceeded
        ? 'Cross-posted to all selected channels'
        : `Cross-posted with ${parts.join(', ')}`,
    })
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('Unauthorized'))
      return fail('Unauthorized', 401)
    if (error instanceof Error && error.message.includes('Forbidden'))
      return fail('Forbidden', 403)
    return serverError('Failed to cross-post', error)
  }
}
