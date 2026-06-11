import { NextRequest, NextResponse } from 'next/server'
import { ok, fail, serverError } from '@/lib/api'
import { developerContactSchema } from '@/lib/developer/schemas'
import { checkRateLimit } from '@/lib/email/rate-limit'
import { sendEmail } from '@/lib/email/client'
import { ContactFormEmail } from '@/emails/contact-form'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/developer/contact
 * Public endpoint — receives contact form submissions from the developer page.
 * Rate limited to 3 requests per IP per 5 minutes.
 * Stores the submission in the database and sends an email notification.
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limit by IP — 3 requests per 5 minutes
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const { allowed, retryAfterMs } = checkRateLimit(`dev-contact:${ip}`, {
      maxRequests: 3,
      windowMs: 5 * 60 * 1000,
    })

    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil((retryAfterMs || 300_000) / 1000)) },
        }
      )
    }

    const body = await req.json()
    const parsed = developerContactSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return fail(`Validation error: ${firstError.message}`)
    }

    const { name, email, subject, message } = parsed.data

    // Store submission in database
    const submission = await prisma.contactSubmission.create({
      data: { name, email, subject, message, ip },
    })

    // Send email notification (best-effort — don't fail the request if email fails)
    try {
      await sendEmail({
        to: 'mike@josemadridsalsa.com',
        subject: `[Developer Page] ${subject}`,
        react: ContactFormEmail({
          name,
          email,
          message,
          submittedAt: new Date().toISOString(),
        }),
        type: 'developer-contact',
        replyTo: email,
      })
    } catch (emailError: unknown) {
      // Log but don't fail — submission is already stored
      console.error('Failed to send developer contact notification email:', emailError)
    }

    return ok({ sent: true, id: submission.id }, 201)
  } catch (error: unknown) {
    return serverError('Failed to process contact submission', error)
  }
}
