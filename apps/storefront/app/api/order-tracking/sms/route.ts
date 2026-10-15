import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import {
  checkRateLimit,
  createRateLimitHeaders,
  getClientIdentifier,
  RATE_LIMITS,
} from '@/lib/rate-limiter'
import { verifyOrderAccessToken } from '@/lib/orders/access-token'
import { SMS_CONSENT_TEXT, smsSignupSchema, toE164 } from '@/lib/order-tracking/lookup'
import { smsAlertsEnabled } from '@/lib/order-tracking/sms'

export const runtime = 'nodejs'

/** Opt a phone number in to text alerts for one order, recording the consent given. */
export async function POST(request: Request) {
  if (!smsAlertsEnabled()) {
    return NextResponse.json({ error: 'Text alerts are not available yet.' }, { status: 404 })
  }

  const identifier = getClientIdentifier(request)
  const rateLimit = await checkRateLimit({
    ...RATE_LIMITS.API_GENERAL,
    maxRequests: 5,
    windowSeconds: 600,
    identifier: `order-tracking-sms:${identifier}`,
  })
  const headers = createRateLimitHeaders(rateLimit)

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a few minutes and try again.' },
      { status: 429, headers: { ...headers, 'Retry-After': rateLimit.resetIn.toString() } }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400, headers })
  }

  const parsed = smsSignupSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Check the details and try again.' },
      { status: 400, headers }
    )
  }

  const { orderNumber, token, phone } = parsed.data
  const order = await prisma.order.findFirst({
    where: { orderNumber: { equals: orderNumber, mode: 'insensitive' } },
    select: { id: true },
  })
  if (!order || !verifyOrderAccessToken(order.id, token)) {
    return NextResponse.json({ error: 'This link has expired. Look up your order again.' }, { status: 403, headers })
  }

  // The schema already rejected numbers without ten digits.
  const e164 = toE164(phone) as string
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null

  await prisma.orderSmsSubscription.upsert({
    where: { orderId_phone: { orderId: order.id, phone: e164 } },
    create: { orderId: order.id, phone: e164, consentText: SMS_CONSENT_TEXT, ipAddress },
    update: { consentText: SMS_CONSENT_TEXT, consentedAt: new Date(), ipAddress, unsubscribedAt: null },
  })

  return NextResponse.json({ subscribed: true }, { headers })
}
