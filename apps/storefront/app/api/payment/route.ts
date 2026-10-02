import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { getStripe } from '@/lib/stripe'
import { prisma as db } from '@/lib/prisma'
import { rateLimit } from '@/lib/rateLimit'
import { logAuditWithRequest } from '@/lib/audit'

const PaymentPayload = z.object({
  orderId: z.string().cuid(),
  paymentMethodId: z.string().min(1),
})

/**
 * POST /api/payment
 *
 * Confirms payment for an existing order using Stripe PaymentIntents.
 * Updates order status after successful payment confirmation.
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
      { success: false, error: 'Invalid payment payload' },
      { status: 422 },
    )
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Authentication required to process payment' },
      { status: 401 },
    )
  }

  const { orderId, paymentMethodId } = parsed.data
  const userId = session.user.id

  let order
  try {
    order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        stripePaymentId: true,
        total: true,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Database error:', message)
    return NextResponse.json(
      { success: false, error: 'Unable to process payment. Please try again.' },
      { status: 500 },
    )
  }

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
      { status: 422 },
    )
  }

  if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
    return NextResponse.json(
      { success: false, error: `Cannot process payment for ${order.status.toLowerCase()} order` },
      { status: 422 },
    )
  }

  if (!order.stripePaymentId) {
    return NextResponse.json(
      { success: false, error: 'No payment intent found for this order' },
      { status: 422 },
    )
  }

  try {
    const stripe = getStripe()

    // Get origin for return URL
    const origin =
      process.env.APP_URL ??
      req.headers.get('origin') ??
      new URL(req.url).origin

    const paymentIntent = await stripe.paymentIntents.confirm(
      order.stripePaymentId,
      {
        payment_method: paymentMethodId,
        return_url: `${origin}/order-confirmation/${orderId}`,
      }
    )

    // Determine order status based on payment intent status
    let newPaymentStatus: 'PAID' | 'PENDING' | 'FAILED' = 'PENDING'
    let newOrderStatus: 'CONFIRMED' | 'PENDING' | 'CANCELLED' = 'PENDING'

    if (paymentIntent.status === 'succeeded') {
      newPaymentStatus = 'PAID'
      newOrderStatus = 'CONFIRMED'
    } else if (paymentIntent.status === 'canceled') {
      newPaymentStatus = 'FAILED'
      newOrderStatus = 'CANCELLED'
    }

    // Update order status after payment confirmation
    const updatedOrder = await db.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: newPaymentStatus,
        status: newOrderStatus,
        stripePaymentId: paymentIntent.id,
      },
    })

    // Log audit event
    await logAuditWithRequest(
      {
        userId,
        action: 'update',
        entityType: 'Order',
        entityId: orderId,
        changes: {
          paymentStatus: newPaymentStatus,
          status: newOrderStatus,
          orderNumber: order.orderNumber,
          amount: Number(order.total),
        },
      },
      req,
    )

    return NextResponse.json({
      success: true,
      paymentIntent: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        clientSecret: paymentIntent.client_secret,
      },
      order: {
        id: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        paymentStatus: updatedOrder.paymentStatus,
        status: updatedOrder.status,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Payment confirmation failed:', message)

    // Check if it's a Stripe card error
    if (err && typeof err === 'object' && 'type' in err) {
      const stripeError = err as { type: string; code?: string; message?: string; decline_code?: string }

      if (stripeError.type === 'StripeCardError' || stripeError.type === 'card_error') {
        return NextResponse.json(
          { success: false, error: stripeError.message ?? 'Your card was declined' },
          { status: 402 },
        )
      }
    }

    return NextResponse.json(
      { success: false, error: 'Unable to process payment. Please try again.' },
      { status: 500 },
    )
  }
}
