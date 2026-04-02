import { NextRequest } from 'next/server'
import { ok, fail, notFound, serverError } from '@/lib/api'
import { requirePermission } from '@/lib/rbac'
import { developerBlogPostSchema } from '@/lib/developer/schemas'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/developer/blog/[slug]
 * Public endpoint — returns a single published blog post by slug.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    const post = await prisma.developerBlogPost.findUnique({
      where: { slug },
    })

    if (!post || !post.published) {
      return notFound('Blog post not found')
    }

    return ok(post)
  } catch (error: unknown) {
    return serverError('Failed to fetch blog post', error)
  }
}

/**
 * PATCH /api/developer/blog/[slug]
 * Admin-only — update an existing blog post.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    await requirePermission('products:write')

    const { slug } = await params
    const body = await req.json()
    const parsed = developerBlogPostSchema.partial().safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return fail(`Validation error: ${firstError.message}`)
    }

    const existing = await prisma.developerBlogPost.findUnique({ where: { slug } })
    if (!existing) {
      return notFound('Blog post not found')
    }

    // If slug is being changed, check the new slug isn't taken
    if (parsed.data.slug && parsed.data.slug !== slug) {
      const slugTaken = await prisma.developerBlogPost.findUnique({
        where: { slug: parsed.data.slug },
      })
      if (slugTaken) {
        return fail('A blog post with this slug already exists', 409)
      }
    }

    // Set publishedAt when first published
    const data: Record<string, unknown> = { ...parsed.data }
    if (parsed.data.published === true && !existing.publishedAt) {
      data.publishedAt = new Date()
    }

    const updated = await prisma.developerBlogPost.update({
      where: { slug },
      data,
    })

    return ok(updated)
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return fail('Unauthorized', 401)
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return fail('Forbidden', 403)
    }
    return serverError('Failed to update blog post', error)
  }
}

/**
 * DELETE /api/developer/blog/[slug]
 * Admin-only — delete a blog post.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    await requirePermission('products:write')

    const { slug } = await params

    const existing = await prisma.developerBlogPost.findUnique({ where: { slug } })
    if (!existing) {
      return notFound('Blog post not found')
    }

    await prisma.developerBlogPost.delete({ where: { slug } })

    return ok({ deleted: true })
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return fail('Unauthorized', 401)
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return fail('Forbidden', 403)
    }
    return serverError('Failed to delete blog post', error)
  }
}
