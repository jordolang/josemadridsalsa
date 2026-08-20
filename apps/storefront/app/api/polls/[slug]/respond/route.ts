import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import prisma from '@/lib/prisma'
import { ok, fail, serverError } from '@/lib/api'
import { hashValue } from '@/lib/crypto'
import { checkRateLimit } from '@/lib/email/rate-limit'
import { getCurrentUser } from '@/lib/rbac'
import { pollResponseSchema, validateAnswers } from '@/lib/polls/schemas'
import { canViewPoll, getPollResults, pollWindowState } from '@/lib/polls/queries'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string }> }

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

    const { allowed, retryAfterMs } = checkRateLimit(`poll-response:${ip}`, {
      maxRequests: 5,
      windowMs: 10 * 60 * 1000,
    })
    if (!allowed) {
      return NextResponse.json(
        { error: 'That is a lot of answers in a short time. Please try again in a few minutes.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil((retryAfterMs || 600_000) / 1000)) },
        }
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

    const ipHash = hashValue(`poll:${poll.id}:${ip}`)
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
