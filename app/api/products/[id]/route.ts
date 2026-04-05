import { NextRequest } from 'next/server'
import { ok, notFound, serverError } from '@/lib/api'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/products/[id]
 * Public endpoint — fetch a single product by ID with variants, reviews, and category.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        variants: {
          orderBy: { createdAt: 'asc' },
        },
        reviews: {
          where: { status: 'APPROVED' },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            rating: true,
            title: true,
            comment: true,
            isVerified: true,
            createdAt: true,
            user: {
              select: { name: true },
            },
          },
        },
        nutritionalInfo: true,
      },
    })

    if (!product || !product.isActive) {
      return notFound('Product not found')
    }

    return ok(product)
  } catch (error: unknown) {
    return serverError('Failed to fetch product', error)
  }
}
