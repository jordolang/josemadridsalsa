import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'
import { sendWelcomeEmail } from '@/lib/email/automation'
import { logEngagementRequest } from '@/lib/engagements'
import { emitDomainEvent } from '@/lib/domain-events/emit'

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(120).optional(),
})

export async function POST(request: Request) {
  try {
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

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists.' },
        { status: 409 }
      )
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
