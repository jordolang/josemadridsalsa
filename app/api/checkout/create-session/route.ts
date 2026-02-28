import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getStripe } from '@/lib/stripe'
import prisma from '@/lib/prisma'
import type { CheckoutSessionRequest, CheckoutSessionResponse } from '@/lib/stripe/types'

const CheckoutSessionSchema = z.object({
  orderId: z.string().cuid(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
})

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const parsed = CheckoutSessionSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid checkout session request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { orderId, successUrl, cancelUrl } = parsed.data

    // Fetch order with items
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        user: true,
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Check if order is already paid
    if (order.paymentStatus === 'PAID') {
      return NextResponse.json(
        { error: 'Order has already been paid' },
        { status: 400 }
      )
    }

    // Get customer email
    const customerEmail = order.guestEmail || order.user?.email

    // Create Stripe checkout session
    const stripe = getStripe()

    // Convert total from Decimal to number and then to cents
    const totalInCents = Math.round(Number(order.total) * 100)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Order #${order.orderNumber}`,
              description: `${order.items.length} item(s)`,
            },
            unit_amount: totalInCents,
          },
          quantity: 1,
        },
      ],
      customer_email: customerEmail || undefined,
      success_url: successUrl || `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${appUrl}/checkout/cancel`,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
      },
    })

    // Create pending payment record
    await prisma.payment.create({
      data: {
        orderId: order.id,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: '', // Will be populated by webhook
        amount: totalInCents,
        currency: 'usd',
        status: 'PENDING',
        metadata: {
          orderNumber: order.orderNumber,
          itemCount: order.items.length,
        },
      },
    })

    const response: CheckoutSessionResponse = {
      sessionId: session.id,
      url: session.url,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Checkout session creation error:', error)
    return NextResponse.json(
      { error: 'Unable to create checkout session. Please try again.' },
      { status: 500 }
    )
  }
}
