/**
 * Square Terminal checkouts for in-person sales — shared by the staff POS and the
 * self-order kiosk so both create, finalize and cancel orders the same way.
 *
 * Amounts are cents. Callers price the sale; this module records it, reserves stock,
 * sends the amount to the Terminal, and finalizes the order when Square reports it paid.
 */
import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import { SquareClient, SquareEnvironment } from 'square'
import prisma from '@/lib/prisma'
import {
  checkAndUpdateAlerts,
  deductReservedInventoryInTx,
  releaseInventory,
  releaseOrderReservation,
  reserveMultipleProducts,
} from '@/lib/inventory-manager'
import { emitOrderCreated } from '@/lib/orders/events'
import { emitDomainEvent } from '@/lib/domain-events/emit'

export type TerminalStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED' | 'FAILED'

/** An error the route can show as-is, with the HTTP status to use. */
export class TerminalCheckoutError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

export interface TerminalLineItem {
  productId: string
  name: string
  sku?: string
  unitPriceCents: number
  quantity: number
}

export interface CreateTerminalCheckoutInput {
  items: TerminalLineItem[]
  discountCents?: number
  taxCents?: number
  totalCents: number
  /** A Square device id, or 'default' for SQUARE_TERMINAL_DEVICE_ID. */
  deviceId?: string
  orderPrefix?: 'POS' | 'KIOSK'
  adminNotes?: string
}

export function getSquareClient(): SquareClient {
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

const centsToDecimal = (cents: number) => new Prisma.Decimal((cents / 100).toFixed(2))

const generateOrderNumber = (prefix: string) => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const randomPart = Math.floor(Math.random() * 9000 + 1000)
  return `${prefix}-${datePart}-${randomPart}`
}

export async function createTerminalCheckout(input: CreateTerminalCheckoutInput) {
  const { items, discountCents = 0, taxCents = 0, totalCents, deviceId = 'default', orderPrefix = 'POS' } = input

  const resolvedDeviceId = deviceId === 'default' ? process.env.SQUARE_TERMINAL_DEVICE_ID || '' : deviceId
  if (!resolvedDeviceId) {
    throw new TerminalCheckoutError('No Square Terminal device configured. Set SQUARE_TERMINAL_DEVICE_ID.', 503)
  }

  const subtotalCents = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0)

  // Costs come from the database, not the till payload — the client has no business
  // asserting what stock cost us, and a POS sale should be as margin-visible as a web one.
  const costByProduct = new Map(
    (
      await prisma.product.findMany({
        where: { id: { in: items.map((item) => item.productId) } },
        select: { id: true, costPrice: true },
      })
    ).map((product) => [product.id, product.costPrice])
  )

  const orderItems = items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: centsToDecimal(item.unitPriceCents),
    // Snapshotted at the moment of sale; null stays null rather than becoming zero.
    unitCost: costByProduct.get(item.productId) ?? undefined,
    totalPrice: centsToDecimal(item.unitPriceCents * item.quantity),
    productName: item.name,
    productSku: item.sku ?? '',
  }))

  try {
    await reserveMultipleProducts(
      items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        notes: `${orderPrefix} terminal checkout reservation`,
      }))
    )
  } catch (error: unknown) {
    throw new TerminalCheckoutError(error instanceof Error ? error.message : 'Unable to reserve inventory', 400)
  }

  // Tracked so the catch below can mark the order as already-released, keeping the
  // expire-pending-orders sweep from releasing the same reservation twice.
  let createdOrderId: string | null = null

  // Create DB order, then Square Terminal checkout. Release inventory on failure.
  try {
    const orderNumber = generateOrderNumber(orderPrefix)

    const order = await prisma.order.create({
      data: {
        orderNumber,
        subtotal: centsToDecimal(subtotalCents),
        shippingCost: centsToDecimal(0),
        tax: centsToDecimal(taxCents),
        discountAmount: centsToDecimal(discountCents),
        total: centsToDecimal(totalCents),
        paymentStatus: 'PENDING',
        status: 'PENDING',
        paymentProvider: 'SQUARE',
        paymentChannel: 'POS',
        salesChannel: 'POS',
        shippingMethod: 'IN_STORE_PICKUP',
        adminNotes: input.adminNotes,
        items: {
          create: orderItems,
        },
      },
    })

    createdOrderId = order.id

    await emitOrderCreated({
      id: order.id,
      orderNumber: order.orderNumber,
      total: order.total,
      salesChannel: order.salesChannel,
      itemCount: orderItems.length,
    })

    const response = await getSquareClient().terminal.checkouts.create({
      idempotencyKey: randomUUID(),
      checkout: {
        amountMoney: {
          amount: BigInt(totalCents),
          currency: 'USD',
        },
        referenceId: order.id,
        note: `Order ${orderNumber}`,
        deviceOptions: {
          deviceId: resolvedDeviceId,
        },
      },
    })

    const terminalCheckout = response.checkout
    if (!terminalCheckout?.id) {
      throw new Error('Square Terminal did not return a checkout ID')
    }

    await prisma.order.update({
      where: { id: order.id },
      data: { providerPaymentId: terminalCheckout.id },
    })

    return { checkoutId: terminalCheckout.id, orderId: order.id, orderNumber }
  } catch (postReservationError) {
    console.error(`[${orderPrefix}] Terminal checkout creation failed, releasing inventory:`, postReservationError)
    for (const item of items) {
      try {
        await releaseInventory({
          productId: item.productId,
          quantity: item.quantity,
          notes: `${orderPrefix} terminal checkout failed - releasing reservation`,
        })
      } catch (releaseError) {
        console.error(`[${orderPrefix}] Failed to release reservation:`, releaseError)
      }
    }
    // The reservation is back, but the order row survives this failure as PENDING.
    // Mark it so the expire-pending-orders sweep does not release it a second time.
    if (createdOrderId) {
      await prisma.order
        .updateMany({
          where: { id: createdOrderId, inventoryReleasedAt: null },
          data: { inventoryReleasedAt: new Date() },
        })
        .catch((markError) => console.error(`[${orderPrefix}] Failed to mark reservation released:`, markError))
    }
    throw postReservationError
  }
}

