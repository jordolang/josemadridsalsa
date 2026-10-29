import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'
import { sendExistingAccountSignupEmail, sendWelcomeEmail } from '@/lib/email/automation'
import { maskEmail } from '@/lib/auth/sign-in-throttle'
import {
  checkRateLimit,
  createRateLimitHeaders,
  getClientIdentifier,
  RATE_LIMITS,
} from '@/lib/rate-limiter'
import { logEngagementRequest } from '@/lib/engagements'
import { emitDomainEvent } from '@/lib/domain-events/emit'
import { attachReferrerFromCookie } from '@/lib/referrals'

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(120).optional(),
})

export async function POST(request: Request) {
  try {
    // Checked directly rather than with withRateLimit, whose mobile-app user-agent
    // bypass any client can claim.
    const limit = await checkRateLimit({
      identifier: `auth:register:${getClientIdentifier(request)}`,
      maxRequests: RATE_LIMITS.AUTH_REGISTER.maxRequests,
      windowSeconds: RATE_LIMITS.AUTH_REGISTER.windowSeconds,
    })
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many sign-up attempts. Please try again later.' },
        { status: 429, headers: createRateLimitHeaders(limit) }
      )
    }

    const body = await request.json()
    const parsed = RegisterSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid registration data.',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }

    const { email, password, name } = parsed.data
    const normalizedEmail = email.toLowerCase().trim()

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    })

    // Answer exactly as for a new account, and spend the same bcrypt and email work,
    // so sign-up cannot be used to test which emails have an account. The owner hears
    // about it by email instead, at most once a day so it can't be used to spam them.
    if (existingUser) {
      console.warn('[Register] Sign-up for an existing account:', maskEmail(normalizedEmail))
      await bcrypt.hash(password, 12)
      const notice = await checkRateLimit({
        identifier: `auth:register:existing:${normalizedEmail}`,
        maxRequests: RATE_LIMITS.AUTH_EXISTING_ACCOUNT_NOTICE.maxRequests,
        windowSeconds: RATE_LIMITS.AUTH_EXISTING_ACCOUNT_NOTICE.windowSeconds,
      })
      if (notice.allowed) {
        await Promise.allSettled([sendExistingAccountSignupEmail({ email: normalizedEmail })])
      }
      return NextResponse.json({ success: true }, { status: 201 })
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name,
        password: hashedPassword,
        role: 'CUSTOMER',
      },
    })

    await attachReferrerFromCookie(user.id)

    // The customer identity here is the `User` row: `Customer` is a CRM rollup keyed by
    // email that may not exist yet for a brand-new account, so the payload carries the
    // email for a consumer that needs to resolve one.
    await emitDomainEvent({
      type: 'customer.created',
      entityType: 'customer',
      entityId: user.id,
      actorUserId: user.id,
      payload: { email: normalizedEmail, name, via: 'password-registration' },
    })

    await Promise.allSettled([
      sendWelcomeEmail({ email: normalizedEmail, name }),
      logEngagementRequest({
        type: 'SIGNUP',
        email: normalizedEmail,
        name,
        source: 'auth:register',
        metadata: { channel: 'web' },
      }),
    ])

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Unable to create account. Please try again.' },
      { status: 500 }
    )
  }
}
