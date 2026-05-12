import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { getStripe } from '@/lib/stripe'
import { prisma as db } from '@/lib/prisma'
import { rateLimit } from '@/lib/rateLimit'

const PaymentPayload = z.object({
  orderId: z.string().cuid(),
})

/**
 * POST /api/payment
 *
 * Retrieves the PaymentIntent client secret for an existing order.
 * The client uses this secret to confirm payment with Stripe.js.
 * Order status updates are handled by the Stripe webhook.
 */
export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(`payment:${ip}`, 10, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    )
  }

  const parsed = PaymentPayload.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid request' },
      { status: 422 },
    )
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 },
    )
  }

  const { orderId } = parsed.data
  const userId = session.user.id

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      stripePaymentId: true,
    },
  })

  if (!order) {
    return NextResponse.json(
      { success: false, error: 'Order not found' },
      { status: 404 },
    )
  }

  if (order.userId !== userId) {
    return NextResponse.json(
      { success: false, error: 'You do not have permission to pay for this order' },
      { status: 403 },
    )
  }

  if (order.paymentStatus === 'PAID') {
    return NextResponse.json(
      { success: false, error: 'Order has already been paid' },
      { status: 400 },
    )
  }

  if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
    return NextResponse.json(
      { success: false, error: `Cannot process payment for ${order.status.toLowerCase()} order` },
      { status: 400 },
    )
  }

  if (!order.stripePaymentId) {
    return NextResponse.json(
      { success: false, error: 'No payment intent found for this order' },
      { status: 400 },
    )
  }

  try {
    const stripe = getStripe()
    const paymentIntent = await stripe.paymentIntents.retrieve(
      order.stripePaymentId,
    )

    return NextResponse.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: 'Unable to retrieve payment intent' },
      { status: 500 },
    )
  }
}
