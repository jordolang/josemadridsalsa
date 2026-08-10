import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { getProvider } from '@/lib/payments'
import { Prisma, PaymentStatus, OrderStatus } from '@prisma/client'
import { deductReservedInventoryInTx, releaseInventory, checkAndUpdateAlerts } from '@/lib/inventory-manager'
import { PAID_PAYMENT_STATUS, isPaid } from '@/lib/payments/status'
import { redeemOrderCodesInTx } from '@/lib/orders/redeem-codes'
import { creditFundraiserCommission } from '@/lib/fundraising/credit-commission'
import { emitDomainEvent } from '@/lib/domain-events/emit'

const CompleteSchema = z.object({
  orderId: z.string().cuid(),
  // Absent when a gift certificate covered the order in full: there is no charge, so
  // there is no PaymentIntent. Only accepted when the order's total is actually zero.
  paymentIntentId: z.string().min(1).optional(),
})

type OrderWithItems = {
  id: string
  orderNumber: string
  userId: string | null
  guestEmail: string | null
  paymentStatus: PaymentStatus
  status: OrderStatus
  total: Prisma.Decimal
  subtotal: Prisma.Decimal
  discountCode: string | null
  discountAmount: Prisma.Decimal
  giftCertificateCode: string | null
  giftCertificateAmount: Prisma.Decimal
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
          // Commission is taken from merchandise, so the subtotal is loaded alongside the total.
          subtotal: true,
          discountCode: true,
          discountAmount: true,
          giftCertificateCode: true,
          giftCertificateAmount: true,
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
      paymentIntentId ? paymentAdapter.confirmPayment(paymentIntentId) : Promise.resolve(null),
    ])

    order = fetchedOrder

    if (!order) {
      return NextResponse.json(
        { error: 'Order could not be found.' },
        { status: 404 }
      )
    }

    if (isPaid(order.paymentStatus)) {
      const response = NextResponse.json({ success: true })
      if (abandonedCartId) {
        response.cookies.delete('abandonedCartId')
      }
      return response
    }

    // A gift certificate can cover the order in full, so there is nothing to charge and
    // no PaymentIntent to verify. This is only allowed when the order's own total — which
    // was computed server-side — is actually zero, so it cannot be used to skip payment
    // on an order that owes money.
    const expectedTotalInCents = Math.round(Number(order.total) * 100)
    const isFullyCoveredByGiftCertificate = expectedTotalInCents === 0

    if (!isFullyCoveredByGiftCertificate && !paymentIntentId) {
      return NextResponse.json(
        { error: 'Payment has not been confirmed.' },
        { status: 400 }
      )
    }

    if (!isFullyCoveredByGiftCertificate && (!paymentConfirmation || paymentConfirmation.status !== 'SUCCEEDED')) {
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

    // The PaymentIntent must belong to this order and cover its full total. Without
    // both checks a succeeded PaymentIntent from any earlier order could be replayed
    // against a different, unpaid order to mark it paid without charging for it.
    if (!isFullyCoveredByGiftCertificate) {
      if (paymentConfirmation!.orderId !== order.id) {
        console.error('[Checkout Complete] PaymentIntent does not belong to order', {
          orderId: order.id,
          paymentIntentId,
          paymentIntentOrderId: paymentConfirmation!.orderId,
        })
        return NextResponse.json(
          { error: 'Payment does not match this order.' },
          { status: 400 }
        )
      }

      if (paymentConfirmation!.amount !== expectedTotalInCents) {
        console.error('[Checkout Complete] PaymentIntent amount does not match order total', {
          orderId: order.id,
          paymentIntentId,
          paidAmount: paymentConfirmation!.amount,
          expectedTotalInCents,
        })
        return NextResponse.json(
          { error: 'Payment does not match this order.' },
          { status: 400 }
        )
      }
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
            paymentStatus: PAID_PAYMENT_STATUS,
            status: 'CONFIRMED',
            stripePaymentId: paymentIntentId,
            abandonedCartId: abandonedCartId || undefined,
          } as Parameters<typeof tx.order.update>[0]['data'],
        })

        // Record the payment fact on the main storefront path.
        //
        // This route and the Stripe webhook race to complete the same order, and the loser
        // returns early on `isPaid`. Only the webhook emitted the event and only the webhook
        // sent the confirmation email — so whenever this route won that race, which is the
        // common case because the browser calls it the moment payment confirms, the customer
        // got no confirmation and no consumer ever ran. Emitting here settles it either way:
        // the confirmation handler is idempotent through `confirmationEmailSentAt`, so exactly
        // one email goes out no matter which side commits first.
        await emitDomainEvent(
          {
            type: 'payment.completed',
            entityType: 'order',
            entityId: order!.id,
            payload: {
              provider: isFullyCoveredByGiftCertificate ? 'GIFT_CERTIFICATE' : 'STRIPE',
              amount: expectedTotalInCents,
              currency: 'usd',
              stripePaymentIntentId: paymentIntentId ?? undefined,
            },
          },
          tx
        )

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

        // Credit the fundraiser. Idempotent and safe to race with the Stripe webhook, which
        // completes the same order in parallel and now credits it too.
        const credit = await creditFundraiserCommission(tx, order!.id)
        if (credit.credited) {
          console.log('[Checkout Complete] Credited fundraiser commission:', {
            orderId: order!.id,
            participantId: order!.participantId,
            amount: credit.amount,
          })
        }

        // Deduct reserved inventory for each item inside the same transaction.
        // The Stripe webhook completes the same order in parallel and deducts the
        // same items, so skip any item it already recorded. deductReservedInventoryInTx
        // is not idempotent on its own: without this guard a second deduction either
        // throws (the reservation is gone) or silently consumes another customer's
        // reservation, overselling the product.
        for (const item of order!.items) {
          const existingDeduction = await tx.inventoryTransaction.findFirst({
            where: {
              productId: item.productId,
              orderId: order!.id,
              reason: 'ORDER_COMPLETION',
            },
          })

          if (existingDeduction) {
            continue
          }

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

        // Redeem the codes now that the order is paid. Deferring redemption to this
        // point means an abandoned checkout never burns a gift balance or consumes a
        // discount's usage allowance. Both helpers are idempotent on orderId, because
        // the Stripe webhook completes the same order in parallel.
        await redeemOrderCodesInTx(tx, {
          orderId: order!.id,
          userId: order!.userId,
          discountCode: order!.discountCode,
          discountAmount: Number(order!.discountAmount),
          giftCertificateCode: order!.giftCertificateCode,
          giftCertificateAmount: Number(order!.giftCertificateAmount),
          orderTotal: Number(order!.total),
        })
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
    if (order && order.items && !isPaid(order.paymentStatus)) {
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
