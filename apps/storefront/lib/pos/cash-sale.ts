/**
 * Cash sales at the staff POS. Unlike a card sale there is no processor to wait on, so the
 * order, its payment and the stock deduction are written in one transaction: either the
 * sale is fully on the books or nothing is.
 *
 * Amounts are cents, matching `lib/pos/terminal-checkout.ts`. Prices, names and SKUs come
 * from the product records, not the register, so a stale or tampered tab cannot set them.
 */
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { bulkAdjustInventoryInTx, checkAndUpdateAlerts, withSerializableRetry } from '@/lib/inventory-manager'
import { emitOrderCreated } from '@/lib/orders/events'
import { emitDomainEvent } from '@/lib/domain-events/emit'
import { quotePosTaxCents } from '@/lib/pos/tax'

/** An error the route can show as-is, with the HTTP status to use. */
export class CashSaleError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

export interface CashSaleLineItem {
  productId: string
  quantity: number
}

export interface RecordCashSaleInput {
  items: CashSaleLineItem[]
  /** What the register showed the customer; refused if it no longer matches current prices and tax. */
  totalCents: number
  tenderedCents: number
  /** Reused across retries of one sale so a lost response can't record it twice. */
  attemptId: string
  /** The cashier. Recorded as the actor, never as the order's customer. */
  userId?: string
}

const centsToDecimal = (cents: number) => new Prisma.Decimal((cents / 100).toFixed(2))

// A retried attempt must land on the same order, so its number comes from the attempt alone.
const orderNumberFor = (attemptId: string) => `POS-${attemptId.replace(/-/g, '').slice(0, 12).toUpperCase()}`

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'

export async function recordCashSale(input: RecordCashSaleInput) {
  const { items, totalCents, tenderedCents, attemptId, userId } = input
  const orderNumber = orderNumberFor(attemptId)
  const changeCents = tenderedCents - totalCents

  const existing = await prisma.order.findUnique({ where: { orderNumber }, select: { id: true } })
  if (existing) return { orderId: existing.id, orderNumber, changeCents }

  if (tenderedCents < totalCents) {
    throw new CashSaleError('Cash tendered is less than the total', 400)
  }

  const products = await prisma.product.findMany({
    where: { id: { in: items.map((item) => item.productId) }, isActive: true },
    select: { id: true, name: true, sku: true, price: true, costPrice: true },
  })
  const productById = new Map(products.map((product) => [product.id, product]))
  const lines = items.map((item) => {
    const product = productById.get(item.productId)
    if (!product) {
      throw new CashSaleError('An item in the cart is not an active product. Reload the register.', 400)
    }
    return { ...item, product, unitPriceCents: Math.round(Number(product.price) * 100) }
  })

  const subtotalCents = lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0)
  // Tax is quoted here like a card sale's (lib/pos/tax), never taken from the register.
  const taxCents = await quotePosTaxCents(
    lines.map((line) => ({ productId: line.productId, unitPriceCents: line.unitPriceCents, quantity: line.quantity }))
  )
  if (subtotalCents + taxCents !== totalCents) {
    throw new CashSaleError('Prices or tax have changed since the register loaded. Reload and try again.', 409)
  }

  let deductions: Awaited<ReturnType<typeof bulkAdjustInventoryInTx>>
  let order: { id: string; orderNumber: string; total: Prisma.Decimal }
  try {
    ;({ order, deductions } = await withSerializableRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const created = await tx.order.create({
            data: {
              orderNumber,
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
                create: lines.map((line) => ({
                  productId: line.productId,
                  quantity: line.quantity,
                  unitPrice: centsToDecimal(line.unitPriceCents),
                  unitCost: line.product.costPrice ?? undefined,
                  totalPrice: centsToDecimal(line.unitPriceCents * line.quantity),
                  productName: line.product.name,
                  productSku: line.product.sku,
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
            lines.map((line) => ({
              productId: line.productId,
              quantity: -line.quantity,
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
              actorUserId: userId ?? null,
              payload: { provider: 'CASH', channel: 'POS', amount: totalCents, currency: 'usd' },
            },
            tx
          )

          return { order: created, deductions: results }
        },
        { isolationLevel: 'Serializable' }
      )
    ))
  } catch (error: unknown) {
    // The same attempt arrived twice at once and the other request recorded it first.
    if (isUniqueViolation(error)) {
      const recorded = await prisma.order.findUnique({ where: { orderNumber }, select: { id: true } })
      if (recorded) return { orderId: recorded.id, orderNumber, changeCents }
    }
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
    itemCount: lines.length,
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
