import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import prisma from '@/lib/prisma'
import { sendOrderConfirmationEmail } from '@/lib/email/automation'
import { getPayPalAccessToken } from '@/lib/payments/providers/paypal'
import { PAID_PAYMENT_STATUS } from '@/lib/payments/status'
import { emitDomainEvent } from '@/lib/domain-events/emit'
import { creditFundraiserCommission } from '@/lib/fundraising/credit-commission'
import { creditPurchaseLoyaltyPoints } from '@/lib/loyalty'
import { deductWebhookOrderStockInTx, settleWebhookStock } from '@/lib/payments/webhook-stock'
import { reverseFundraiserCommission } from '@/lib/fundraising/reverse-commission'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface PayPalWebhookEvent {
  id: string
  event_type: string
  resource: {
    id: string
    status: string
    amount?: { currency_code: string; value: string }
    custom_id?: string
    purchase_units?: Array<{
      reference_id?: string
      custom_id?: string
      payments?: {
        captures?: Array<{
          id: string
          status: string
          amount: { currency_code: string; value: string }
        }>
      }
    }>
    supplementary_data?: {
      related_ids?: { order_id?: string }
    }
  }
}

async function verifyPayPalWebhook(
  body: string,
  headersList: Headers
): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID
  if (!webhookId) {
    console.error('CRITICAL: PAYPAL_WEBHOOK_ID is not set')
    return false
  }

  const transmissionId = headersList.get('paypal-transmission-id')
  const transmissionTime = headersList.get('paypal-transmission-time')
  const certUrl = headersList.get('paypal-cert-url')
  const transmissionSig = headersList.get('paypal-transmission-sig')
  const authAlgo = headersList.get('paypal-auth-algo')

  if (!transmissionId || !transmissionTime || !certUrl || !transmissionSig || !authAlgo) {
    return false
  }

  // Validate certUrl to prevent SSRF — only PayPal-owned domains are allowed
  const allowedCertPrefixes = [
    'https://www.paypal.com/',
    'https://api.sandbox.paypal.com/',
    'https://api.paypal.com/',
  ]
  if (!allowedCertPrefixes.some((prefix) => certUrl.startsWith(prefix))) {
    console.error('PayPal webhook cert URL rejected (SSRF protection):', certUrl)
    return false
  }

  const clientId = process.env.PAYPAL_CLIENT_ID
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET
  if (!clientId || !clientSecret) return false

  const isSandbox = process.env.PAYPAL_SANDBOX !== 'false'
  const baseUrl = isSandbox
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com'

  const accessToken = await getPayPalAccessToken(baseUrl, clientId, clientSecret)
  if (!accessToken) return false

  // Verify the webhook signature
  const verifyResponse = await fetch(
    `${baseUrl}/v1/notifications/verify-webhook-signature`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: JSON.parse(body),
      }),
    }
  )

  if (!verifyResponse.ok) {
    console.error('PayPal webhook verification request failed:', verifyResponse.status)
    return false
  }

  const verifyData = await verifyResponse.json()
  return verifyData.verification_status === 'SUCCESS'
}

