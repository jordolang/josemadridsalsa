import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { ok, fail } from '@/lib/api'

/**
 * GET /api/account/blog/posts
 * List the current user's blog posts
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return fail('Unauthorized', 401)
    }

    const userId = (session.user as any).id as string

    // Verify blog access
    const access = await prisma.blogAccessRequest.findUnique({
      where: { userId },
    })

    if (!access || access.status !== 'APPROVED') {
      return fail('Blog access not approved', 403)
    }

    const posts = await prisma.blogPost.findMany({
      where: { authorId: userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        status: true,
        category: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return ok({ posts })
  } catch (error: any) {
    return fail(error.message, 500)
  }
}

/**
 * POST /api/account/blog/posts
 * Create a new blog post
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return fail('Unauthorized', 401)
    }

    const userId = (session.user as any).id as string

    // Verify blog access
    const access = await prisma.blogAccessRequest.findUnique({
      where: { userId },
    })

    if (!access || access.status !== 'APPROVED') {
      return fail('Blog access not approved', 403)
    }

    const body = await req.json()
    const { title, content, excerpt, featuredImage, category, status } = body

    if (!title || !content) {
      return fail('Title and content are required', 400)
    }

    // Generate slug from title
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    // Ensure unique slug
    let slug = baseSlug
    let suffix = 1
    while (await prisma.blogPost.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${suffix}`
      suffix++
    }

    const postStatus = status === 'PUBLISHED' ? 'PENDING_REVIEW' : (status || 'DRAFT')

    const post = await prisma.blogPost.create({
      data: {
        authorId: userId,
        title,
        slug,
        content,
        excerpt: excerpt || null,
        featuredImage: featuredImage || null,
        category: category || null,
        status: postStatus,
        publishedAt: postStatus === 'PUBLISHED' ? new Date() : null,
      },
    })

    return ok({ post }, 201)
  } catch (error: any) {
    return fail(error.message, 500)
  }
}
