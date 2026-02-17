import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/client'
import { DeliveryConfirmationEmail } from '@/emails/delivery-confirmation'
import type { OrderItem } from '@/emails/components/OrderItemsTable'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface DeliveryConfirmationRequest {
  email: string
  name?: string
  orderNumber: string
  deliveryDate: string
  shippingAddress: string
  items: OrderItem[]
  feedbackUrl?: string
  orderDetailsUrl?: string
  orderId?: string
  userId?: string
  unsubscribeUrl?: string
}

// API route for sending delivery confirmation emails
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DeliveryConfirmationRequest

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

    if (!body.deliveryDate) {
      return NextResponse.json(
        { error: 'Missing required field: deliveryDate' },
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
      deliveryDate: body.deliveryDate,
      shippingAddress: body.shippingAddress,
      items: body.items || [],
      feedbackUrl: body.feedbackUrl,
      orderDetailsUrl: body.orderDetailsUrl,
      unsubscribeUrl: body.unsubscribeUrl,
    }

    // Send email
    const result = await sendEmail({
      to: body.email,
      subject: `Your Order #${body.orderNumber} Has Been Delivered!`,
      react: DeliveryConfirmationEmail(emailProps),
      type: 'delivery-confirmation',
      orderId: body.orderId,
      userId: body.userId,
      replyTo: 'orders@josemadridsalsa.com',
    })

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to send delivery confirmation email', details: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      orderNumber: body.orderNumber,
    })
  } catch (error) {
    console.error('Delivery confirmation email API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
