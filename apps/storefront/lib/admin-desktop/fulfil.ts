/**
 * The orders the receipt printer and the pack sheet work from.
 *
 * Both read the same thing: a paid order that still has jars to send. The
 * receipt poll asks for those that changed since it last looked (an order is
 * created unpaid and paid a moment later, so "created since" would miss the
 * ones paid after the poll went by), and the desktop app keeps the list of
 * order ids it has already printed, so a ticket comes out once per order
 * however many times the order is saved afterwards.
 */

import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { toNumber } from './format'
import type { PackLine } from './pack'
import { packingSlipHtml, type PackingSlipOrder } from './packing-slip'
import { isRealPostage } from '@/lib/shipping/rate-selection'
import { buildReceipt, receiptBase64, type ReceiptOrder } from './receipt'

/**
 * Paid, or an exchange replacement (which has nothing to pay but still has to
 * go out), with something left to ship.
 */
const TO_FULFIL = {
  OR: [{ paymentStatus: { in: ['PAID', 'SUCCEEDED'] } }, { exchangeForReturnId: { not: null } }],
  fulfillmentStatus: { in: ['UNFULFILLED', 'PARTIALLY_FULFILLED'] },
  status: { notIn: ['CANCELLED', 'REFUNDED'] },
} satisfies Prisma.OrderWhereInput

/** How far back a receipt poll may reach: an app left closed over a long weekend still catches up. */
export const RECEIPT_LOOKBACK_MS = 4 * 24 * 60 * 60 * 1000

/** A burst bigger than this is printed over the next few polls rather than all at once. */
export const RECEIPT_BATCH = 25

const ORDER_INCLUDE = {
  items: { orderBy: { createdAt: 'asc' }, include: { product: { select: { sku: true, barcode: true } } } },
  shippingAddress: true,
  user: { select: { name: true, email: true } },
  fundraiser: { select: { name: true } },
  shippingLabels: {
    select: { id: true, labelUrl: true, trackingNumber: true, trackingCode: true, carrierResponse: true },
    orderBy: { createdAt: 'desc' },
  },
} satisfies Prisma.OrderInclude

type FulfilOrder = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>

function customerName(order: FulfilOrder): string {
  const address = order.shippingAddress
  const named = address ? `${address.firstName} ${address.lastName}`.trim() : ''
  return named || order.user?.name || order.user?.email || order.guestEmail || 'Walk-in customer'
}

function addressLines(order: FulfilOrder): string[] {
  const address = order.shippingAddress
  if (!address) return []
  return [
    address.company,
    address.street,
    `${address.city}, ${address.state} ${address.zipCode}`,
    address.country && address.country !== 'US' ? address.country : null,
  ].filter((line): line is string => Boolean(line?.trim()))
}

export function receiptOrder(order: FulfilOrder): ReceiptOrder {
  return {
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    salesChannel: order.salesChannel,
    fundraiserName: order.fundraiser?.name ?? null,
    customerName: customerName(order),
    email: order.user?.email ?? order.guestEmail,
    phone: order.shippingAddress?.phone ?? order.guestPhone,
    address: addressLines(order),
    shippingMethod: order.shippingMethod,
    items: order.items.map((item) => ({ quantity: item.quantity, name: item.productName, sku: item.productSku })),
    subtotal: toNumber(order.subtotal),
    shipping: toNumber(order.shippingCost),
    tax: toNumber(order.tax),
    discount: toNumber(order.discountAmount) + toNumber(order.giftCertificateAmount),
    total: toNumber(order.total),
    customerNotes: order.customerNotes,
  }
}

export interface ReceiptJob {
  orderId: string
  orderNumber: string
  /** When the order was placed. The app prints nothing placed before receipts were switched on. */
  createdAt: string
  /** ESC/POS bytes, base64. */
  data: string
}

function receiptJob(order: FulfilOrder): ReceiptJob {
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    createdAt: order.createdAt.toISOString(),
    data: receiptBase64(buildReceipt(receiptOrder(order))),
  }
}

/** Where a poll may start from: what it asked for, but never further back than the lookback. */
export function receiptWindowStart(since: Date | null, now: Date): Date {
  const floor = new Date(now.getTime() - RECEIPT_LOOKBACK_MS)
  return since && since > floor ? since : floor
}

