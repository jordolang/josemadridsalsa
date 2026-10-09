import { randomUUID } from 'crypto'
import { z } from 'zod'
import type { Order as SquareOrder } from 'square'
import prisma from '@/lib/prisma'
import { getSquareClient } from '@/lib/payments/providers/square'
import { createPrintifyOrder, getPrintifyShopIds, type PrintifyAddress } from '@/lib/printify/client'
import { getMerchProduct } from '@/lib/merchandise/catalog'
import { MERCH_MAX_QUANTITY } from '@/lib/merchandise/shared'

/**
 * Merch checkout: the customer pays on a Square-hosted payment link (which also collects the
 * shipping address), and once Square shows the order paid it is sent to Printify to print
 * and ship. Merch never touches the salsa cart, inventory or `Order` table — Printify holds
 * the catalog and the stock.
 *
 * An order reaches Printify by whichever comes first: the buyer landing on the thank-you
 * page, or the `merch-orders` cron sweeping paid orders whose buyer closed the tab.
 */

/** Flat shipping charged to the customer: Printify bills us per item, first item highest. */
export const MERCH_SHIPPING_FIRST_ITEM_CENTS = 699
export const MERCH_SHIPPING_ADDITIONAL_ITEM_CENTS = 250
/** How long an unpaid payment link is worth checking before the order is written off. */
export const MERCH_PAYMENT_WINDOW_DAYS = 7

export const merchCheckoutSchema = z.object({
  productId: z.string().regex(/^[a-f0-9]{24}$/i),
  variantId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(MERCH_MAX_QUANTITY),
})

export type MerchCheckoutInput = z.infer<typeof merchCheckoutSchema>

export type MerchOrderItem = {
  /** Missing on orders placed before the site sold from more than one Printify shop. */
  shopId?: string
  productId: string
  variantId: number
  quantity: number
  title: string
  variantTitle: string
  unitPriceCents: number
}

export function merchShippingCents(quantity: number): number {
  if (quantity <= 0) return 0
  return MERCH_SHIPPING_FIRST_ITEM_CENTS + (quantity - 1) * MERCH_SHIPPING_ADDITIONAL_ITEM_CENTS
}

export class MerchCheckoutError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'MerchCheckoutError'
  }
}

function squareLocationId(): string {
  const locationId = process.env.SQUARE_LOCATION_ID?.trim()
  if (!locationId) throw new MerchCheckoutError('Checkout is not available right now.', 503)
  return locationId
}

/**
 * Prices the item from Printify (never from the request), records the pending order and
 * returns the Square payment link to send the customer to.
 */
export async function createMerchCheckout(input: MerchCheckoutInput, origin: string): Promise<{ url: string }> {
  // Read the product uncached so a price change in Printify applies to the very next sale.
  const product = await getMerchProduct(input.productId, 0)
  const variant = product?.variants.find((candidate) => candidate.id === input.variantId)
  if (!product || !variant) {
    throw new MerchCheckoutError('That item is no longer available.', 404)
  }

  const locationId = squareLocationId()
  const item: MerchOrderItem = {
    shopId: product.shopId,
    productId: product.id,
    variantId: variant.id,
    quantity: input.quantity,
    title: product.title,
    variantTitle: variant.title,
    unitPriceCents: variant.priceCents,
  }
  const shippingCents = merchShippingCents(item.quantity)
  const totalCents = item.unitPriceCents * item.quantity + shippingCents
  const merchOrderId = randomUUID()

  const response = await getSquareClient().checkout.paymentLinks.create({
    idempotencyKey: merchOrderId,
    order: {
      locationId,
      referenceId: `merch-${merchOrderId}`.slice(0, 40),
      metadata: { source: 'printify-merch', merchOrderId },
      lineItems: [
        {
          name: `${item.title} (${item.variantTitle})`.slice(0, 512),
          quantity: String(item.quantity),
          basePriceMoney: { amount: BigInt(item.unitPriceCents), currency: 'USD' },
          metadata: { printifyProductId: item.productId, printifyVariantId: String(item.variantId) },
        },
      ],
    },
    checkoutOptions: {
      askForShippingAddress: true,
      shippingFee: {
        name: 'Standard shipping',
        charge: { amount: BigInt(shippingCents), currency: 'USD' },
      },
      redirectUrl: `${origin}/merchandise/order-complete?ref=${merchOrderId}`,
    },
  })

  const link = response.paymentLink
  if (!link?.url || !link.orderId) {
    console.error('Square did not return a merch payment link', response.errors)
    throw new MerchCheckoutError('Checkout is not available right now.', 502)
  }

  await prisma.merchOrder.create({
    data: {
      id: merchOrderId,
      squareOrderId: link.orderId,
      squarePaymentLinkId: link.id ?? null,
      items: [item],
      totalCents,
    },
  })

  return { url: link.url }
}

/** Paid in full at our location, for the amount we priced. */
export function isSquareOrderPaid(order: SquareOrder, locationId: string, expectedTotalCents: number): boolean {
  if (order.locationId !== locationId) return false
  if (order.state === 'CANCELED') return false
  if (!order.tenders || order.tenders.length === 0) return false
  if (Number(order.netAmountDueMoney?.amount ?? 0) !== 0) return false
  return Number(order.totalMoney?.amount ?? 0) === expectedTotalCents
}

