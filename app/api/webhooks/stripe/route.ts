import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import prisma from '@/lib/prisma'
import { sendOrderConfirmationEmail } from '@/lib/email/automation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Stripe webhook handler
export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    )
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set')
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    )
  }

  const stripe = getStripe()
  let event: Stripe.Event

  try {
    // Verify the webhook signature
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    const error = err as Error
    console.error('Webhook signature verification failed:', error.message)
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${error.message}` },
      { status: 400 }
    )
  }

  try {
    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const orderId = paymentIntent.metadata?.orderId

        if (!orderId) {
          console.warn('Payment intent missing orderId in metadata:', paymentIntent.id)
          return NextResponse.json({ received: true })
        }

        // Find the order
        const order = await prisma.order.findUnique({
          where: { id: orderId },
          include: {
            items: true,
            giftCertificates: true,
          },
        })

        if (!order) {
          console.error('Order not found for payment intent:', paymentIntent.id, 'orderId:', orderId)
          return NextResponse.json({ received: true })
        }

        // Skip if already paid
        if (order.paymentStatus === 'PAID') {
          console.log('Order already marked as paid:', orderId)
          return NextResponse.json({ received: true })
        }

        // Update order status
        await prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: order.id },
            data: {
              paymentStatus: 'PAID',
              status: 'CONFIRMED',
              stripePaymentId: paymentIntent.id,
            },
          })

          // Update inventory for product orders (not gift certificates)
          if (order.items.length > 0) {
            await Promise.all(
              order.items.map((item) =>
                tx.product.update({
                  where: { id: item.productId },
                  data: {
                    inventory: { decrement: item.quantity },
                  },
                })
              )
            )
          }

          // Gift certificates are already created, no additional action needed
        })

        console.log('Order payment confirmed via webhook:', orderId)

        if (!order.confirmationEmailSentAt) {
          sendOrderConfirmationEmail(order.id).catch((error) => {
            console.error('Failed to send confirmation email', { orderId, error })
          })
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const orderId = paymentIntent.metadata?.orderId

        if (orderId) {
          await prisma.order.update({
            where: { id: orderId },
            data: {
              paymentStatus: 'FAILED',
            },
          })
          console.log('Order payment failed via webhook:', orderId)
        }
        break
      }

      case 'payment_intent.canceled': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const orderId = paymentIntent.metadata?.orderId

        if (orderId) {
          await prisma.order.update({
            where: { id: orderId },
            data: {
              paymentStatus: 'FAILED',
              status: 'CANCELLED',
            },
          })
          console.log('Order payment canceled via webhook:', orderId)
        }
        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        const orderId = charge.metadata?.orderId

        if (!orderId) {
          console.warn('Skipping refund processing: charge missing orderId in metadata:', charge.id)
          return NextResponse.json({ received: true })
        }

        const isFullRefund = charge.amount_refunded === charge.amount

        // Fetch order with items to restore inventory
        const order = await prisma.order.findUnique({
          where: { id: orderId },
          include: { items: true },
        })

        if (!order) {
          console.error('Order not found for refund:', orderId)
          return NextResponse.json({ received: true })
        }

        await prisma.$transaction(async (tx) => {
          // Update order status
          await tx.order.update({
            where: { id: orderId },
            data: {
              status: isFullRefund ? 'REFUNDED' : order.status,
              paymentStatus: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
            },
          })

          // Restore inventory on full refunds
          if (isFullRefund && order.items.length > 0) {
            await Promise.all(
              order.items.map((item) =>
                tx.product.update({
                  where: { id: item.productId },
                  data: {
                    inventory: { increment: item.quantity },
                  },
                })
              )
            )
          }
        })

        console.log('Order refund processed via webhook:', orderId, isFullRefund ? 'FULL' : 'PARTIAL')
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
