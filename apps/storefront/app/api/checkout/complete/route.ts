import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { getProvider } from '@/lib/payments'
import { Prisma, PaymentStatus, OrderStatus } from '@prisma/client'
import { deductReservedInventoryInTx, releaseInventory, checkAndUpdateAlerts } from '@/lib/inventory-manager'

const CompleteSchema = z.object({
  orderId: z.string().cuid(),
  paymentIntentId: z.string().min(1),
})

type OrderWithItems = {
  id: string
  orderNumber: string
  userId: string | null
  guestEmail: string | null
  paymentStatus: PaymentStatus
  status: OrderStatus
  total: Prisma.Decimal
  participantId: string | null
  fundraiserId: string | null
  items: {
    id: string
    productId: string
    quantity: number
    unitPrice: Prisma.Decimal
    totalPrice: Prisma.Decimal
  }[]
}

export async function POST(request: Request) {
  let order: OrderWithItems | null = null

  try {
    // Read abandonedCartId from cookie for attribution tracking
    const cookieStore = await cookies()
    const abandonedCartId = cookieStore.get('abandonedCartId')?.value || null

    const json = await request.json()
    const parsed = CompleteSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid completion payload.' },
        { status: 400 }
      )
    }

    const { orderId, paymentIntentId } = parsed.data

    const paymentAdapter = getProvider('STRIPE')

    const [fetchedOrder, paymentConfirmation] = await Promise.all([
      prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          orderNumber: true,
          userId: true,
          guestEmail: true,
          paymentStatus: true,
          status: true,
          total: true,
          participantId: true,
          fundraiserId: true,
          items: {
            select: {
              id: true,
              productId: true,
              quantity: true,
              unitPrice: true,
              totalPrice: true,
            },
          },
        },
      }),
      paymentAdapter.confirmPayment(paymentIntentId),
    ])

    order = fetchedOrder

    if (!order) {
      return NextResponse.json(
        { error: 'Order could not be found.' },
        { status: 404 }
      )
    }

    if (order.paymentStatus === 'PAID') {
      const response = NextResponse.json({ success: true })
      if (abandonedCartId) {
        response.cookies.delete('abandonedCartId')
      }
      return response
    }

    if (!paymentConfirmation || paymentConfirmation.status !== 'SUCCEEDED') {
      // Release reserved inventory for all items in parallel since payment failed
      const releaseResults = await Promise.allSettled(
        order.items.map((item) =>
          releaseInventory({
            productId: item.productId,
            quantity: item.quantity,
            orderId: order!.id,
            userId: order!.userId || undefined,
            notes: `Payment failed for order ${order!.id}`,
          })
        )
      )
      for (const result of releaseResults) {
        if (result.status === 'rejected') {
          console.error('Failed to release inventory:', result.reason)
        }
      }

      return NextResponse.json(
        { error: 'Payment has not been confirmed.' },
        { status: 400 }
      )
    }

    // Collect deduction results for post-transaction alert firing
    const itemDeductions: Array<{
      productId: string
      newInventory: number
      lowStockThreshold: number
    }> = []

    // Atomically mark the order PAID and deduct inventory in the same transaction.
    // If deduction fails, the order stays PENDING and inventory stays reserved.
    await prisma.$transaction(
      async (tx) => {
        await tx.order.update({
          where: { id: order!.id },
          data: {
            paymentStatus: 'PAID',
            status: 'CONFIRMED',
            stripePaymentId: paymentIntentId,
            abandonedCartId: abandonedCartId || undefined,
          } as Parameters<typeof tx.order.update>[0]['data'],
        })

        // Mark abandoned cart as recovered
        if (abandonedCartId) {
          // If we have a specific abandonedCartId from the recovery link, update that cart
          await tx.abandonedCart.update({
            where: { id: abandonedCartId },
            data: { recoveredAt: new Date() },
          })
        } else {
          // Fallback: mark any unrecovered carts for this user/guest as recovered
          if (order!.userId) {
            await tx.abandonedCart.updateMany({
              where: {
                userId: order!.userId,
                recoveredAt: null,
              },
              data: {
                recoveredAt: new Date(),
              },
            })
          } else if (order!.guestEmail) {
            await tx.abandonedCart.updateMany({
              where: {
                guestEmail: order!.guestEmail.toLowerCase(),
                recoveredAt: null,
              },
              data: {
                recoveredAt: new Date(),
              },
            })
          }
        }

        // Update participant totals if order is attributed to a participant
        if (order!.participantId) {
          const orderTotal = Number(order!.total)

          // Get the fundraiser to calculate commission
          const fundraiser = await tx.fundraiser.findUnique({
            where: { id: order!.fundraiserId! },
            select: { commissionRate: true },
          })

          if (fundraiser) {
            const commissionAmount = orderTotal * (Number(fundraiser.commissionRate) / 100)

            // Increment participant totals
            await tx.fundraiserParticipant.update({
              where: { id: order!.participantId },
              data: {
                totalOrders: { increment: 1 },
                totalRevenue: { increment: new Prisma.Decimal(orderTotal.toFixed(2)) },
                totalCommission: { increment: new Prisma.Decimal(commissionAmount.toFixed(2)) },
              },
            })

            console.log('[Checkout Complete] Updated participant totals:', {
              participantId: order!.participantId,
              orderTotal,
              commissionAmount,
            })
          }
        }

        // Deduct reserved inventory for each item inside the same transaction
        for (const item of order!.items) {
          const result = await deductReservedInventoryInTx(
            {
              productId: item.productId,
              quantity: item.quantity,
              orderId: order!.id,
              userId: order!.userId || undefined,
              notes: `Payment completed for order ${order!.id}`,
            },
            tx
          )
          itemDeductions.push({
            productId: item.productId,
            newInventory: result.newInventory,
            lowStockThreshold: result.product.lowStockThreshold,
          })
        }
      },
      { isolationLevel: 'Serializable' }
    )

    // Fire inventory alerts after the committed transaction (non-critical)
    for (const { productId, newInventory, lowStockThreshold } of itemDeductions) {
      try {
        await checkAndUpdateAlerts(productId, newInventory, lowStockThreshold)
      } catch (alertError) {
        console.error(
          `[checkout/complete] Alert sync failed for product ${productId} (order ${order.id}):`,
          alertError
        )
      }
    }

    // Clear the recovery attribution cookie now that this order is complete,
    // so future unrelated orders from this browser aren't attributed to the
    // same abandoned cart (the cookie otherwise lives for 30 days).
    const response = NextResponse.json({ success: true })
    if (abandonedCartId) {
      response.cookies.delete('abandonedCartId')
    }
    return response
  } catch (error) {
    console.error('Checkout completion error:', error)

    // Release reserved inventory in parallel if order exists and hasn't been paid
    if (order && order.items && order.paymentStatus !== 'PAID') {
      const releaseResults = await Promise.allSettled(
        order.items.map((item) =>
          releaseInventory({
            productId: item.productId,
            quantity: item.quantity,
            orderId: order!.id,
            userId: order!.userId || undefined,
            notes: `Error during checkout completion for order ${order!.id}`,
          })
        )
      )
      for (const result of releaseResults) {
        if (result.status === 'rejected') {
          console.error('Failed to release inventory:', result.reason)
        }
      }
    }

    return NextResponse.json(
      { error: 'Unable to finalize checkout.' },
      { status: 500 }
    )
  }
}
