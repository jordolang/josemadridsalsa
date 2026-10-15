import { NextResponse } from 'next/server'
import {
  checkRateLimit,
  createRateLimitHeaders,
  getClientIdentifier,
  RATE_LIMITS,
} from '@/lib/rate-limiter'
import { createOrderAccessToken } from '@/lib/orders/access-token'
import { orderLookupSchema, phoneMatchesOrder } from '@/lib/order-tracking/lookup'
import { findOrderByTrackingNumber, findOrderForLookup } from '@/lib/order-tracking/load'

export const runtime = 'nodejs'

// One message for every miss, so the form can't be used to learn which order numbers exist.
const NOT_FOUND = "We couldn't find an order matching those details. Check them and try again."

/**
 * Resolve a public order-tracking lookup to the page that shows it.
 *
 * Order number + phone returns the full, token-gated order page. A tracking number alone
 * returns the shipment-only page, which never shows emails, notes or items.
 */
export async function POST(request: Request) {
  const identifier = getClientIdentifier(request)
  const rateLimit = await checkRateLimit({
    ...RATE_LIMITS.API_GENERAL,
    maxRequests: 10,
    windowSeconds: 600,
    identifier: `order-tracking-lookup:${identifier}`,
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

  const parsed = orderLookupSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Check the details and try again.' },
      { status: 400, headers }
    )
  }

  const input = parsed.data

  if (input.method === 'tracking') {
    const order = await findOrderByTrackingNumber(input.trackingNumber)
    if (!order) return NextResponse.json({ error: NOT_FOUND }, { status: 404, headers })
    return NextResponse.json({ url: `/track/${encodeURIComponent(input.trackingNumber)}` }, { headers })
  }

  const order = await findOrderForLookup(input.orderNumber)
  const matches =
    order &&
    phoneMatchesOrder(input.phone, [
      order.guestPhone,
      order.user?.phone,
      order.shippingAddress?.phone,
      order.billingAddress?.phone,
    ])

  if (!order || !matches) {
    return NextResponse.json({ error: NOT_FOUND }, { status: 404, headers })
  }

  const token = createOrderAccessToken(order.id)
  return NextResponse.json(
    { url: `/order-tracking/${encodeURIComponent(order.orderNumber)}?token=${token}` },
    { headers }
  )
}
