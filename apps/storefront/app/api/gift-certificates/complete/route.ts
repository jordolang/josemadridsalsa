import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getStripe } from '@/lib/stripe'
import prisma from '@/lib/prisma'
import { sendGiftCertificateDeliveryEmail } from '@/lib/email/transactional'

const CompleteSchema = z.object({
  orderId: z.string().cuid(),
  paymentIntentId: z.string().min(1),
})

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const parsed = CompleteSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid completion payload.' },
        { status: 400 }
      )
    }

    const { orderId, paymentIntentId } = parsed.data

    const stripe = getStripe()

    const [order, paymentIntent] = await Promise.all([
      prisma.order.findUnique({
        where: { id: orderId },
        include: { giftCertificates: true },
      }),
      stripe.paymentIntents.retrieve(paymentIntentId),
    ])

    if (!order) {
      return NextResponse.json(
        { error: 'Order could not be found.' },
        { status: 404 }
      )
    }

    if (order.paymentStatus === 'PAID') {
      return NextResponse.json({ success: true })
    }

    if (!paymentIntent || paymentIntent.status !== 'succeeded') {
      return NextResponse.json(
        { error: 'Payment has not been confirmed.' },
        { status: 400 }
      )
    }

    // Update order payment status
    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'PAID',
        status: 'CONFIRMED',
        stripePaymentId: paymentIntentId,
      },
    })

    // Send delivery email to each gift certificate recipient
    const giftCerts = order.giftCertificates ?? []
    for (const cert of giftCerts) {
      if (cert.recipientEmail) {
        sendGiftCertificateDeliveryEmail({
          recipientEmail: cert.recipientEmail,
          recipientName: cert.recipientName,
          purchaserName: cert.purchaserName,
          code: cert.code,
          amount: `$${Number(cert.originalAmount).toFixed(2)}`,
          message: cert.message,
          theme: cert.theme,
        }).catch((err: unknown) => {
          console.error('Gift certificate delivery email failed:', err)
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Gift certificate completion error:', error)
    return NextResponse.json(
      { error: 'Unable to complete gift certificate purchase.' },
      { status: 500 }
    )
  }
}

