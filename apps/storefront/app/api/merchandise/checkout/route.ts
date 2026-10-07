import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/email/rate-limit'
import { createMerchCheckout, MerchCheckoutError, merchCheckoutSchema } from '@/lib/merchandise/orders'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/merchandise/checkout
 * Public. Starts a merch purchase and returns the Square payment link to redirect to.
 * Rate limited to 10 per IP per 5 minutes: each call creates a Square order.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { allowed, retryAfterMs } = checkRateLimit(`merch-checkout:${ip}`, {
    maxRequests: 10,
    windowMs: 5 * 60 * 1000,
  })
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((retryAfterMs || 300_000) / 1000)) } }
    )
  }

  const parsed = merchCheckoutSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Choose a size and quantity.' }, { status: 400 })
  }

  try {
    const { url } = await createMerchCheckout(parsed.data, req.nextUrl.origin)
    return NextResponse.json({ url })
  } catch (error) {
    if (error instanceof MerchCheckoutError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Merch checkout failed', error)
    return NextResponse.json({ error: 'Checkout is not available right now.' }, { status: 500 })
  }
}
