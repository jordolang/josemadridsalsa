import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getStripe } from '@/lib/stripe'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

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
        include: { items: true },
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

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'PAID',
          status: 'CONFIRMED',
          stripePaymentId: paymentIntentId,
        },
      })

      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            inventory: {
              decrement: item.quantity,
            },
          },
        })
      }

      // Mark any abandoned carts as recovered
      if (order.userId) {
        await tx.abandonedCart.updateMany({
          where: {
            userId: order.userId,
            recoveredAt: null,
          },
          data: {
            recoveredAt: new Date(),
          },
        })
      } else if (order.guestEmail) {
        await tx.abandonedCart.updateMany({
          where: {
            guestEmail: order.guestEmail.toLowerCase(),
            recoveredAt: null,
          },
          data: {
            recoveredAt: new Date(),
          },
        })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Checkout completion error:', error)
    return NextResponse.json(
      { error: 'Unable to finalize checkout.' },
      { status: 500 }
    )
  }
}
