import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/email/rate-limit'
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe-url'

const UnsubscribeSchema = z.object({
  email: z.string().email(),
  categories: z.array(z.string()).optional(),
  unsubscribeAll: z.boolean().optional(),
})

const OneClickSchema = z.object({
  email: z.string().email(),
  token: z.string().min(1),
  action: z.literal('One-Click'),
})

// ponytail: in-memory per instance, like checkRateLimit; move to a shared store if abuse spans instances.
const ONE_CLICK_FAILURE_LIMIT = 20
const oneClickFailures = new Map<string, { count: number; resetAt: number }>()

function isOneClickBlocked(ip: string): boolean {
  const entry = oneClickFailures.get(ip)
  return Boolean(entry && Date.now() < entry.resetAt && entry.count >= ONE_CLICK_FAILURE_LIMIT)
}

function recordOneClickFailure(ip: string) {
  const now = Date.now()
  const entry = oneClickFailures.get(ip)
  if (!entry || now >= entry.resetAt) oneClickFailures.set(ip, { count: 1, resetAt: now + 60_000 })
  else entry.count++
}

export async function POST(request: Request) {
  try {
    // CSRF: verify request origin
    const origin = request.headers.get('origin')
    const host = request.headers.get('host')
    if (origin && host && !origin.includes(host)) {
      return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 })
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

    // RFC 8058 one-click: the mailbox provider POSTs a form body to the List-Unsubscribe URL,
    // which carries the address and its signed token. No page, no JSON, so handle it first.
    if (request.headers.get('content-type')?.includes('application/x-www-form-urlencoded')) {
      // Mailbox providers share IPs, so valid requests are limited per recipient below. Invalid
      // ones are capped per IP before any work, so forged links can't be sent without bound.
      if (isOneClickBlocked(ip)) {
        return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
      }
      const { searchParams } = new URL(request.url)
      const oneClick = OneClickSchema.safeParse({
        email: searchParams.get('email'),
        token: searchParams.get('token'),
        action: new URLSearchParams(await request.text()).get('List-Unsubscribe'),
      })
      if (!oneClick.success || !verifyUnsubscribeToken(oneClick.data.email, oneClick.data.token)) {
        recordOneClickFailure(ip)
        return NextResponse.json({ error: 'Invalid unsubscribe link.' }, { status: 400 })
      }
      const oneClickEmail = oneClick.data.email.trim().toLowerCase()
      // Keyed by recipient, not IP: Gmail and Yahoo send these from shared provider addresses, so
      // an IP limit would refuse unrelated recipients' valid requests.
      if (!checkRateLimit(`unsub-oneclick:${oneClickEmail}`, { maxRequests: 10, windowMs: 60_000 }).allowed) {
        return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
      }
      await prisma.unsubscribePreference.upsert({
        where: { email: oneClickEmail },
        create: { email: oneClickEmail, unsubscribeAll: true, unsubscribedFrom: [] },
        update: { unsubscribeAll: true, updatedAt: new Date() },
      })
      return NextResponse.json({ success: true })
    }

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
    if (!token || !verifyUnsubscribeToken(email, token)) {
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
