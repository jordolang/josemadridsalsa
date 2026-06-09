import { NextRequest, NextResponse } from 'next/server'
import { prisma as db } from '@/lib/prisma'
import { rateLimit } from '@/lib/rateLimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/products/[id]
 * Public endpoint — fetch a single product by ID or slug with variants, reviews, and category.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(`products-get:${ip}`, 30, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    )
  }

  const { id } = await params

  if (!id || typeof id !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Invalid product identifier' },
      { status: 422 },
    )
  }

  const include = {
    category: true,
    variants: {
      orderBy: { createdAt: 'asc' as const },
    },
    reviews: {
      where: { status: 'APPROVED' as const },
      orderBy: { createdAt: 'desc' as const },
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
  }

  // Support both numeric ID and slug lookups.
  const product =
    (await db.product.findUnique({ where: { id }, include })) ??
    (await db.product.findUnique({ where: { slug: id }, include }))

  if (!product || !product.isActive) {
    return NextResponse.json(
      { success: false, error: 'Product not found' },
      { status: 404 },
    )
  }

  return NextResponse.json(product, { status: 200 })
}
