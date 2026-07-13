import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import prisma from '@/lib/prisma'
import { getEasyPostClient } from '@/lib/shipping-api'
import { handleTrackerUpdated, type TrackerResult } from '@/lib/tracking/webhook-handlers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type EasyPostWebhookEvent = {
  id: string
  object?: string
  description: string
  mode?: string
  created_at?: string
  updated_at?: string
  result?: TrackerResult
}

// EasyPost webhook handler
export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const webhookSecret = process.env.EASYPOST_WEBHOOK_SECRET

  // Fail closed: never process unsigned webhooks. Without a configured secret,
  // anyone who guesses a tracking code could forge tracker events and mutate
  // order tracking data.
  if (!webhookSecret) {
    console.error('EASYPOST_WEBHOOK_SECRET is not configured; rejecting webhook')
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    )
  }

  // Verify the signature and parse the body using EasyPost's own validator.
  // EasyPost signs with the `X-Hmac-Signature` header (value prefixed
  // `hmac-sha256-hex=` over the body using the NFKD-normalized secret), so a
  // bare hex comparison would reject every real webhook.
  let event: EasyPostWebhookEvent
  try {
    const headerObject = Object.fromEntries(headersList.entries())
    // The EasyPost SDK's published types don't surface Utils on the client
    // instance, so reach it through a narrow cast.
    const client = getEasyPostClient() as unknown as {
      Utils: {
        validateWebhook: (
          body: Buffer,
          headers: Record<string, unknown>,
          secret: string
        ) => unknown
      }
    }
    event = client.Utils.validateWebhook(
      Buffer.from(body),
      headerObject,
      webhookSecret
    ) as EasyPostWebhookEvent
  } catch (err) {
    console.error(
      'EasyPost webhook signature verification failed:',
      (err as Error).message
    )
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
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
