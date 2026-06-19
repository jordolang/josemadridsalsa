import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createHmac } from 'crypto'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// EasyPost webhook handler
export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const webhookSecret = process.env.EASYPOST_WEBHOOK_SECRET

  // EasyPost webhook signature verification
  // Note: EasyPost uses HMAC-SHA256 signature in the X-Webhook-Signature header
  if (webhookSecret) {
    const signature = headersList.get('x-webhook-signature')

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing x-webhook-signature header' },
        { status: 400 }
      )
    }

    // Verify webhook signature using HMAC-SHA256
    const expectedSignature = createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex')

    if (signature !== expectedSignature) {
      console.error('EasyPost webhook signature verification failed')
      return NextResponse.json(
        { error: 'Webhook signature verification failed' },
        { status: 400 }
      )
    }
  }

  let event: {
    id: string
    object: string
    description: string
    mode: string
    created_at: string
    updated_at: string
    result?: {
      id: string
      object: string
      mode: string
      tracking_code?: string
      status?: string
      carrier?: string
      tracking_details?: Array<{
        object: string
        message: string
        status: string
        datetime: string
        tracking_location?: {
          city?: string
          state?: string
          country?: string
          zip?: string
        }
      }>
      est_delivery_date?: string
      shipment_id?: string
    }
  }

  try {
    event = JSON.parse(body)
  } catch (err) {
    const error = err as Error
    console.error('Failed to parse EasyPost webhook body:', error.message)
    return NextResponse.json(
      { error: `Invalid JSON: ${error.message}` },
      { status: 400 }
    )
  }

  try {
    // Idempotency check: prevent duplicate processing of the same webhook event
    const existingWebhookEvent = await prisma.webhookEvent.findFirst({
      where: { providerEventId: event.id },
    })

    if (existingWebhookEvent?.processed) {
      console.log('EasyPost webhook event already processed, skipping:', event.id)
      return NextResponse.json({ received: true })
    }

    // Create webhook event record if it doesn't exist
    if (!existingWebhookEvent) {
      await prisma.webhookEvent.create({
        data: {
          providerEventId: event.id,
          type: event.description,
          processed: false,
          // Note: provider field is for payment providers only (STRIPE, SQUARE, PAYPAL)
          // EasyPost is a shipping provider, so we leave this field null
        },
      })
    }

    // Handle the event
    // EasyPost sends events like "tracker.created" and "tracker.updated"
    switch (event.description) {
      case 'tracker.created':
      case 'tracker.updated': {
        const tracker = event.result

        if (!tracker) {
          console.warn('EasyPost webhook event missing tracker data:', event.id)
          return NextResponse.json({ received: true })
        }

        const trackingCode = tracker.tracking_code
        if (!trackingCode) {
          console.warn('EasyPost tracker missing tracking_code:', event.id)
          return NextResponse.json({ received: true })
        }

        // Find order by tracking code via ShippingLabel
        const shippingLabel = await prisma.shippingLabel.findFirst({
          where: { trackingCode },
          include: { order: true },
        })

        if (!shippingLabel) {
          console.warn(
            'No order found for EasyPost tracking code:',
            trackingCode
          )
          return NextResponse.json({ received: true })
        }

        // Update order with tracking information
        const trackingHistory = tracker.tracking_details || []
        const latestEvent = trackingHistory[0] // Most recent event

        const updates: {
          lastTrackingUpdate?: Date
          trackingHistory?: object
          shippedAt?: Date | null
          deliveredAt?: Date | null
        } = {
          lastTrackingUpdate: new Date(),
          trackingHistory: trackingHistory as object,
        }

        // Update shipped/delivered timestamps based on status
        if (tracker.status === 'in_transit' && !shippingLabel.order.shippedAt) {
          updates.shippedAt = latestEvent?.datetime
            ? new Date(latestEvent.datetime)
            : new Date()
        }

        if (tracker.status === 'delivered' && !shippingLabel.order.deliveredAt) {
          updates.deliveredAt = latestEvent?.datetime
            ? new Date(latestEvent.datetime)
            : new Date()
        }

        await prisma.order.update({
          where: { id: shippingLabel.orderId },
          data: updates,
        })

        // Update ShippingLabel status
        await prisma.shippingLabel.update({
          where: { id: shippingLabel.id },
          data: { status: tracker.status || 'unknown' },
        })

        console.log(
          'Order tracking updated via EasyPost webhook:',
          shippingLabel.orderId,
          'Status:',
          tracker.status
        )

        // TODO: Trigger notification emails based on status
        // This will be handled in phase-4 (email notifications)
        // if (tracker.status === 'in_transit') {
        //   sendOrderShippedEmail(shippingLabel.orderId)
        // }
        // if (tracker.status === 'delivered') {
        //   sendOrderDeliveredEmail(shippingLabel.orderId)
        // }

        break
      }

      default:
        console.log('Unhandled EasyPost webhook event type:', event.description)
    }

    // Mark webhook event as processed
    await prisma.webhookEvent.updateMany({
      where: { providerEventId: event.id },
      data: { processed: true },
    })

    return NextResponse.json({ received: true })
  } catch (err) {
    const error = err as Error
    console.error('Error processing EasyPost webhook:', error.message)
    console.error('Error stack:', error.stack)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
