import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createHmac } from 'crypto'
import prisma from '@/lib/prisma'
import { handleTrackerUpdated, type TrackerResult } from '@/lib/tracking/webhook-handlers'

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
    result?: TrackerResult
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
        if (!event.result) {
          console.warn('EasyPost webhook event missing tracker data:', event.id)
          break
        }

        // Delegate to the shared handler so tracking updates and the
        // shipped/delivered notification emails stay in one place.
        await handleTrackerUpdated(event.result)
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
