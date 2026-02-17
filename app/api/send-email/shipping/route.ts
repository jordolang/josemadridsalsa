import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/client'
import { ShippingNotificationEmail } from '@/emails/shipping-notification'
import type { OrderItem } from '@/emails/components/OrderItemsTable'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ShippingNotificationRequest {
  email: string
  name?: string
  orderNumber: string
  trackingNumber: string
  trackingUrl: string
  carrier: string
  estimatedDelivery: string
  shippingAddress: string
  items: OrderItem[]
  orderId?: string
  userId?: string
  unsubscribeUrl?: string
}

// API route for sending shipping notification emails
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ShippingNotificationRequest

    // Validate required fields
    if (!body.email) {
      return NextResponse.json(
        { error: 'Missing required field: email' },
        { status: 400 }
      )
    }

    if (!body.orderNumber) {
      return NextResponse.json(
        { error: 'Missing required field: orderNumber' },
        { status: 400 }
      )
    }

    if (!body.trackingNumber) {
      return NextResponse.json(
        { error: 'Missing required field: trackingNumber' },
        { status: 400 }
      )
    }

    if (!body.trackingUrl) {
      return NextResponse.json(
        { error: 'Missing required field: trackingUrl' },
        { status: 400 }
      )
    }

    if (!body.carrier) {
      return NextResponse.json(
        { error: 'Missing required field: carrier' },
        { status: 400 }
      )
    }

    if (!body.estimatedDelivery) {
      return NextResponse.json(
        { error: 'Missing required field: estimatedDelivery' },
        { status: 400 }
      )
    }

    if (!body.shippingAddress) {
      return NextResponse.json(
        { error: 'Missing required field: shippingAddress' },
        { status: 400 }
      )
    }

    // Prepare email data
    const emailProps = {
      name: body.name,
      orderNumber: body.orderNumber,
      trackingNumber: body.trackingNumber,
      trackingUrl: body.trackingUrl,
      carrier: body.carrier,
      estimatedDelivery: body.estimatedDelivery,
      shippingAddress: body.shippingAddress,
      items: body.items || [],
      unsubscribeUrl: body.unsubscribeUrl,
    }

    // Send email
    const result = await sendEmail({
      to: body.email,
      subject: `Your Order #${body.orderNumber} Has Shipped!`,
      react: ShippingNotificationEmail(emailProps),
      type: 'shipping-notification',
      orderId: body.orderId,
      userId: body.userId,
      replyTo: 'orders@josemadridsalsa.com',
    })

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to send shipping notification email', details: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      orderNumber: body.orderNumber,
    })
  } catch (error) {
    console.error('Shipping notification email API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
