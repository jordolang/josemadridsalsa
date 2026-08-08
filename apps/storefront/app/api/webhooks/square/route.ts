import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import prisma from '@/lib/prisma'
import { getProvider } from '@/lib/payments'
import { sendOrderConfirmationEmail } from '@/lib/email/automation'
import { PAID_PAYMENT_STATUS } from '@/lib/payments/status'
import { emitDomainEvent } from '@/lib/domain-events/emit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface SquareWebhookEvent {
  merchant_id: string
  type: string
  event_id: string
  created_at: string
  data: {
    type: string
    id: string
    object: {
      payment?: {
        id: string
        status: string
        amount_money?: { amount: number; currency: string }
        reference_id?: string
        order_id?: string
        location_id?: string
      }
      refund?: {
        id: string
        status: string
        amount_money?: { amount: number; currency: string }
        payment_id?: string
      }
    }
  }
}

export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()

  // Verify webhook signature via the adapter
  const squareAdapter = getProvider('SQUARE')
  const isValid = await squareAdapter.verifyWebhookSignature({
    body,
    headers: headersList,
  })

  if (!isValid) {
    console.error('Square webhook signature verification failed')
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    )
  }

  const event: SquareWebhookEvent = JSON.parse(body)

  try {
    // Idempotency check
    const existingEvent = await prisma.webhookEvent.findFirst({
      where: { providerEventId: event.event_id, provider: 'SQUARE' },
    })

    if (existingEvent?.processed) {
      return NextResponse.json({ received: true })
    }

    // Create or update webhook event record
    const webhookEvent = await prisma.webhookEvent.upsert({
      where: { id: existingEvent?.id || '' },
      create: {
        providerEventId: event.event_id,
        provider: 'SQUARE',
        type: event.type,
        processed: false,
      },
      update: {
        type: event.type,
      },
    })

    switch (event.type) {
      case 'payment.completed': {
        const payment = event.data.object.payment
        if (!payment) {
          console.warn('Square payment.completed event missing payment object')
          break
        }

        const squarePaymentId = payment.id
        const orderId = payment.reference_id

        if (!orderId) {
          console.warn('Square payment missing reference_id (order ID):', squarePaymentId)
          break
        }

        // Find order by providerPaymentId or squarePaymentId on Payment
        const order = await prisma.order.findFirst({
          where: {
            OR: [
              { providerPaymentId: squarePaymentId },
              { id: orderId },
              { payments: { some: { squarePaymentId } } },
            ],
          },
          include: { items: true },
        })

        if (!order) {
          console.error('Order not found for Square payment:', squarePaymentId)
          break
        }

        if (order.paymentStatus === 'SUCCEEDED' || order.paymentStatus === 'PAID') {
          break
        }

        const amountInCents = Number(payment.amount_money?.amount || 0)

        await prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: order.id },
            data: {
              paymentStatus: PAID_PAYMENT_STATUS,
              status: 'CONFIRMED',
              providerPaymentId: squarePaymentId,
              paymentProvider: 'SQUARE',
            },
          })

          await emitDomainEvent(
            {
              type: 'payment.completed',
              entityType: 'order',
              entityId: order.id,
              payload: {
                provider: 'SQUARE',
                amount: amountInCents,
                currency: (payment.amount_money?.currency || 'usd').toLowerCase(),
                squarePaymentId,
              },
            },
            tx
          )

          await tx.payment.upsert({
            where: { squarePaymentId },
            create: {
              squarePaymentId,
              orderId: order.id,
              amount: amountInCents,
              currency: (payment.amount_money?.currency || 'usd').toLowerCase(),
              status: 'SUCCEEDED',
              provider: 'SQUARE',
              providerPaymentId: squarePaymentId,
              channel: 'POS',
              methodType: 'SQUARE_TERMINAL',
              paidAt: new Date(),
            },
            update: {
              status: 'SUCCEEDED',
              paidAt: new Date(),
            },
          })
        })

        // Send confirmation email (non-blocking)
        if (!order.confirmationEmailSentAt) {
          sendOrderConfirmationEmail(order.id).catch((error) => {
            console.error('Failed to send confirmation email for Square order', {
              orderId: order.id,
              error,
            })
          })
        }

        break
      }

      case 'refund.created':
      case 'refund.updated': {
        const refund = event.data.object.refund
        if (!refund) {
          console.warn('Square refund event missing refund object')
          break
        }

        if (refund.status !== 'COMPLETED') {
          break
        }

        const squarePaymentId = refund.payment_id
        if (!squarePaymentId) {
          console.warn('Square refund missing payment_id:', refund.id)
          break
        }

        const payment = await prisma.payment.findFirst({
          where: {
            OR: [
              { squarePaymentId },
              { providerPaymentId: squarePaymentId },
            ],
          },
        })

        if (!payment) {
          console.error('Payment not found for Square refund:', squarePaymentId)
          break
        }

        const refundAmount = Number(refund.amount_money?.amount || 0)
        const isFullRefund = refundAmount >= payment.amount

        await prisma.$transaction(async (tx) => {
          await tx.refund.create({
            data: {
              stripeRefundId: refund.id, // Provider-agnostic despite the name; see Refund.provider
              provider: 'SQUARE',
              paymentId: payment.id,
              amount: refundAmount,
              status: 'SUCCEEDED',
            },
          })

          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
            },
          })

          if (isFullRefund) {
            await tx.order.update({
              where: { id: payment.orderId },
              data: {
                paymentStatus: 'REFUNDED',
                status: 'REFUNDED',
              },
            })
          }
        })

        break
      }

      default:
        // Unhandled event type -- acknowledge receipt
        break
    }

    // Mark as processed
    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { processed: true },
    })

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Square webhook processing error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
