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
    console.error('CRITICAL: STRIPE_WEBHOOK_SECRET is not set')
    return NextResponse.json(
      { error: 'Service unavailable' },
      { status: 503 }
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
    // Idempotency check: prevent duplicate processing of the same webhook event
    const existingWebhookEvent = await prisma.webhookEvent.findUnique({
      where: { stripeEventId: event.id },
    })

    if (existingWebhookEvent?.processed) {
      console.log('Webhook event already processed, skipping:', event.id)
      return NextResponse.json({ received: true })
    }

    // Create webhook event record (or update if exists but not processed)
    await prisma.webhookEvent.upsert({
      where: { stripeEventId: event.id },
      create: {
        stripeEventId: event.id,
        type: event.type,
        processed: false,
      },
      update: {
        type: event.type,
      },
    })

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
        if (order.paymentStatus === 'SUCCEEDED') {
          console.log('Order already marked as paid:', orderId)
          return NextResponse.json({ received: true })
        }

        // Update order status and payment record
        await prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: order.id },
            data: {
              paymentStatus: 'SUCCEEDED',
              status: 'CONFIRMED',
              stripePaymentId: paymentIntent.id,
            },
          })

          // Update or create Payment record
          await tx.payment.upsert({
            where: { stripePaymentIntentId: paymentIntent.id },
            create: {
              stripePaymentIntentId: paymentIntent.id,
              orderId: order.id,
              amount: paymentIntent.amount,
              currency: paymentIntent.currency,
              status: 'SUCCEEDED',
              paymentMethod: paymentIntent.payment_method_types?.[0],
            },
            update: {
              status: 'SUCCEEDED',
              paymentMethod: paymentIntent.payment_method_types?.[0],
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
          await prisma.$transaction(async (tx) => {
            await tx.order.update({
              where: { id: orderId },
              data: {
                paymentStatus: 'FAILED',
              },
            })

            // Update Payment record
            await tx.payment.upsert({
              where: { stripePaymentIntentId: paymentIntent.id },
              create: {
                stripePaymentIntentId: paymentIntent.id,
                orderId,
                amount: paymentIntent.amount,
                currency: paymentIntent.currency,
                status: 'FAILED',
                paymentMethod: paymentIntent.payment_method_types?.[0],
              },
              update: {
                status: 'FAILED',
              },
            })
          })
          console.log('Order payment failed via webhook:', orderId)
        }
        break
      }

      case 'payment_intent.canceled': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const orderId = paymentIntent.metadata?.orderId

        if (orderId) {
          await prisma.$transaction(async (tx) => {
            await tx.order.update({
              where: { id: orderId },
              data: {
                paymentStatus: 'FAILED',
                status: 'CANCELLED',
              },
            })

            // Update Payment record
            await tx.payment.upsert({
              where: { stripePaymentIntentId: paymentIntent.id },
              create: {
                stripePaymentIntentId: paymentIntent.id,
                orderId,
                amount: paymentIntent.amount,
                currency: paymentIntent.currency,
                status: 'CANCELED',
                paymentMethod: paymentIntent.payment_method_types?.[0],
              },
              update: {
                status: 'CANCELED',
              },
            })
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
        const stripeRefund = charge.refunds?.data[0]

        if (!stripeRefund) {
          console.warn('Skipping refund processing: no refund found in charge:', charge.id)
          return NextResponse.json({ received: true })
        }

        // Fetch order with items to restore inventory
        const order = await prisma.order.findUnique({
          where: { id: orderId },
          include: { items: true },
        })

        if (!order) {
          console.error('Order not found for refund:', orderId)
          return NextResponse.json({ received: true })
        }

        // Find the payment record
        const payment = await prisma.payment.findFirst({
          where: { orderId },
        })

        if (!payment) {
          console.error('Payment not found for order:', orderId)
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

          // Update payment status
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
            },
          })

          // Create refund record
          await tx.refund.upsert({
            where: { stripeRefundId: stripeRefund.id },
            create: {
              stripeRefundId: stripeRefund.id,
              paymentId: payment.id,
              amount: stripeRefund.amount,
              reason: stripeRefund.reason || undefined,
              status: 'SUCCEEDED',
            },
            update: {
              status: 'SUCCEEDED',
            },
          })

          // Restore inventory on full refunds only
          // Note: Partial refunds do not restore inventory as they may not correspond to specific items being returned.
          // For partial refunds, inventory must be manually adjusted by an administrator.
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

          // Create audit log entry to track this refund processing
          await tx.auditLog.create({
            data: {
              action: 'webhook.refund',
              entityType: 'order',
              entityId: orderId,
              changes: {
                refundId: stripeRefund.id,
                chargeId: charge.id,
                isFullRefund,
                amountRefunded: charge.amount_refunded,
                inventoryRestored: isFullRefund && order.items.length > 0,
              },
            },
          })
        })

        console.log('Order refund processed via webhook:', orderId, isFullRefund ? 'FULL' : 'PARTIAL')
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    // Mark webhook event as processed
    await prisma.webhookEvent.update({
      where: { stripeEventId: event.id },
      data: { processed: true },
    })

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
