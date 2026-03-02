import { NextResponse } from 'next/server'
import { z } from 'zod'
import { sendEmail } from '@/lib/email/client'
import { ShippingNotificationEmail } from '@/emails/shipping-notification'
import { checkRateLimit, validateServiceApiKey } from '@/lib/email/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const OrderItemSchema = z.object({
  quantity: z.number(),
  productName: z.string(),
  productSku: z.string(),
  totalPrice: z.union([z.number(), z.string()]),
})

const ShippingNotificationSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().optional(),
  orderNumber: z.string().min(1),
  trackingNumber: z.string().min(1),
  trackingUrl: z.string().url(),
  carrier: z.string().min(1),
  estimatedDelivery: z.string().min(1),
  shippingAddress: z.string().min(1),
  items: z.array(OrderItemSchema).default([]),
  orderId: z.string().optional(),
  userId: z.string().optional(),
  unsubscribeUrl: z.string().url().optional(),
})

// API route for sending shipping notification emails
export async function POST(request: Request) {
  try {
    // Authenticate service requests
    if (!validateServiceApiKey(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limit
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const { allowed, retryAfterMs } = checkRateLimit(`shipping:${ip}`, { maxRequests: 30, windowMs: 60_000 })
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((retryAfterMs || 60000) / 1000)) } }
      )
    }

    const body = await request.json()
    const parsed = ShippingNotificationSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
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
      trackingNumber: data.trackingNumber,
      trackingUrl: data.trackingUrl,
      carrier: data.carrier,
      estimatedDelivery: data.estimatedDelivery,
      shippingAddress: data.shippingAddress,
      items: data.items,
      unsubscribeUrl: data.unsubscribeUrl,
    }

    // Send email
    const result = await sendEmail({
      to: data.email,
      subject: `Your Order #${data.orderNumber} Has Shipped!`,
      react: ShippingNotificationEmail(emailProps),
      type: 'shipping-notification',
      orderId: data.orderId,
      userId: data.userId,
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
      orderNumber: data.orderNumber,
    })
  } catch (error) {
    console.error('Shipping notification email API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