export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()

  // Verify webhook signature
  const isValid = await verifyPayPalWebhook(body, headersList)
  if (!isValid) {
    console.error('PayPal webhook signature verification failed')
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    )
  }

  const event: PayPalWebhookEvent = JSON.parse(body)

  try {
    // Idempotency check
    const existingEvent = await prisma.webhookEvent.findFirst({
      where: { providerEventId: event.id, provider: 'PAYPAL' },
    })

    if (existingEvent?.processed) {
      return NextResponse.json({ received: true })
    }

    // Create or update webhook event record
    const webhookEvent = await prisma.webhookEvent.upsert({
      where: { id: existingEvent?.id || '' },
      create: {
        providerEventId: event.id,
        provider: 'PAYPAL',
        type: event.event_type,
        processed: false,
      },
      update: {
        type: event.event_type,
      },
    })

    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED': {
        const captureId = event.resource.id
        const orderId =
          event.resource.custom_id ||
          event.resource.supplementary_data?.related_ids?.order_id

        if (!orderId) {
          console.warn('PayPal capture missing order reference:', captureId)
          break
        }

        // Find the order by paypalOrderId on Payment or by providerPaymentId on Order
        const order = await prisma.order.findFirst({
          where: {
            OR: [
              { providerPaymentId: orderId },
              { payments: { some: { paypalOrderId: orderId } } },
            ],
          },
          include: { items: true },
        })

        if (!order) {
          console.error('Order not found for PayPal capture:', orderId)
          break
        }

        if (order.paymentStatus === 'SUCCEEDED' || order.paymentStatus === 'PAID') {
          break
        }

        const stock = await prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: order.id },
            data: {
              paymentStatus: PAID_PAYMENT_STATUS,
              status: 'CONFIRMED',
              providerPaymentId: orderId,
              paymentProvider: 'PAYPAL',
            },
          })

          await emitDomainEvent(
            {
              type: 'payment.completed',
              entityType: 'order',
              entityId: order.id,
              payload: {
                provider: 'PAYPAL',
                amount: Math.round(parseFloat(event.resource.amount?.value || '0') * 100),
                currency: event.resource.amount?.currency_code?.toLowerCase() || 'usd',
                paypalOrderId: orderId,
                paypalCaptureId: captureId,
              },
            },
            tx
          )

          // Create or update payment record
          await tx.payment.upsert({
            where: { paypalOrderId: orderId },
            create: {
              paypalOrderId: orderId,
              paypalCaptureId: captureId,
              orderId: order.id,
              amount: Math.round(
                parseFloat(event.resource.amount?.value || '0') * 100
              ),
              currency: event.resource.amount?.currency_code?.toLowerCase() || 'usd',
              status: 'SUCCEEDED',
              provider: 'PAYPAL',
              providerPaymentId: orderId,
              channel: 'ONLINE',
              methodType: 'PAYPAL',
            },
            update: {
              paypalCaptureId: captureId,
              status: 'SUCCEEDED',
            },
          })

          // Credit the fundraiser. This handler had no participant handling at all, so a
          // webhook arriving before the completion route left the group unpaid for that
          // sale. Idempotent on the order, so whichever path wins credits it once.
          await creditFundraiserCommission(tx, order.id)

          // Award purchase loyalty points, idempotent on the order like the credit above.
          await creditPurchaseLoyaltyPoints(tx, order.id)

          // Turn the reservation into a sale, as the Stripe webhook does — idempotent per
          // order item, so the capture route finalizing the same order deducts once.
          return deductWebhookOrderStockInTx(tx, order, 'PayPal')
        }, { isolationLevel: 'Serializable' })

        await settleWebhookStock(order, 'PayPal', stock)

        // Send confirmation email
        if (!order.confirmationEmailSentAt) {
          sendOrderConfirmationEmail(order.id).catch((error) => {
            console.error('Failed to send confirmation email for PayPal order', {
              orderId: order.id,
              error,
            })
          })
        }

        break
      }

      case 'PAYMENT.CAPTURE.REFUNDED': {
        const refundId = event.resource.id
        const captureId =
          event.resource.supplementary_data?.related_ids?.order_id

        if (!captureId) {
          console.warn('PayPal refund missing capture reference:', refundId)
          break
        }

        const payment = await prisma.payment.findFirst({
          where: {
            OR: [
              { paypalCaptureId: captureId },
              { paypalOrderId: captureId },
            ],
          },
        })

        if (!payment) {
          console.error('Payment not found for PayPal refund:', captureId)
          break
        }

        const refundAmount = Math.round(
          parseFloat(event.resource.amount?.value || '0') * 100
        )
        const isFullRefund = refundAmount >= payment.amount

        await prisma.$transaction(async (tx) => {
          const refundRow = await tx.refund.create({
            data: {
              stripeRefundId: refundId, // Provider-agnostic despite the name; see Refund.provider
              provider: 'PAYPAL',
              paymentId: payment.id,
              amount: refundAmount,
              status: 'SUCCEEDED',
            },
          })

          // Take the fundraising group's share back out. Idempotent on the refund.
          await reverseFundraiserCommission(tx, refundRow.id)

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
        console.warn(`Unhandled PayPal event type: ${event.event_type}`)
    }

    // Mark as processed
    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { processed: true },
    })

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('PayPal webhook processing error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
