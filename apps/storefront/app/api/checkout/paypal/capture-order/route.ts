import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { getProvider } from '@/lib/payments'
import { Prisma, PaymentStatus, OrderStatus } from '@prisma/client'
import { deductReservedInventoryInTx, releaseInventory, checkAndUpdateAlerts } from '@/lib/inventory-manager'
import { sendOrderConfirmationEmail } from '@/lib/email/automation'

const CaptureSchema = z.object({
  paypalOrderId: z.string().min(1, 'PayPal order ID is required'),
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
  confirmationEmailSentAt: Date | null
  items: {
    id: string
    productId: string
    quantity: number
    unitPrice: Prisma.Decimal
    totalPrice: Prisma.Decimal
  }[]
}

export async function POST(request: NextRequest) {
  let order: OrderWithItems | null = null

  try {
    const json = await request.json()
    const parsed = CaptureSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid capture payload.' },
        { status: 400 }
      )
    }

    const { paypalOrderId } = parsed.data

    // Find the order by the PayPal order ID stored during create-order
    order = await prisma.order.findFirst({
      where: {
        providerPaymentId: paypalOrderId,
        paymentProvider: 'PAYPAL',
      },
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
        confirmationEmailSentAt: true,
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
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found for this PayPal transaction.' },
        { status: 404 }
      )
    }

    // Already paid — idempotent success
    if (order.paymentStatus === 'PAID' || order.paymentStatus === 'SUCCEEDED') {
      return NextResponse.json({
        success: true,
        orderId: order.id,
        orderNumber: order.orderNumber,
      })
    }

    // Capture via the PayPal adapter
    const paypalAdapter = getProvider('PAYPAL')
    const captureResult = await paypalAdapter.confirmPayment(paypalOrderId)

    if (!captureResult.success || captureResult.status !== 'SUCCEEDED') {
      // Release reserved inventory since capture failed
      for (const item of order.items) {
        try {
          await releaseInventory({
            productId: item.productId,
            quantity: item.quantity,
            orderId: order.id,
            userId: order.userId || undefined,
            notes: `PayPal capture failed for order ${order.id}`,
          })
        } catch (releaseError) {
          console.error('[PayPal Capture] Failed to release inventory:', releaseError)
        }
      }

      return NextResponse.json(
        { error: captureResult.error || 'PayPal payment capture failed.' },
        { status: 400 }
      )
    }

    // Collect deduction results for post-transaction alert firing
    const itemDeductions: Array<{
      productId: string
      newInventory: number
      lowStockThreshold: number
    }> = []

    // Atomically finalize: mark order PAID, create payment record, deduct inventory
    await prisma.$transaction(
      async (tx) => {
        await tx.order.update({
          where: { id: order!.id },
          data: {
            paymentStatus: 'PAID',
            status: 'CONFIRMED',
          },
        })

        // Create the Payment record
        const amountInCents = Math.round(Number(order!.total) * 100)
        await tx.payment.create({
          data: {
            paypalOrderId,
            orderId: order!.id,
            amount: amountInCents,
            currency: 'usd',
            status: 'SUCCEEDED',
            provider: 'PAYPAL',
            providerPaymentId: paypalOrderId,
            channel: 'ONLINE',
            methodType: 'PAYPAL',
            paidAt: new Date(),
          },
        })

        // Mark abandoned carts as recovered
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

        // Update participant totals if attributed
        if (order!.participantId && order!.fundraiserId) {
          const orderTotal = Number(order!.total)

          const fundraiser = await tx.fundraiser.findUnique({
            where: { id: order!.fundraiserId! },
            select: { commissionRate: true },
          })

          if (fundraiser) {
            const commissionAmount = orderTotal * (Number(fundraiser.commissionRate) / 100)

            await tx.fundraiserParticipant.update({
              where: { id: order!.participantId! },
              data: {
                totalOrders: { increment: 1 },
                totalRevenue: { increment: new Prisma.Decimal(orderTotal.toFixed(2)) },
                totalCommission: { increment: new Prisma.Decimal(commissionAmount.toFixed(2)) },
              },
            })
          }
        }

        // Deduct reserved inventory
        for (const item of order!.items) {
          const result = await deductReservedInventoryInTx(
            {
              productId: item.productId,
              quantity: item.quantity,
              orderId: order!.id,
              userId: order!.userId || undefined,
              notes: `PayPal payment completed for order ${order!.id}`,
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

    // Fire inventory alerts after commit (non-critical)
    for (const { productId, newInventory, lowStockThreshold } of itemDeductions) {
      try {
        await checkAndUpdateAlerts(productId, newInventory, lowStockThreshold)
      } catch (alertError) {
        console.error(
          `[PayPal Capture] Alert sync failed for product ${productId} (order ${order.id}):`,
          alertError
        )
      }
    }

    // Send confirmation email (non-blocking)
    if (!order.confirmationEmailSentAt) {
      sendOrderConfirmationEmail(order.id).catch((error) => {
        console.error('[PayPal Capture] Failed to send confirmation email:', {
          orderId: order!.id,
          error,
        })
      })
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
    })
  } catch (error) {
    console.error('[PayPal Capture] Error:', error)

    // Release reserved inventory if order exists and hasn't been paid
    if (order && order.items && order.paymentStatus !== 'PAID') {
      for (const item of order.items) {
        try {
          await releaseInventory({
            productId: item.productId,
            quantity: item.quantity,
            orderId: order.id,
            userId: order.userId || undefined,
            notes: `Error during PayPal capture for order ${order.id}`,
          })
        } catch (releaseError) {
          console.error('[PayPal Capture] Failed to release inventory:', releaseError)
        }
      }
    }

    return NextResponse.json(
      { error: 'Unable to finalize PayPal payment. Please try again.' },
      { status: 500 }
    )
  }
}
