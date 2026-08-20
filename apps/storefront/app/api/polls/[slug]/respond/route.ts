import { createHmac } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import prisma from '@/lib/prisma'
import { ok, fail, serverError } from '@/lib/api'
import { checkRateLimit } from '@/lib/rate-limit/distributed'
import { getCurrentUser } from '@/lib/rbac'
import { pollResponseSchema, validateAnswers } from '@/lib/polls/schemas'
import { canViewPoll, getPollResults, pollWindowState } from '@/lib/polls/queries'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string }> }

/**
 * The stored form of a respondent's IP.
 *
 * Keyed with a server secret rather than a plain digest: the IPv4 space is
 * small enough that a bare SHA-256 of a known poll id and an address can be
 * enumerated back to the address by anyone holding a database dump. HMAC with a
 * secret that never leaves the server makes the stored value useless without
 * it, while still matching for the repeat-submission check.
 */
function hashAddress(pollId: string, ip: string): string {
  const secret = process.env.MASTER_KEY ?? process.env.NEXTAUTH_SECRET ?? ''
  return createHmac('sha256', secret).update(`poll:${pollId}:${ip}`).digest('hex')
}

/**
 * POST /api/polls/[slug]/respond
 *
 * Public endpoint. Anyone may answer a published public poll — signed in or
 * not — while an invite-only poll additionally needs the access code from its
 * share link. Rate limited to 5 submissions per IP per 10 minutes.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { slug } = await ctx.params
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

    // The distributed limiter, so the five-per-window budget is shared across
    // serverless instances rather than reset by every cold start.
    const { allowed, resetIn } = await checkRateLimit({
      identifier: `poll-response:${ip}`,
      maxRequests: 5,
      windowSeconds: 10 * 60,
    })
    if (!allowed) {
      return NextResponse.json(
        { error: 'That is a lot of answers in a short time. Please try again in a few minutes.' },
        { status: 429, headers: { 'Retry-After': String(Math.max(resetIn, 1)) } }
      )
    }

    const body = pollResponseSchema.parse(await req.json())

    // Honeypot: a real browser leaves this hidden field empty. Answer 200 so a
    // bot cannot tell it was caught, but store nothing.
    if (body.website && body.website.trim() !== '') {
      return ok({ success: true })
    }

    const poll = await prisma.poll.findUnique({
      where: { slug },
      include: {
        questions: {
          orderBy: { sortOrder: 'asc' },
          include: { options: { select: { id: true }, orderBy: { sortOrder: 'asc' } } },
        },
      },
    })

    if (!poll || !canViewPoll(poll, body.accessCode)) {
      return fail('That poll is not available', 404)
    }

    const windowState = pollWindowState(poll)
    if (windowState !== 'OPEN') {
      return fail(
        windowState === 'NOT_STARTED'
          ? 'This poll has not opened yet'
          : 'This poll has closed. Thank you for your interest!',
        409
      )
    }

    // The form requires the acknowledgement checkbox; enforce it here too, so a
    // response we might quote publicly always carries a real acknowledgement.
    if (!body.consentAcknowledged) {
      return fail(
        'Please confirm you have read how your answers may be used before sending them.',
        422
      )
    }

    const errors = validateAnswers(poll.questions, body.answers)
    if (errors.length > 0) {
      return fail(errors[0].message, 422, { errors })
    }

    const ipHash = hashAddress(poll.id, ip)
    if (!poll.allowMultipleSubmissions && ip !== 'unknown') {
      const already = await prisma.pollResponse.findFirst({
        where: { pollId: poll.id, ipHash },
        select: { id: true },
      })
      if (already) {
        return fail('It looks like this device has already answered this poll.', 409)
      }
    }

    const user = await getCurrentUser().catch(() => null)

    // Keep only what the question actually asked for. Without this a crafted
    // request could attach `textValue` to a multiple-choice question, and the
    // results page would publish it as a quoted comment.
    const answersToStore = body.answers
      .map((answer) => {
        const question = poll.questions.find((candidate) => candidate.id === answer.questionId)
        if (!question) return null

        const isChoice = question.type === 'SINGLE_CHOICE' || question.type === 'MULTI_CHOICE'
        const isText = question.type === 'SHORT_TEXT' || question.type === 'LONG_TEXT'

        const optionIds = isChoice ? answer.optionIds : []
        const textValue = isText ? answer.textValue?.trim() || null : null
        const otherText = isChoice && question.allowOther ? answer.otherText?.trim() || null : null
        const rating = question.type === 'RATING' ? (answer.rating ?? null) : null

        if (optionIds.length === 0 && !textValue && !otherText && rating == null) {
          return null
        }
        return { questionId: answer.questionId, optionIds, textValue, otherText, rating }
      })
      .filter((answer): answer is NonNullable<typeof answer> => answer !== null)

    await prisma.$transaction([
      prisma.pollResponse.create({
        data: {
          pollId: poll.id,
          firstName: body.firstName.trim(),
          lastName: body.lastName?.trim() || null,
          // The poll decides whether an email is collected at all; a direct
          // caller does not get to store one the form never offered.
          email: poll.collectEmail ? body.email?.trim() || null : null,
          anonymousRequested: body.anonymousRequested,
          consentAcknowledged: body.consentAcknowledged,
          userId: user?.id ?? null,
          ipHash,
          userAgent: req.headers.get('user-agent')?.slice(0, 500) ?? null,
          answers: { create: answersToStore },
        },
      }),
      prisma.poll.update({
        where: { id: poll.id },
        data: { responseCount: { increment: 1 } },
      }),
    ])

    const showResults = poll.resultsVisibility !== 'HIDDEN'
    return ok({
      success: true,
      thankYouMessage: poll.thankYouMessage,
      results: showResults ? await getPollResults(poll.id) : null,
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return fail(error.issues[0]?.message ?? 'Please check your answers', 422)
    }
    return serverError('Could not record your answers', error)
  }
}