export function mapSquareTerminalStatus(status: string | undefined): TerminalStatus {
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

/**
 * Ask Square where the checkout stands and settle the order to match: a completed
 * checkout is recorded as paid and its stock deducted; a canceled or failed one
 * releases its reservation. Safe to call repeatedly.
 */
export async function syncTerminalCheckout(checkoutId: string) {
  const response = await getSquareClient().terminal.checkouts.get({ checkoutId })
  const terminalCheckout = response.checkout
  if (!terminalCheckout) {
    throw new TerminalCheckoutError('Terminal checkout not found', 404)
  }

  const status = mapSquareTerminalStatus(terminalCheckout.status)

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
    throw new TerminalCheckoutError('Order not found for this terminal checkout', 404)
  }

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
        console.error(`[POS] Alert sync failed for product ${productId} (order ${order.id}):`, alertError)
      }
    }
  }

  if ((status === 'CANCELED' || status === 'FAILED') && order.paymentStatus === 'PENDING') {
    await releaseOrderReservation(order.id, `POS terminal checkout ${status.toLowerCase()} for order ${order.id}`)

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'FAILED',
        status: 'CANCELLED',
      },
    })
  }

  return { status, orderId: order.id, orderNumber: order.orderNumber }
}

/** Withdraw a checkout from the Terminal screen (the customer walked away or backed out). */
export async function cancelTerminalCheckout(checkoutId: string) {
  try {
    await getSquareClient().terminal.checkouts.cancel({ checkoutId })
  } catch (error) {
    // Square refuses to cancel a checkout the customer already paid; the sync below
    // then records the sale instead of losing it.
    console.warn(`[POS] Terminal cancel refused for ${checkoutId}:`, error)
  }
  return syncTerminalCheckout(checkoutId)
}
