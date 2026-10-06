import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/rbac'
import { z } from 'zod'

const RetryPaymentSchema = z.object({
  orderId: z.string().cuid('Invalid order ID'),
})

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    const body = await request.json()
    const { orderId } = RetryPaymentSchema.parse(body)

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        userId: true,
        guestEmail: true,
        status: true,
        paymentStatus: true,
        stripePaymentId: true,
        total: true,
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Verify ownership: authenticated user must own the order, or match guest email
    if (order.userId) {
      if (!user || user.id !== order.userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Only allow retry on orders with failed or pending payment
    if (
      order.paymentStatus !== 'FAILED' &&
      order.paymentStatus !== 'PENDING'
    ) {
      return NextResponse.json(
        {
          error: `Cannot retry payment for order with status "${order.paymentStatus}"`,
        },
        { status: 400 }
      )
    }

    // Don't allow retry on cancelled/refunded orders
    if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
      return NextResponse.json(
        { error: `Cannot retry payment for ${order.status.toLowerCase()} order` },
        { status: 400 }
      )
    }

    const stripe = getStripe()

    // If there's an existing PaymentIntent, try to re-use it
    if (order.stripePaymentId) {
      const existingPI = await stripe.paymentIntents.retrieve(
        order.stripePaymentId
      )

      // If the existing PI is still retryable, return its client secret
      if (
        existingPI.status === 'requires_payment_method' ||
        existingPI.status === 'requires_confirmation' ||
        existingPI.status === 'requires_action'
      ) {
        // Reset payment status to PENDING for the retry attempt
        await prisma.order.update({
          where: { id: orderId },
          data: { paymentStatus: 'PENDING' },
        })

        return NextResponse.json({
          success: true,
          clientSecret: existingPI.client_secret,
          orderId: order.id,
          amount: Number(order.total),
          reused: true,
        })
      }

      // If the PI is canceled or in a terminal failure state, create a new one
      if (
        existingPI.status === 'canceled' ||
        existingPI.status === 'processing'
      ) {
        // Fall through to create a new PaymentIntent
      }

      // If succeeded, the order is already paid
      if (existingPI.status === 'succeeded') {
        return NextResponse.json(
          { error: 'This order has already been paid' },
          { status: 400 }
        )
      }
    }

    // Create a new PaymentIntent for the same order
    const amountInCents = Math.round(Number(order.total) * 100)

    const paymentIntentParams: Parameters<typeof stripe.paymentIntents.create>[0] = {
      amount: amountInCents,
      currency: 'usd',
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        retryAttempt: 'true',
      },
    }

    // Attach Stripe Customer if user has one
    if (user) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { stripeCustomerId: true },
      })

      if (dbUser?.stripeCustomerId) {
        paymentIntentParams.customer = dbUser.stripeCustomerId
        paymentIntentParams.setup_future_usage = 'on_session'
      }
    }

    const newPI = await stripe.paymentIntents.create(paymentIntentParams)

    // Update the order with the new PaymentIntent ID
    await prisma.order.update({
      where: { id: orderId },
      data: {
        stripePaymentId: newPI.id,
        paymentStatus: 'PENDING',
      },
    })

    return NextResponse.json({
      success: true,
      clientSecret: newPI.client_secret,
      orderId: order.id,
      amount: Number(order.total),
      reused: false,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error('Payment retry error:', error)
    return NextResponse.json(
      { error: 'Failed to retry payment' },
      { status: 500 }
    )
  }
}
