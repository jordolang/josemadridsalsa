import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { ok, fail } from '@/lib/api'

/**
 * GET /api/admin/blog/posts
 * List all blog posts (admin)
 */
export async function GET(req: NextRequest) {
  try {
    await requirePermission('content:read')

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || ''
    const search = searchParams.get('search') || ''
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = 20
    const skip = (page - 1) * limit

    const where: any = {}

    if (status && status !== 'all') {
      where.status = status
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { author: { name: { contains: search, mode: 'insensitive' } } },
        { author: { email: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          author: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      }),
      prisma.blogPost.count({ where }),
    ])

    return ok({
      posts,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error: any) {
    return fail(error.message, error.status || 500)
  }
}
