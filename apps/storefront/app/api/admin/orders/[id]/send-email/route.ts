import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { sendEmail } from '@/lib/email'
import { z } from 'zod'
import { bigCommerceOrderLock } from '@/lib/bigcommerce/order-lock'

const SendEmailSchema = z.object({
  type: z.enum(['confirmation', 'shipping', 'custom']),
  subject: z.string().optional(),
  message: z.string().optional(),
})

function buildConfirmationEmail(order: {
  orderNumber: string
  total: number
  items: Array<{ productName: string; quantity: number; unitPrice: number }>
  shippingAddress: {
    firstName: string
    lastName: string
    street: string
    city: string
    state: string
    zipCode: string
  } | null
}): { subject: string; html: string } {
  const subject = `Order Confirmation – ${order.orderNumber}`
  const itemRows = order.items
    .map(
      (item) =>
        `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">${item.productName}</td>
          <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity}</td>
          <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;">$${(item.quantity * item.unitPrice).toFixed(2)}</td>
        </tr>`
    )
    .join('')

  const addressBlock = order.shippingAddress
    ? `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}<br>
       ${order.shippingAddress.street}<br>
       ${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zipCode}`
    : 'Not provided'

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:linear-gradient(135deg,#dc2626 0%,#991b1b 100%);padding:30px;text-align:center;border-radius:8px 8px 0 0;">
    <h1 style="color:white;margin:0;font-size:24px;">Order Confirmed!</h1>
    <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;">Order ${order.orderNumber}</p>
  </div>
  <div style="background:#fff;padding:30px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
    <p style="font-size:16px;">Thank you for your order! We're getting it ready for you.</p>
    <h2 style="font-size:18px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">Order Summary</h2>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="text-align:left;color:#6b7280;font-size:13px;">
          <th style="padding:8px 0;font-weight:500;">Item</th>
          <th style="padding:8px 0;text-align:center;font-weight:500;">Qty</th>
          <th style="padding:8px 0;text-align:right;font-weight:500;">Price</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding:12px 0 0;font-weight:600;">Total</td>
          <td style="padding:12px 0 0;text-align:right;font-weight:600;font-size:16px;">$${order.total.toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>
    <h2 style="font-size:18px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;margin-top:24px;">Shipping To</h2>
    <p style="color:#4b5563;">${addressBlock}</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:30px 0;">
    <p style="font-size:12px;color:#9ca3af;text-align:center;margin:0;">Jose Madrid Salsa &mdash; Thank you for your business!</p>
  </div>
</body>
</html>`

  return { subject, html }
}

function buildShippingEmail(order: {
  orderNumber: string
  trackingNumber: string | null
  shippingLabelUrl: string | null
}): { subject: string; html: string } {
  const subject = `Your order ${order.orderNumber} has shipped!`

  const trackingSection = order.trackingNumber
    ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:20px 0;text-align:center;">
        <p style="margin:0 0 8px;font-size:14px;color:#166534;font-weight:500;">Tracking Number</p>
        <p style="margin:0 0 12px;font-size:20px;font-family:monospace;font-weight:700;color:#15803d;">${order.trackingNumber}</p>
        ${
          order.shippingLabelUrl
            ? `<a href="${order.shippingLabelUrl}" style="background:#16a34a;color:white;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:600;font-size:14px;">Track Your Package</a>`
            : ''
        }
      </div>`
    : `<p style="color:#6b7280;">Tracking information will be available soon.</p>`

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:linear-gradient(135deg,#dc2626 0%,#991b1b 100%);padding:30px;text-align:center;border-radius:8px 8px 0 0;">
    <h1 style="color:white;margin:0;font-size:24px;">Your Order Has Shipped!</h1>
    <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;">Order ${order.orderNumber}</p>
  </div>
  <div style="background:#fff;padding:30px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
    <p style="font-size:16px;">Great news! Your order is on its way.</p>
    ${trackingSection}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:30px 0;">
    <p style="font-size:12px;color:#9ca3af;text-align:center;margin:0;">Jose Madrid Salsa &mdash; Thank you for your business!</p>
  </div>
</body>
</html>`

  return { subject, html }
}

function buildCustomEmail(
  subject: string,
  message: string,
  orderNumber: string
): { subject: string; html: string } {
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:linear-gradient(135deg,#dc2626 0%,#991b1b 100%);padding:30px;text-align:center;border-radius:8px 8px 0 0;">
    <h1 style="color:white;margin:0;font-size:24px;">Jose Madrid Salsa</h1>
    <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;">Regarding order ${orderNumber}</p>
  </div>
  <div style="background:#fff;padding:30px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
    <div style="white-space:pre-line;font-size:15px;">${message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:30px 0;">
    <p style="font-size:12px;color:#9ca3af;text-align:center;margin:0;">Jose Madrid Salsa &mdash; Thank you for your business!</p>
  </div>
</body>
</html>`

  return { subject, html }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permitted = await hasPermission(session.user as any, 'orders:write')
    if (!permitted) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { type, subject, message } = SendEmailSchema.parse(body)

    // BigCommerce already sent a copied order's confirmation and shipping emails.
    if (type !== 'custom') {
      const locked = await bigCommerceOrderLock(id)
      if (locked) return locked
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        shippingAddress: true,
        user: true,
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const customerEmail = order.user?.email ?? order.guestEmail
    if (!customerEmail) {
      return NextResponse.json({ error: 'No customer email on this order' }, { status: 400 })
    }

    let emailContent: { subject: string; html: string }

    if (type === 'confirmation') {
      emailContent = buildConfirmationEmail({
        orderNumber: order.orderNumber,
        total: Number(order.total),
        items: order.items.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
        })),
        shippingAddress: order.shippingAddress
          ? {
              firstName: order.shippingAddress.firstName,
              lastName: order.shippingAddress.lastName,
              street: order.shippingAddress.street,
              city: order.shippingAddress.city,
              state: order.shippingAddress.state,
              zipCode: order.shippingAddress.zipCode,
            }
          : null,
      })
    } else if (type === 'shipping') {
      emailContent = buildShippingEmail({
        orderNumber: order.orderNumber,
        trackingNumber: order.trackingNumber,
        shippingLabelUrl: order.shippingLabelUrl,
      })
    } else {
      if (!subject || !message) {
        return NextResponse.json(
          { error: 'Subject and message are required for custom emails' },
          { status: 400 }
        )
      }
      emailContent = buildCustomEmail(subject, message, order.orderNumber)
    }

    const result = await sendEmail({
      to: customerEmail,
      subject: emailContent.subject,
      html: emailContent.html,
    })

    if ('error' in result && result.error) {
      return NextResponse.json({ error: 'Email delivery failed' }, { status: 500 })
    }

    // Mark confirmation email as sent
    if (type === 'confirmation') {
      await prisma.order.update({
        where: { id },
        data: { confirmationEmailSentAt: new Date() },
      })
    }

    await logAudit({
      userId: (session.user as any).id,
      action: 'update',
      entityType: 'order',
      entityId: id,
      changes: { emailSent: { type, to: customerEmail } },
    })

    return NextResponse.json({ success: true, to: customerEmail })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('Send email error:', error)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