function splitName(displayName: string | null | undefined): { first: string; last: string } {
  const parts = (displayName ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first: 'Customer', last: '' }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

/** The shipping address Square collected on the payment link, in Printify's shape. */
export function squareShippingAddress(order: SquareOrder): PrintifyAddress | null {
  const recipient = order.fulfillments?.find((fulfillment) => fulfillment.shipmentDetails?.recipient)?.shipmentDetails
    ?.recipient
  const address = recipient?.address
  if (!recipient || !address?.addressLine1 || !address.locality || !address.postalCode || !address.country) {
    return null
  }

  const fallback = splitName(recipient.displayName)
  return {
    first_name: address.firstName?.trim() || fallback.first,
    last_name: address.lastName?.trim() || fallback.last,
    ...(recipient.emailAddress ? { email: recipient.emailAddress } : {}),
    ...(recipient.phoneNumber ? { phone: recipient.phoneNumber } : {}),
    country: address.country,
    region: address.administrativeDistrictLevel1 ?? '',
    address1: address.addressLine1,
    ...(address.addressLine2 ? { address2: address.addressLine2 } : {}),
    city: address.locality,
    zip: address.postalCode,
  }
}

export type MerchFulfillmentResult =
  | { status: 'submitted'; printifyOrderId: string | null }
  | { status: 'processing' }
  | { status: 'awaiting-payment' }
  | { status: 'failed'; error: string }
  | { status: 'not-found' }

/**
 * Sends a paid merch order to Printify, once. Safe to call repeatedly and concurrently:
 * the order is claimed (moved to SUBMITTING) before Printify is called, so the thank-you
 * page and the sweep cannot both submit it.
 */
export async function fulfillMerchOrder(merchOrderId: string): Promise<MerchFulfillmentResult> {
  const record = await prisma.merchOrder.findUnique({ where: { id: merchOrderId } })
  if (!record) return { status: 'not-found' }
  if (record.status === 'SUBMITTED') return { status: 'submitted', printifyOrderId: record.printifyOrderId }
  if (record.status === 'SUBMITTING') return { status: 'processing' }

  const { order } = await getSquareClient().orders.get({ orderId: record.squareOrderId })
  if (!order || !isSquareOrderPaid(order, squareLocationId(), record.totalCents)) {
    return { status: 'awaiting-payment' }
  }

  const claimed = await prisma.merchOrder.updateMany({
    where: { id: record.id, status: { in: ['AWAITING_PAYMENT', 'FAILED', 'EXPIRED'] } },
    data: { status: 'SUBMITTING' },
  })
  if (claimed.count === 0) return fulfillMerchOrderStatus(record.id)

  const address = squareShippingAddress(order)
  const customerName = address ? `${address.first_name} ${address.last_name}`.trim() : null
  const customerEmail = address?.email ?? null

  try {
    if (!address) throw new Error('Square order has no shipping address')
    const items = record.items as MerchOrderItem[]
    const shopId = items[0]?.shopId ?? (await getPrintifyShopIds())[0]
    const created = await createPrintifyOrder(shopId, {
      external_id: record.squareOrderId,
      label: `Jose Madrid merch ${record.id.slice(0, 8)}`,
      line_items: items.map((item) => ({
        product_id: item.productId,
        variant_id: item.variantId,
        quantity: item.quantity,
      })),
      shipping_method: 1,
      send_shipping_notification: Boolean(customerEmail),
      address_to: address,
    })

    await prisma.merchOrder.update({
      where: { id: record.id },
      data: {
        status: 'SUBMITTED',
        printifyOrderId: created.id,
        customerName,
        customerEmail,
        lastError: null,
        submittedAt: new Date(),
      },
    })
    return { status: 'submitted', printifyOrderId: created.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Failed to send merch order to Printify', { merchOrderId: record.id, error: message })
    await prisma.merchOrder.update({
      where: { id: record.id },
      data: { status: 'FAILED', lastError: message.slice(0, 1000), customerName, customerEmail },
    })
    return { status: 'failed', error: message }
  }
}

async function fulfillMerchOrderStatus(merchOrderId: string): Promise<MerchFulfillmentResult> {
  const record = await prisma.merchOrder.findUnique({ where: { id: merchOrderId } })
  if (!record) return { status: 'not-found' }
  if (record.status === 'SUBMITTED') return { status: 'submitted', printifyOrderId: record.printifyOrderId }
  if (record.status === 'FAILED') return { status: 'failed', error: record.lastError ?? 'Unknown error' }
  return { status: 'processing' }
}

/**
 * Cron sweep: submit paid orders nobody came back for, retry ones Printify refused, and
 * write off payment links left unpaid past the window.
 */
export async function sweepMerchOrders(now = new Date(), limit = 50) {
  const windowStart = new Date(now.getTime() - MERCH_PAYMENT_WINDOW_DAYS * 24 * 60 * 60 * 1000)

  const expired = await prisma.merchOrder.updateMany({
    where: { status: 'AWAITING_PAYMENT', createdAt: { lt: windowStart } },
    data: { status: 'EXPIRED' },
  })

  const due = await prisma.merchOrder.findMany({
    where: { status: { in: ['AWAITING_PAYMENT', 'FAILED'] }, createdAt: { gte: windowStart } },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { id: true },
  })

  const results: Record<MerchFulfillmentResult['status'], number> = {
    submitted: 0,
    processing: 0,
    'awaiting-payment': 0,
    failed: 0,
    'not-found': 0,
  }
  for (const { id } of due) {
    try {
      const result = await fulfillMerchOrder(id)
      results[result.status] += 1
    } catch (error) {
      console.error('Merch order sweep failed for order', { merchOrderId: id, error })
      results.failed += 1
    }
  }

  return { checked: due.length, expired: expired.count, ...results }
}
