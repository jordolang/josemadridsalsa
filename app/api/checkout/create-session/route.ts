import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getStripe } from '@/lib/stripe'
import prisma from '@/lib/prisma'
import type { CheckoutSessionRequest, CheckoutSessionResponse } from '@/lib/stripe/types'

const CheckoutSessionSchema = z.object({
  orderId: z.string().cuid(),
  successUrl: z.string().optional(),
  cancelUrl: z.string().optional(),
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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Validate successUrl/cancelUrl to prevent open redirect attacks
    if (successUrl && !successUrl.startsWith(appUrl) && !successUrl.startsWith('/')) {
      return NextResponse.json(
        { error: 'Invalid success URL: must be a relative path or start with the app URL' },
        { status: 400 }
      )
    }
    if (cancelUrl && !cancelUrl.startsWith(appUrl) && !cancelUrl.startsWith('/')) {
      return NextResponse.json(
        { error: 'Invalid cancel URL: must be a relative path or start with the app URL' },
        { status: 400 }
      )
    }

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
    if (order.paymentStatus === 'SUCCEEDED') {
      return NextResponse.json(
        { error: 'Order has already been paid' },
        { status: 400 }
      )
    }

    // Idempotency: return existing active session if one already exists for this order
    const stripe = getStripe()

    const existingPayment = await prisma.payment.findFirst({
      where: {
        orderId: order.id,
        status: 'PENDING',
        stripeCheckoutSessionId: { not: null },
      },
    })

    if (existingPayment?.stripeCheckoutSessionId) {
      const existingSession = await stripe.checkout.sessions.retrieve(
        existingPayment.stripeCheckoutSessionId
      )
      if (existingSession.status === 'open') {
        return NextResponse.json({
          sessionId: existingSession.id,
          url: existingSession.url,
        } as CheckoutSessionResponse)
      }
    }

    // Get customer email
    const customerEmail = order.guestEmail || order.user?.email

    // Convert total from Decimal to number and then to cents
    const totalInCents = Math.round(Number(order.total) * 100)

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

    // Create pending payment record (stripePaymentIntentId is null until populated by webhook)
    await prisma.payment.create({
      data: {
        orderId: order.id,
        stripeCheckoutSessionId: session.id,
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
