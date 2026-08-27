import { NextRequest, NextResponse } from 'next/server'
import { SquareClient, SquareEnvironment } from 'square'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { requirePermission } from '@/lib/rbac'
import { deductReservedInventoryInTx, releaseOrderReservation, checkAndUpdateAlerts } from '@/lib/inventory-manager'
import { emitDomainEvent } from '@/lib/domain-events/emit'

type TerminalStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED' | 'FAILED'

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

function mapSquareTerminalStatus(status: string | undefined): TerminalStatus {
  switch (status) {
    case 'COMPLETED':
      return 'COMPLETED'
    case 'IN_PROGRESS':
      return 'IN_PROGRESS'
    case 'CANCEL_REQUESTED':
    case 'CANCELED':
      return 'CANCELED'
    case 'PENDING':
      return 'PENDING'
    default:
      return 'FAILED'
  }
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission('orders:read')

    const checkoutId = request.nextUrl.searchParams.get('checkoutId')
    if (!checkoutId) {
      return NextResponse.json(
        { error: 'Missing checkoutId parameter' },
        { status: 400 }
      )
    }

    // Get the terminal checkout status from Square
    const client = getSquareClient()
    const response = await client.terminal.checkouts.get({ checkoutId })
    const terminalCheckout = response.checkout

    if (!terminalCheckout) {
      return NextResponse.json(
        { error: 'Terminal checkout not found' },
        { status: 404 }
      )
    }

    const status = mapSquareTerminalStatus(terminalCheckout.status)

    // Find the order linked to this terminal checkout
    const order = await prisma.order.findFirst({
      where: { providerPaymentId: checkoutId },
      select: {
        id: true,
        orderNumber: true,
        userId: true,
        paymentStatus: true,
        status: true,
        total: true,
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
        { error: 'Order not found for this terminal checkout' },
        { status: 404 }
      )
    }

    // If COMPLETED and order not yet finalized, finalize it
    if (status === 'COMPLETED' && order.paymentStatus !== 'PAID' && order.paymentStatus !== 'SUCCEEDED') {
      const squarePaymentId = terminalCheckout.paymentIds?.[0] || checkoutId
      const amountInCents = Number(terminalCheckout.amountMoney.amount || 0)

      const itemDeductions: Array<{
        productId: string
        newInventory: number
        lowStockThreshold: number
      }> = []

      await prisma.$transaction(
        async (tx) => {
          await tx.order.update({
            where: { id: order.id },
            data: {
              paymentStatus: 'PAID',
              status: 'CONFIRMED',
            },
          })

          await tx.payment.create({
            data: {
              squarePaymentId,
              squareTerminalCheckoutId: checkoutId,
              orderId: order.id,
              amount: amountInCents,
              currency: 'usd',
              status: 'SUCCEEDED',
              provider: 'SQUARE',
              providerPaymentId: squarePaymentId,
              channel: 'POS',
              methodType: 'SQUARE_TERMINAL',
              paidAt: new Date(),
            },
          })

          // Deduct reserved inventory
          for (const item of order.items) {
            const result = await deductReservedInventoryInTx(
              {
                productId: item.productId,
                quantity: item.quantity,
                orderId: order.id,
                userId: order.userId || undefined,
                notes: `POS terminal payment completed for order ${order.id}`,
              },
              tx
            )
            itemDeductions.push({
              productId: item.productId,
              newInventory: result.newInventory,
              lowStockThreshold: result.product.lowStockThreshold,
            })
          }

          // The counter sale is a payment like any other, and until this was emitted the POS
          // was the one path the shop learned nothing from: no confirmation to the customer,
          // no new-order notification, no automation enrolment. Emitted with the transaction
          // client so the fact is only durable if the sale is, matching the card webhooks.
          await emitDomainEvent(
            {
              type: 'payment.completed',
              entityType: 'order',
              entityId: order.id,
              payload: {
                provider: 'SQUARE',
                channel: 'POS',
                amount: amountInCents,
                currency: 'usd',
                squarePaymentId,
              },
            },
            tx
          )
        },
        { isolationLevel: 'Serializable' }
      )

      // Fire inventory alerts post-commit (non-critical)
      for (const { productId, newInventory, lowStockThreshold } of itemDeductions) {
        try {
          await checkAndUpdateAlerts(productId, newInventory, lowStockThreshold)
        } catch (alertError) {
          console.error(
            `[POS] Alert sync failed for product ${productId} (order ${order.id}):`,
            alertError
          )
        }
      }
    }

    // If CANCELED or FAILED, release inventory if order is still PENDING
    if ((status === 'CANCELED' || status === 'FAILED') && order.paymentStatus === 'PENDING') {
      await releaseOrderReservation(
        order.id,
        `POS terminal checkout ${status.toLowerCase()} for order ${order.id}`
      )

      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'FAILED',
          status: 'CANCELLED',
        },
      })
    }

    return NextResponse.json({
      status,
      orderNumber: order.orderNumber,
    })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message.startsWith('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('[POS] Terminal status check error:', error)
    return NextResponse.json(
      { error: 'Unable to check terminal status' },
      { status: 500 }
    )
  }
}
