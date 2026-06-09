import { NextRequest } from 'next/server'
import { ok, fail, serverError, parsePagination, paginated } from '@/lib/api'
import { requirePermission } from '@/lib/rbac'
import { blogPostSchema } from '@/lib/blog/schemas'
import { postCardSelect } from '@/lib/blog/queries'
import { publishBlogPost } from '@/lib/blog/publish'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/heat-index/posts
 * Public — published posts with pagination, optional filters.
 */
export async function GET(req: NextRequest) {
  try {
    const { skip, limit, page } = parsePagination(req)
    const { searchParams } = new URL(req.url)
    const seriesSlug = searchParams.get('series')
    const categorySlug = searchParams.get('category')
    const tag = searchParams.get('tag')

    const where = {
      status: 'PUBLISHED' as const,
      publishedAt: { lte: new Date() },
      ...(seriesSlug ? { series: { slug: seriesSlug } } : {}),
      ...(categorySlug ? { category: { slug: categorySlug } } : {}),
      ...(tag ? { tags: { has: tag } } : {}),
    }

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        skip,
        take: limit,
        orderBy: { publishedAt: 'desc' },
        select: postCardSelect,
      }),
      prisma.blogPost.count({ where }),
    ])

    return paginated(posts, total, page, limit)
  } catch (error: unknown) {
    return serverError('Failed to fetch blog posts', error)
  }
}

/**
 * POST /api/heat-index/posts
 * Admin — create a post. Publishing triggers email send to subscribers.
 */
export async function POST(req: NextRequest) {
  try {
    await requirePermission('content:write')

    const body = await req.json()
    const parsed = blogPostSchema.safeParse(body)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return fail(`Validation error: ${first.message}`)
    }

    const data = parsed.data
    const existing = await prisma.blogPost.findUnique({ where: { slug: data.slug } })
    if (existing) return fail('A post with this slug already exists', 409)

    const post = await prisma.blogPost.create({
      data: {
        ...data,
        publishedAt: data.status === 'PUBLISHED' ? new Date() : null,
      },
    })

    if (post.status === 'PUBLISHED') {
      await publishBlogPost(post.id).catch((err) => {
        console.error('Failed to send publish notifications:', err)
      })
    }

    return ok(post, 201)
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('Unauthorized'))
      return fail('Unauthorized', 401)
    if (error instanceof Error && error.message.includes('Forbidden'))
      return fail('Forbidden', 403)
    return serverError('Failed to create blog post', error)
  }
}
