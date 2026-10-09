import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import {
  checkRateLimit,
  createRateLimitHeaders,
  getClientIdentifier,
  RATE_LIMITS,
} from '@/lib/rate-limiter'
import { averageRating, siteFeedbackSchema } from '@/lib/site-feedback'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const identifier = getClientIdentifier(request)
  const rateLimit = await checkRateLimit({
    ...RATE_LIMITS.API_GENERAL,
    maxRequests: 5,
    windowSeconds: 60,
    identifier: `site-feedback:${identifier}`,
  })
  const headers = createRateLimitHeaders(rateLimit)

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many submissions. Please try again shortly.' },
      { status: 429, headers: { ...headers, 'Retry-After': rateLimit.resetIn.toString() } },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400, headers })
  }

  const parsed = siteFeedbackSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? 'Invalid feedback.',
        details: parsed.error.flatten(),
      },
      { status: 400, headers },
    )
  }

  const { ratings, comment, name, email, source } = parsed.data

  const feedback = await prisma.siteFeedback.create({
    data: {
      ratings: ratings as Prisma.InputJsonValue,
      averageRating: averageRating(ratings),
      comment: comment || null,
      name: name || null,
      email: email || null,
      source: source ?? null,
      ipAddress: identifier,
      userAgent: request.headers.get('user-agent') ?? null,
    },
    select: { id: true },
  })

  return NextResponse.json({ id: feedback.id, success: true }, { headers })
}
