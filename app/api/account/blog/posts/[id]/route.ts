import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { ok, fail } from '@/lib/api'

/**
 * GET /api/account/blog/posts/[id]
 * Get a single blog post owned by the current user
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return fail('Unauthorized', 401)
    }

    const userId = (session.user as any).id as string
    const { id } = await params

    const post = await prisma.blogPost.findFirst({
      where: { id, authorId: userId },
    })

    if (!post) {
      return fail('Blog post not found', 404)
    }

    return ok({ post })
  } catch (error: any) {
    return fail(error.message, 500)
  }
}

/**
 * PATCH /api/account/blog/posts/[id]
 * Update a blog post owned by the current user
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return fail('Unauthorized', 401)
    }

    const userId = (session.user as any).id as string
    const { id } = await params

    const existing = await prisma.blogPost.findFirst({
      where: { id, authorId: userId },
    })

    if (!existing) {
      return fail('Blog post not found', 404)
    }

    const body = await req.json()
    const { title, content, excerpt, featuredImage, category, status } = body

    const updateData: any = {}

    if (title !== undefined) {
      updateData.title = title
      // Regenerate slug if title changed
      const baseSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
      let slug = baseSlug
      let suffix = 1
      while (true) {
        const conflict = await prisma.blogPost.findUnique({ where: { slug } })
        if (!conflict || conflict.id === id) break
        slug = `${baseSlug}-${suffix}`
        suffix++
      }
      updateData.slug = slug
    }

    if (content !== undefined) updateData.content = content
    if (excerpt !== undefined) updateData.excerpt = excerpt || null
    if (featuredImage !== undefined) updateData.featuredImage = featuredImage || null
    if (category !== undefined) updateData.category = category || null

    if (status !== undefined) {
      // Users can only set DRAFT or PENDING_REVIEW
      if (status === 'PUBLISHED') {
        updateData.status = 'PENDING_REVIEW'
      } else if (['DRAFT', 'PENDING_REVIEW'].includes(status)) {
        updateData.status = status
      }
    }

    const post = await prisma.blogPost.update({
      where: { id },
      data: updateData,
    })

    return ok({ post })
  } catch (error: any) {
    return fail(error.message, 500)
  }
}

/**
 * DELETE /api/account/blog/posts/[id]
 * Delete a blog post owned by the current user
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return fail('Unauthorized', 401)
    }

    const userId = (session.user as any).id as string
    const { id } = await params

    const existing = await prisma.blogPost.findFirst({
      where: { id, authorId: userId },
    })

    if (!existing) {
      return fail('Blog post not found', 404)
    }

    await prisma.blogPost.delete({ where: { id } })

    return ok({ message: 'Blog post deleted' })
  } catch (error: any) {
    return fail(error.message, 500)
  }
}
