import { NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import {
  checkRateLimit,
  createRateLimitHeaders,
  getClientIdentifier,
  RATE_LIMITS,
} from '@/lib/rate-limiter'

export const runtime = 'nodejs'

const Schema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().email().max(200).optional(),
  source: z.string().trim().max(120).optional(),
})

export async function POST(request: Request) {
  const identifier = getClientIdentifier(request)
  const rateLimit = checkRateLimit({
    ...RATE_LIMITS.API_GENERAL,
    maxRequests: 5,
    windowSeconds: 60,
    identifier: `site-review:${identifier}`,
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

  const review = await prisma.siteReview.create({
    data: {
      rating: parsed.data.rating,
      comment: parsed.data.comment ?? null,
      name: parsed.data.name ?? null,
      email: parsed.data.email ?? null,
      source: parsed.data.source ?? null,
      forwardedToGoogle: true,
      ipAddress: identifier,
      userAgent: request.headers.get('user-agent') ?? null,
    },
    select: { id: true },
  })

  return NextResponse.json({ id: review.id, success: true }, { headers })
}
