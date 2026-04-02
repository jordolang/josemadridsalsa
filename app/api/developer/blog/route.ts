import { NextRequest } from 'next/server'
import { ok, fail, serverError, parsePagination, paginated } from '@/lib/api'
import { requirePermission } from '@/lib/rbac'
import { developerBlogPostSchema } from '@/lib/developer/schemas'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/developer/blog
 * Public endpoint — returns published blog posts with pagination and optional tag filter.
 */
export async function GET(req: NextRequest) {
  try {
    const { skip, limit, page } = parsePagination(req)
    const { searchParams } = new URL(req.url)
    const tag = searchParams.get('tag')

    const where: Record<string, unknown> = { published: true }

    if (tag) {
      where.tags = { has: tag }
    }

    const [posts, total] = await Promise.all([
      prisma.developerBlogPost.findMany({
        where,
        skip,
        take: limit,
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          coverImage: true,
          tags: true,
          publishedAt: true,
        },
      }),
      prisma.developerBlogPost.count({ where }),
    ])

    return paginated(posts, total, page, limit)
  } catch (error: unknown) {
    return serverError('Failed to fetch blog posts', error)
  }
}

/**
 * POST /api/developer/blog
 * Admin-only — create a new blog post.
 */
export async function POST(req: NextRequest) {
  try {
    await requirePermission('products:write')

    const body = await req.json()
    const parsed = developerBlogPostSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return fail(`Validation error: ${firstError.message}`)
    }

    const { title, slug, excerpt, content, coverImage, tags, published } = parsed.data

    const existing = await prisma.developerBlogPost.findUnique({ where: { slug } })
    if (existing) {
      return fail('A blog post with this slug already exists', 409)
    }

    const post = await prisma.developerBlogPost.create({
      data: {
        title,
        slug,
        excerpt,
        content,
        coverImage: coverImage ?? null,
        tags,
        published,
        publishedAt: published ? new Date() : null,
      },
    })

    return ok(post, 201)
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return fail('Unauthorized', 401)
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return fail('Forbidden', 403)
    }
    return serverError('Failed to create blog post', error)
  }
}
