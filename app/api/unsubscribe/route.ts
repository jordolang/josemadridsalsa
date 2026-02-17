import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createHash, createHmac } from 'crypto'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/email/rate-limit'

const UnsubscribeSchema = z.object({
  email: z.string().email(),
  categories: z.array(z.string()).optional(),
  unsubscribeAll: z.boolean().optional(),
})

/** Generate a signed token for email verification */
function generateEmailToken(email: string): string {
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.NEXTAUTH_SECRET || 'fallback-secret'
  return createHmac('sha256', secret).update(email.toLowerCase().trim()).digest('hex').slice(0, 32)
}

/** Verify a signed token for an email */
function verifyEmailToken(email: string, token: string): boolean {
  return generateEmailToken(email) === token
}

export async function POST(request: Request) {
  try {
    // CSRF: verify request origin
    const origin = request.headers.get('origin')
    const host = request.headers.get('host')
    if (origin && host && !origin.includes(host)) {
      return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 })
    }

    // Rate limit
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const { allowed } = checkRateLimit(`unsub:${ip}`, { maxRequests: 10, windowMs: 60_000 })
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
    }

    const payload = await request.json()
    const parsed = UnsubscribeSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid email address.' },
        { status: 400 }
      )
    }

    const { email, categories, unsubscribeAll } = parsed.data
    const normalizedEmail = email.trim().toLowerCase()

    // Atomic upsert instead of find-then-create/update
    await prisma.unsubscribePreference.upsert({
      where: { email: normalizedEmail },
      create: {
        email: normalizedEmail,
        unsubscribeAll: unsubscribeAll ?? false,
        unsubscribedFrom: categories ?? [],
      },
      update: {
        unsubscribeAll: unsubscribeAll ?? undefined,
        unsubscribedFrom: categories ?? undefined,
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unsubscribe error:', error)
    return NextResponse.json(
      { error: 'Unable to process your request. Please try again later.' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    const token = searchParams.get('token')

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required.' },
        { status: 400 }
      )
    }

    // Validate signed token to prevent email enumeration
    if (!token || !verifyEmailToken(email, token)) {
      // Return empty defaults instead of revealing whether email exists
      return NextResponse.json({
        unsubscribeAll: false,
        unsubscribedFrom: [],
      })
    }

    // Rate limit
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const { allowed } = checkRateLimit(`unsub-get:${ip}`, { maxRequests: 20, windowMs: 60_000 })
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const preference = await prisma.unsubscribePreference.findUnique({
      where: { email: normalizedEmail },
    })

    if (!preference) {
      return NextResponse.json({
        unsubscribeAll: false,
        unsubscribedFrom: [],
      })
    }

    return NextResponse.json({
      unsubscribeAll: preference.unsubscribeAll,
      unsubscribedFrom: preference.unsubscribedFrom,
    })
  } catch (error) {
    console.error('Error fetching unsubscribe preference:', error)
    return NextResponse.json(
      { error: 'Unable to fetch preferences.' },
      { status: 500 }
    )
  }
}
