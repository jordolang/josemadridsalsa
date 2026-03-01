import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getStripe } from '@/lib/stripe'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'

const PaymentSchema = z.object({
  orderId: z.string().cuid(),
  paymentMethodId: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    // Payment processing requires authentication
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required to process payment' },
        { status: 401 }
      )
    }

    const json = await request.json()
    const parsed = PaymentSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payment payload', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { orderId, paymentMethodId } = parsed.data

    // Look up the order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Verify order belongs to user or user has access
    if (order.userId && order.userId !== user.id) {
      return NextResponse.json(
        { error: 'You do not have permission to pay for this order' },
        { status: 403 }
      )
    }

    // Check if order is already paid
    if (order.paymentStatus === 'PAID') {
      return NextResponse.json(
        { error: 'Order has already been paid' },
        { status: 400 }
      )
    }

    // Check if order is in a payable status
    if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
      return NextResponse.json(
        { error: `Cannot process payment for ${order.status.toLowerCase()} order` },
        { status: 400 }
      )
    }

    const stripe = getStripe()
    const totalInCents = Math.round(Number(order.total) * 100)

    // Create or confirm payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalInCents,
      currency: 'usd',
      payment_method: paymentMethodId,
      confirm: true,
      receipt_email: order.guestEmail ?? user.email ?? undefined,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        userId: user.id,
      },
      return_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/orders/${order.id}`,
    })

    // Update order status based on payment intent status
    let paymentStatus: 'PENDING' | 'PAID' | 'FAILED' = 'PENDING'
    let orderStatus = order.status

    if (paymentIntent.status === 'succeeded') {
      paymentStatus = 'PAID'
      orderStatus = 'CONFIRMED'
    } else if (paymentIntent.status === 'requires_action' || paymentIntent.status === 'requires_payment_method') {
      paymentStatus = 'PENDING'
    } else if (paymentIntent.status === 'canceled') {
      paymentStatus = 'FAILED'
    }

    // Update order in database
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus,
        status: orderStatus,
        stripePaymentId: paymentIntent.id,
      },
    })

    // Log payment processing audit event
    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'update',
        entityType: 'Order',
        entityId: order.id,
        changes: {
          paymentStatus,
          status: orderStatus,
          stripePaymentId: paymentIntent.id,
          orderNumber: order.orderNumber,
          amount: Number(order.total),
        },
      },
      request
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
  } catch (error) {
    console.error('[Payment] Payment processing error:', error)

    // Handle Stripe-specific errors
    if (error && typeof error === 'object' && 'type' in error) {
      const stripeError = error as { type: string; message?: string }
      if (stripeError.type === 'StripeCardError') {
        return NextResponse.json(
          { error: stripeError.message || 'Your card was declined' },
          { status: 402 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Unable to process payment. Please try again.' },
      { status: 500 }
    )
  }
}
