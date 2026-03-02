import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getStripe } from '@/lib/stripe'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { deductReservedInventory, releaseInventory } from '@/lib/inventory-manager'

const CompleteSchema = z.object({
  orderId: z.string().cuid(),
  paymentIntentId: z.string().min(1),
})

export async function POST(request: Request) {
  let order: Awaited<ReturnType<typeof prisma.order.findUnique>> | null = null

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

    const [fetchedOrder, paymentIntent] = await Promise.all([
      prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      }),
      stripe.paymentIntents.retrieve(paymentIntentId),
    ])

    order = fetchedOrder

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
      // Release reserved inventory for each item since payment failed
      for (const item of order.items) {
        try {
          await releaseInventory({
            productId: item.productId,
            quantity: item.quantity,
            orderId: order.id,
            userId: order.userId || undefined,
            notes: `Payment failed for order ${order.id}`,
          })
        } catch (releaseError) {
          console.error('Failed to release inventory:', releaseError)
        }
      }

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

    // Deduct reserved inventory for each item
    for (const item of order.items) {
      await deductReservedInventory({
        productId: item.productId,
        quantity: item.quantity,
        orderId: order.id,
        userId: order.userId || undefined,
        notes: `Payment completed for order ${order.id}`,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Checkout completion error:', error)

    // Release reserved inventory if order exists and hasn't been paid
    if (order && order.items && order.paymentStatus !== 'PAID') {
      for (const item of order.items) {
        try {
          await releaseInventory({
            productId: item.productId,
            quantity: item.quantity,
            orderId: order.id,
            userId: order.userId || undefined,
            notes: `Error during checkout completion for order ${order.id}`,
          })
        } catch (releaseError) {
          console.error('Failed to release inventory:', releaseError)
        }
      }
    }

    return NextResponse.json(
      { error: 'Unable to finalize checkout.' },
      { status: 500 }
    )
  }
}
