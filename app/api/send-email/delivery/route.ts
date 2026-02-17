import { NextResponse } from 'next/server'
import { z } from 'zod'
import { sendEmail } from '@/lib/email/client'
import { DeliveryConfirmationEmail } from '@/emails/delivery-confirmation'
import { checkRateLimit, validateServiceApiKey } from '@/lib/email/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const OrderItemSchema = z.object({
  quantity: z.number(),
  productName: z.string(),
  productSku: z.string(),
  totalPrice: z.union([z.number(), z.string()]),
})

const DeliveryConfirmationSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().optional(),
  orderNumber: z.string().min(1),
  deliveryDate: z.string().min(1),
  shippingAddress: z.string().min(1),
  items: z.array(OrderItemSchema).default([]),
  feedbackUrl: z.string().url().optional(),
  orderDetailsUrl: z.string().url().optional(),
  orderId: z.string().optional(),
  userId: z.string().optional(),
  unsubscribeUrl: z.string().url().optional(),
})

// API route for sending delivery confirmation emails
export async function POST(request: Request) {
  try {
    // Authenticate service requests
    if (!validateServiceApiKey(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limit
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const { allowed, retryAfterMs } = checkRateLimit(`delivery:${ip}`, { maxRequests: 30, windowMs: 60_000 })
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((retryAfterMs || 60000) / 1000)) } }
      )
    }

    const body = await request.json()
    const parsed = DeliveryConfirmationSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.errors[0]
      return NextResponse.json(
        { error: `Validation error: ${firstError.message}` },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Prepare email data
    const emailProps = {
      name: data.name,
      orderNumber: data.orderNumber,
      deliveryDate: data.deliveryDate,
      shippingAddress: data.shippingAddress,
      items: data.items,
      feedbackUrl: data.feedbackUrl,
      orderDetailsUrl: data.orderDetailsUrl,
      unsubscribeUrl: data.unsubscribeUrl,
    }

    // Send email
    const result = await sendEmail({
      to: data.email,
      subject: `Your Order #${data.orderNumber} Has Been Delivered!`,
      react: DeliveryConfirmationEmail(emailProps),
      type: 'delivery-confirmation',
      orderId: data.orderId,
      userId: data.userId,
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
      orderNumber: data.orderNumber,
    })
  } catch (error) {
    console.error('Delivery confirmation email API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