/**
 * Orders to fulfil that changed after `since`, in the order they changed, and
 * where the next poll should start. A burst bigger than one batch hands back
 * the last time it reached, so the rest come out on the next poll rather than
 * being skipped. Every order sharing that last time comes out in this batch,
 * since the next poll starts strictly after it.
 */
export async function loadReceipts(
  since: Date | null,
  now = new Date(),
): Promise<{ receipts: ReceiptJob[]; next: Date; more: boolean }> {
  const orders = await prisma.order.findMany({
    where: { ...TO_FULFIL, updatedAt: { gt: receiptWindowStart(since, now) } },
    include: ORDER_INCLUDE,
    orderBy: { updatedAt: 'asc' },
    take: RECEIPT_BATCH,
  })
  const more = orders.length === RECEIPT_BATCH
  if (!more) return { receipts: orders.map(receiptJob), next: now, more }

  const last = orders[orders.length - 1].updatedAt
  const ties = await prisma.order.findMany({
    where: { ...TO_FULFIL, updatedAt: last, id: { notIn: orders.map((order) => order.id) } },
    include: ORDER_INCLUDE,
  })
  return { receipts: [...orders, ...ties].map(receiptJob), next: last, more }
}

/** One order's ticket, for a reprint. Any order — a reprint does not care whether it shipped. */
export async function loadReceipt(orderId: string): Promise<ReceiptJob | null> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE })
  return order ? receiptJob(order) : null
}

export interface PackOrder {
  id: string
  orderNumber: string
  customerName: string
  address: string[]
  shippingMethod: string | null
  /** Why this order cannot be packed here, if it cannot. */
  blocked: string | null
  /** Postage already on the order, so the sheet can reprint rather than buy again. */
  label: { labelUrl: string | null; trackingNumber: string } | null
  lines: PackLine[]
  /** The insert for the box, ready to print. */
  slipHtml: string
}

function packBlock(order: FulfilOrder): string | null {
  if (order.status === 'CANCELLED' || order.status === 'REFUNDED') return `${order.orderNumber} is ${order.status.toLowerCase()}.`
  const paid = order.paymentStatus === 'PAID' || order.paymentStatus === 'SUCCEEDED' || order.exchangeForReturnId
  if (!paid) return `${order.orderNumber} is not paid yet.`
  if (order.fulfillmentStatus !== 'UNFULFILLED' && order.fulfillmentStatus !== 'PARTIALLY_FULFILLED') {
    return `${order.orderNumber} has already shipped.`
  }
  if (!order.shippingAddress) return `${order.orderNumber} has no shipping address, so there is no label to buy.`
  return null
}

export function packingSlipOrder(order: FulfilOrder): PackingSlipOrder {
  return {
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    customerName: customerName(order),
    address: addressLines(order),
    shippingMethod: order.shippingMethod,
    trackingNumber: order.trackingNumber ?? order.shippingLabels.find(isRealPostage)?.trackingNumber ?? null,
    customerNotes: order.customerNotes,
    fundraiserName: order.fundraiser?.name ?? null,
    items: order.items.map((item) => ({ quantity: item.quantity, name: item.productName, sku: item.productSku })),
  }
}

/**
 * An order to pack, by id or by order number — the receipt's barcode is the
 * order number, and scanners differ on whether they keep its case.
 */
export async function loadPackOrder(reference: string): Promise<PackOrder | null> {
  const ref = reference.trim()
  if (!ref) return null
  const order = await prisma.order.findFirst({
    where: { OR: [{ id: ref }, { orderNumber: { equals: ref, mode: 'insensitive' } }] },
    include: ORDER_INCLUDE,
  })
  if (!order) return null

  // The same test the label route uses before refusing to buy twice.
  const label = order.shippingLabels.find(isRealPostage)
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: customerName(order),
    address: addressLines(order),
    shippingMethod: order.shippingMethod,
    blocked: packBlock(order),
    label: label ? { labelUrl: label.labelUrl, trackingNumber: label.trackingNumber ?? label.trackingCode ?? '' } : null,
    lines: order.items
      .map((item) => ({
        id: item.id,
        name: item.productName,
        // The product's current SKU, which is what is on the jar; the snapshot if the product row lost it.
        sku: item.product?.sku || item.productSku,
        barcode: item.product?.barcode ?? null,
        quantity: Math.max(item.quantity - item.quantityFulfilled, 0),
        packed: 0,
      }))
      .filter((line) => line.quantity > 0),
    slipHtml: packingSlipHtml(packingSlipOrder(order)),
  }
}
