/**
 * Cash sales at the staff POS. Unlike a card sale there is no processor to wait on, so the
 * order, its payment and the stock deduction are written in one transaction: either the
 * sale is fully on the books or nothing is.
 *
 * Amounts are cents, matching `lib/pos/terminal-checkout.ts`.
 */
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { bulkAdjustInventoryInTx, checkAndUpdateAlerts } from '@/lib/inventory-manager'
import { emitOrderCreated } from '@/lib/orders/events'
import { emitDomainEvent } from '@/lib/domain-events/emit'

/** An error the route can show as-is, with the HTTP status to use. */
export class CashSaleError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

export interface CashSaleLineItem {
  productId: string
  name: string
  sku?: string
  unitPriceCents: number
  quantity: number
}

export interface RecordCashSaleInput {
  items: CashSaleLineItem[]
  taxCents: number
  totalCents: number
  tenderedCents: number
  userId?: string
}

const centsToDecimal = (cents: number) => new Prisma.Decimal((cents / 100).toFixed(2))

const generateOrderNumber = () => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const randomPart = Math.floor(Math.random() * 9000 + 1000)
  return `POS-${datePart}-${randomPart}`
}

export async function recordCashSale(input: RecordCashSaleInput) {
  const { items, taxCents, totalCents, tenderedCents, userId } = input

  const subtotalCents = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0)
  if (subtotalCents + taxCents !== totalCents) {
    throw new CashSaleError('Total does not match the items and tax', 400)
  }
  if (tenderedCents < totalCents) {
    throw new CashSaleError('Cash tendered is less than the total', 400)
  }

  const costByProduct = new Map(
    (
      await prisma.product.findMany({
        where: { id: { in: items.map((item) => item.productId) } },
        select: { id: true, costPrice: true },
      })
    ).map((product) => [product.id, product.costPrice])
  )

  const orderNumber = generateOrderNumber()
  const changeCents = tenderedCents - totalCents

  let deductions: Awaited<ReturnType<typeof bulkAdjustInventoryInTx>>
  let order: { id: string; orderNumber: string; total: Prisma.Decimal }
  try {
    ;({ order, deductions } = await prisma.$transaction(
      async (tx) => {
        const created = await tx.order.create({
          data: {
            orderNumber,
            userId,
            subtotal: centsToDecimal(subtotalCents),
            shippingCost: centsToDecimal(0),
            tax: centsToDecimal(taxCents),
            discountAmount: centsToDecimal(0),
            total: centsToDecimal(totalCents),
            paymentStatus: 'PAID',
            status: 'CONFIRMED',
            paymentMethod: 'cash',
            paymentProvider: null,
            paymentChannel: 'POS',
            salesChannel: 'POS',
            shippingMethod: 'IN_STORE_PICKUP',
            items: {
              create: items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: centsToDecimal(item.unitPriceCents),
                unitCost: costByProduct.get(item.productId) ?? undefined,
                totalPrice: centsToDecimal(item.unitPriceCents * item.quantity),
                productName: item.name,
                productSku: item.sku ?? '',
              })),
            },
          },
          select: { id: true, orderNumber: true, total: true },
        })

        await tx.payment.create({
          data: {
            orderId: created.id,
            amount: totalCents,
            currency: 'usd',
            status: 'SUCCEEDED',
            provider: null,
            channel: 'POS',
            methodType: 'CASH',
            paymentMethod: 'cash',
            paidAt: new Date(),
            metadata: { tenderedCents, changeCents },
          },
        })

        // Refuses (and rolls the whole sale back) if the shelf count cannot cover it.
        const results = await bulkAdjustInventoryInTx(
          items.map((item) => ({
            productId: item.productId,
            quantity: -item.quantity,
            type: 'SALE' as const,
            orderId: created.id,
            userId,
            notes: `POS cash sale ${orderNumber}`,
          })),
          tx
        )

        await emitDomainEvent(
          {
            type: 'payment.completed',
            entityType: 'order',
            entityId: created.id,
            payload: { provider: 'CASH', channel: 'POS', amount: totalCents, currency: 'usd' },
          },
          tx
        )

        return { order: created, deductions: results }
      },
      { isolationLevel: 'Serializable' }
    ))
  } catch (error: unknown) {
    if (error instanceof Error && /Insufficient inventory|below reserved stock|Product not found/.test(error.message)) {
      throw new CashSaleError(error.message, 400)
    }
    throw error
  }

  await emitOrderCreated({
    id: order.id,
    orderNumber: order.orderNumber,
    total: order.total,
    salesChannel: 'POS',
    itemCount: items.length,
    actorUserId: userId,
  })

  for (const { product, newStock } of deductions) {
    try {
      await checkAndUpdateAlerts(product.id, newStock, product.lowStockThreshold)
    } catch (alertError) {
      console.error(`[POS] Alert sync failed for product ${product.id} (order ${order.id}):`, alertError)
    }
  }

  return { orderId: order.id, orderNumber: order.orderNumber, changeCents }
}
