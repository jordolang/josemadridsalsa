import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { SquareClient, SquareEnvironment, SquareError } from 'square'
import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/rbac'
import { deductReservedInventoryOnceInTx, checkAndUpdateAlerts } from '@/lib/inventory-manager'
import { sendOrderConfirmationEmail } from '@/lib/email/automation'
import { createOrderAccessToken } from '@/lib/orders/access-token'
import { creditFundraiserCommission } from '@/lib/fundraising/credit-commission'
import { emitDomainEvent } from '@/lib/domain-events/emit'

const ProcessPaymentSchema = z.object({
  sourceId: z.string().min(1, 'Payment source token is required'),
  orderId: z.string().cuid('Invalid order ID'),
  verificationToken: z.string().optional(),
  guestEmail: z.string().email().optional(),
})

function getSquareClient(): SquareClient {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN
  if (!accessToken) {
    throw new Error('Square credentials not configured. Set SQUARE_ACCESS_TOKEN.')
  }

  return new SquareClient({
    token: accessToken,
    environment: process.env.SQUARE_SANDBOX !== 'false'
      ? SquareEnvironment.Sandbox
      : SquareEnvironment.Production,
  })
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    const body = await request.json()
    const { sourceId, orderId, verificationToken, guestEmail } = ProcessPaymentSchema.parse(body)

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        userId: true,
        guestEmail: true,
        total: true,
        // Commission is taken from merchandise, so the subtotal is loaded alongside the total.
        subtotal: true,
        discountAmount: true,
        paymentStatus: true,
        status: true,
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
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Verify ownership
    if (order.userId) {
      if (!user || user.id !== order.userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      // Guest order: require matching email
      if (!guestEmail || guestEmail.toLowerCase() !== order.guestEmail?.toLowerCase()) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    if (order.paymentStatus === 'SUCCEEDED' || order.paymentStatus === 'PAID') {
      return NextResponse.json(
        { error: 'Order has already been paid' },
        { status: 400 }
      )
    }

    const locationId = process.env.SQUARE_LOCATION_ID
    if (!locationId) {
      return NextResponse.json(
        { error: 'Square location not configured' },
        { status: 503 }
      )
    }

    const client = getSquareClient()
    const amountInCents = Math.round(Number(order.total) * 100)

    // Process payment with the tokenized card from the frontend
    const response = await client.payments.create({
      sourceId,
      idempotencyKey: randomUUID(),
      amountMoney: {
        amount: BigInt(amountInCents),
        currency: 'USD',
      },
      locationId,
      referenceId: order.id,
      note: `Order ${order.orderNumber}`,
      buyerEmailAddress: user?.email || order.guestEmail || undefined,
      ...(verificationToken ? { verificationToken } : {}),
      autocomplete: true,
    })

    const payment = response.payment
    if (!payment || payment.status !== 'COMPLETED') {
      return NextResponse.json(
        {
          error: payment?.status === 'FAILED'
            ? 'Payment was declined. Please try a different card.'
            : `Payment status: ${payment?.status || 'unknown'}`,
        },
        { status: 400 }
      )
    }

    const squarePaymentId = payment.id || ''

    // Collect deduction results for post-transaction alert firing
    const itemDeductions: Array<{
      productId: string
      newInventory: number
      lowStockThreshold: number
    }> = []

    // Atomically finalize the order
    await prisma.$transaction(
      async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'PAID',
            status: 'CONFIRMED',
            paymentProvider: 'SQUARE',
            paymentChannel: 'ONLINE',
            providerPaymentId: squarePaymentId,
          },
        })

        await tx.payment.create({
          data: {
            squarePaymentId,
            orderId: order.id,
            amount: amountInCents,
            currency: 'usd',
            status: 'SUCCEEDED',
            provider: 'SQUARE',
            providerPaymentId: squarePaymentId,
            channel: 'ONLINE',
            methodType: 'CARD',
            paidAt: new Date(),
          },
        })

        // Record the payment fact. Without this, nothing downstream knows a Square web sale
        // happened: this route marks the order PAID, so the webhook that used to emit the event
        // short-circuits on `paymentStatus === 'PAID'` and returns before emitting. Every
        // `payment.completed` consumer — automation enrollment, the shop's new-order
        // notification, participant milestones, order rules — was therefore silent on this path.
        await emitDomainEvent(
          {
            type: 'payment.completed',
            entityType: 'order',
            entityId: order.id,
            payload: {
              provider: 'SQUARE',
              amount: amountInCents,
              currency: 'usd',
              squarePaymentId,
            },
          },
          tx
        )

        // Mark abandoned carts as recovered
        if (order.userId) {
          await tx.abandonedCart.updateMany({
            where: {
              userId: order.userId,
              recoveredAt: null,
            },
            data: { recoveredAt: new Date() },
          })
        } else if (order.guestEmail) {
          await tx.abandonedCart.updateMany({
            where: {
              guestEmail: order.guestEmail.toLowerCase(),
              recoveredAt: null,
            },
            data: { recoveredAt: new Date() },
          })
        }

        // Credit the fundraiser. Idempotent and safe to race with the payment webhook,
        // which completes the same order in parallel and now credits it too.
        await creditFundraiserCommission(tx, order.id)

        // Deduct reserved inventory. The payment webhook completes the same order
        // in parallel and deducts the same items, so skip any item it already
        // recorded — deductReservedInventoryOnceInTx is idempotent per order item.
        // Without it a second deduction oversells (see the helper's docs).
        for (const item of order.items) {
          const deductionResult = await deductReservedInventoryOnceInTx(
            {
              productId: item.productId,
              quantity: item.quantity,
              orderId: order.id,
              userId: order.userId || undefined,
              notes: `Square payment completed for order ${order.id}`,
            },
            tx
          )
          if (!deductionResult) {
            continue
          }
          itemDeductions.push({
            productId: item.productId,
            newInventory: deductionResult.newInventory,
            lowStockThreshold: deductionResult.product.lowStockThreshold,
          })
        }
      },
      { isolationLevel: 'Serializable' }
    )

    // Fire inventory alerts post-commit (non-critical)
    for (const { productId, newInventory, lowStockThreshold } of itemDeductions) {
      try {
        await checkAndUpdateAlerts(productId, newInventory, lowStockThreshold)
      } catch (alertError) {
        console.error(
          `[Square Payment] Alert sync failed for product ${productId} (order ${order.id}):`,
          alertError
        )
      }
    }

    // Send confirmation email (non-blocking)
    if (!order.confirmationEmailSentAt) {
      sendOrderConfirmationEmail(order.id).catch((error) => {
        console.error('[Square Payment] Failed to send confirmation email:', {
          orderId: order.id,
          error,
        })
      })
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderAccessToken: createOrderAccessToken(order.id),
      orderNumber: order.orderNumber,
      squarePaymentId,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    if (error instanceof SquareError) {
      console.error('[Square Payment] API error:', error.message)
      return NextResponse.json(
        { error: 'Square payment failed. Please try again or use a different payment method.' },
        { status: 400 }
      )
    }
    console.error('[Square Payment] Error:', error)
    return NextResponse.json(
      { error: 'Unable to process Square payment. Please try again.' },
      { status: 500 }
    )
  }
}
