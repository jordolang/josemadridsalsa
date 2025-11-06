import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getStripe } from '@/lib/stripe'
import prisma from '@/lib/prisma'

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

    // Gift certificate is already created and linked to order
    // No inventory to update for gift certificates

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Gift certificate completion error:', error)
    return NextResponse.json(
      { error: 'Unable to complete gift certificate purchase.' },
      { status: 500 }
    )
  }
}

