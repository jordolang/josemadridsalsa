import { NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/rbac'
import {
  checkRateLimit,
  createRateLimitHeaders,
  getClientIdentifier,
  RATE_LIMITS,
} from '@/lib/rate-limiter'

export const runtime = 'nodejs'

const Schema = z.object({
  productId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(160).optional(),
  comment: z.string().trim().max(2000).optional(),
})

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { error: 'You must be signed in to leave a product review.' },
      { status: 401 },
    )
  }

  const identifier = getClientIdentifier(request)
  const rateLimit = await checkRateLimit({
    ...RATE_LIMITS.API_GENERAL,
    maxRequests: 10,
    windowSeconds: 60,
    identifier: `product-review:${user.id}`,
  })
  const headers = createRateLimitHeaders(rateLimit)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many reviews submitted. Please try again shortly.' },
      { status: 429, headers: { ...headers, 'Retry-After': rateLimit.resetIn.toString() } },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400, headers })
  }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid review data.', details: parsed.error.flatten() },
      { status: 400, headers },
    )
  }

  const product = await prisma.product.findUnique({
    where: { id: parsed.data.productId },
    select: { id: true },
  })
  if (!product) {
    return NextResponse.json({ error: 'Product not found.' }, { status: 404, headers })
  }

  const purchased = await prisma.orderItem.findFirst({
    where: {
      productId: product.id,
      order: { userId: user.id, status: { in: ['DELIVERED', 'SHIPPED'] } },
    },
    select: { id: true },
  })

  try {
    const review = await prisma.review.upsert({
      where: { userId_productId: { userId: user.id, productId: product.id } },
      create: {
        userId: user.id,
        productId: product.id,
        rating: parsed.data.rating,
        title: parsed.data.title ?? null,
        comment: parsed.data.comment ?? null,
        isVerified: Boolean(purchased),
        status: 'PENDING',
      },
      update: {
        rating: parsed.data.rating,
        title: parsed.data.title ?? null,
        comment: parsed.data.comment ?? null,
        isVerified: Boolean(purchased),
        status: 'PENDING',
        moderatedAt: null,
        moderatedBy: null,
      },
      select: { id: true, status: true },
    })

    return NextResponse.json({ id: review.id, status: review.status, success: true }, { headers })
  } catch (error) {
    console.error('[product-review] create failed', error)
    return NextResponse.json(
      { error: 'Unable to submit review right now. Please try again later.' },
      { status: 500, headers },
    )
  }
}
