import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { Prisma, SalesChannel } from '@prisma/client'
import { z } from 'zod'
import {
  ok,
  fail,
  paginated,
  parsePagination,
  parseSearch,
  parseQuery,
} from '@/lib/api'
import { logAuditWithRequest } from '@/lib/audit'
import { bulkAdjustInventoryInTx, checkAndUpdateAlerts } from '@/lib/inventory-manager'
import { emitOrderCreated } from '@/lib/orders/events'
import { deriveSalesChannel } from '@/lib/orders/sales-channel'
import {
  duplicateWindowStart,
  generateManualOrderNumber,
  ManualOrderSchema,
  priceManualOrder,
} from '@/lib/admin/manual-order'

export async function GET(request: NextRequest) {
  await requirePermission('orders:read')

  const { page, limit, skip } = parsePagination(request)
  const search = parseSearch(request)
  const query = parseQuery(request)

  const where: any = {}

  // Search
  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: 'insensitive' } },
      { guestEmail: { contains: search, mode: 'insensitive' } },
      {
        user: {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
          ],
        },
      },
    ]
  }

  // Status filter
  if (query.status && query.status !== 'all') {
    where.status = query.status
  }

  // Sales channel filter (e.g. ?channel=POS for the register's order list)
  if (query.channel) {
    const channel = z.nativeEnum(SalesChannel).safeParse(query.channel.toUpperCase())
    if (!channel.success) return fail(`Unknown channel: ${query.channel}`, 400)
    where.salesChannel = channel.data
  }

  // Date range filter
  if (query.startDate || query.endDate) {
    where.createdAt = {}
    if (query.startDate) {
      where.createdAt.gte = new Date(query.startDate)
    }
    if (query.endDate) {
      where.createdAt.lte = new Date(query.endDate)
    }
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: {
          select: {
            id: true,
            quantity: true,
          },
        },
        // The most recent payment's method, so a list can say "Cash" or "Card".
        payments: {
          select: { methodType: true, provider: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    }),
    prisma.order.count({ where }),
  ])

  return paginated(orders, total, page, limit)
}

/**
 * POST /api/admin/orders
 *
 * Create an order taken somewhere other than the website — phone, wholesale, a festival table.
 * See `lib/admin/manual-order.ts` for why prices, shipping and tax are entered rather than
 * calculated, and why there is no `Payment` row.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('orders:write')

    const parsed = ManualOrderSchema.safeParse(await request.json())
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? 'Invalid order', 400)
    }
    const input = parsed.data

    const products = await prisma.product.findMany({
      where: { id: { in: input.items.map((item) => item.productId) } },
      select: { id: true, name: true, sku: true, price: true, costPrice: true, featuredImage: true },
    })

    if (products.length !== new Set(input.items.map((i) => i.productId)).size) {
      return fail('One or more products could not be found', 400)
    }

    const priced = priceManualOrder(
      input,
      new Map(
        products.map((p) => [
          p.id,
          { ...p, price: Number(p.price), costPrice: p.costPrice === null ? null : Number(p.costPrice) },
        ])
      )
    )

    // The only order path without a natural idempotency key, so an identical order placed
    // seconds ago is treated as a double submission rather than a second sale.
    const now = new Date()
    const recentDuplicate = await prisma.order.findFirst({
      where: {
        guestEmail: input.customer.email.toLowerCase(),
        total: new Prisma.Decimal(priced.total.toFixed(2)),
        createdAt: { gte: duplicateWindowStart(now) },
      },
      select: { id: true, orderNumber: true },
    })

    if (recentDuplicate) {
      return fail(
        `An identical order (${recentDuplicate.orderNumber}) was created moments ago. Refresh to see it, or change something if this really is a second order.`,
        409
      )
    }

    // Stock is committed the moment it is promised, so it comes out whether or not the money
    // has arrived — a phone order awaiting a cheque still means those jars are spoken for.
    // Order creation and inventory deduction in a single transaction for atomicity.
    const order = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber: generateManualOrderNumber(now, Math.random()),
          guestEmail: input.customer.email.toLowerCase(),
          guestPhone: input.customer.phone,
          subtotal: new Prisma.Decimal(priced.subtotal.toFixed(2)),
          discountAmount: new Prisma.Decimal(priced.discountAmount.toFixed(2)),
          shippingCost: new Prisma.Decimal(priced.shippingCost.toFixed(2)),
          tax: new Prisma.Decimal(priced.tax.toFixed(2)),
          total: new Prisma.Decimal(priced.total.toFixed(2)),
          paymentStatus: input.paymentStatus,
          // Free text, because Payment.provider has no honest value for cash or a cheque.
          paymentMethod: input.paymentMethod,
          status: input.paymentStatus === 'PAID' ? 'CONFIRMED' : 'PENDING',
          salesChannel: deriveSalesChannel({ explicitChannel: input.salesChannel }),
          customerNotes: input.notes,
          items: { create: priced.lines },
        },
        select: { id: true, orderNumber: true, total: true },
      })

      // Bulk adjust inventory for all items in a single operation
      await bulkAdjustInventoryInTx(
        priced.lines.map((line) => ({
          productId: line.productId,
          quantity: -line.quantity,
          type: 'SALE' as const,
          reason: `Manual order ${order.orderNumber}`,
          orderId: order.id,
          userId: user.id,
        })),
        tx
      )

      return order
    })

    // Fire inventory alerts after the transaction commits (non-critical)
    const productIds = priced.lines.map((line) => line.productId)
    const updatedProducts = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, inventory: true, lowStockThreshold: true },
    })

    for (const product of updatedProducts) {
      try {
        await checkAndUpdateAlerts(product.id, product.inventory, product.lowStockThreshold)
      } catch (alertError) {
        console.error('[Manual Order] Alert check failed:', {
          orderId: order.id,
          productId: product.id,
          error: alertError,
        })
      }
    }

    await emitOrderCreated({
      id: order.id,
      orderNumber: order.orderNumber,
      total: order.total,
      itemCount: priced.lines.length,
      salesChannel: deriveSalesChannel({ explicitChannel: input.salesChannel }),
      // Unlike every other order path, a person made this one happen.
      actorUserId: user.id,
    })

    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'create',
        entityType: 'order',
        entityId: order.id,
        changes: {
          orderNumber: order.orderNumber,
          salesChannel: input.salesChannel,
          paymentStatus: input.paymentStatus,
          paymentMethod: input.paymentMethod,
          total: priced.total,
          items: priced.lines.map((l) => ({
            sku: l.productSku,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
          })),
        },
      },
      request
    )

    return ok({ id: order.id, orderNumber: order.orderNumber })
  } catch (error) {
    console.error('Manual order creation error:', error)
    return fail('Could not create the order', 500)
  }
}
