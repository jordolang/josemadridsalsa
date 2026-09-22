/**
 * The facts behind a customer email.
 *
 * The classifier is only allowed to answer a question when the answer is sitting in front
 * of it. This module is what puts it there: it resolves the sender to a customer, finds the
 * orders that are plausibly what they are writing about, and pulls any fundraiser they are
 * attached to. What it cannot find, it returns as absent — and an absent fact is what stops
 * a reply being sent, rather than something the model is invited to fill in.
 */

import { prisma } from '@/lib/prisma'

/** Order numbers as they appear in mail: `JMS-1043`, `#1043`, `order 1043`. */
export function extractOrderNumbers(text: string): string[] {
  const found = new Set<string>()

  for (const match of text.matchAll(/\b([A-Z]{2,5}-\d{3,10})\b/g)) {
    found.add(match[1].toUpperCase())
  }

  for (const match of text.matchAll(/(?:order|invoice|#)\s*#?\s*(\d{3,10})\b/gi)) {
    found.add(match[1])
  }

  return [...found].slice(0, 5)
}

export interface OrderFact {
  id: string
  orderNumber: string
  status: string
  paymentStatus: string
  fulfillmentStatus: string
  total: string
  placedAt: string
  shippedAt: string | null
  deliveredAt: string | null
  trackingNumber: string | null
  trackingUrl: string | null
  carrierName: string | null
  items: string[]
}

export interface EmailContext {
  customer: {
    id: string
    name: string | null
    email: string
    totalOrders: number
    lastOrderAt: string | null
  } | null
  /** Orders belonging to the sender, most recent first. */
  orders: OrderFact[]
  /** Orders named in the message body that are *not* the sender's, kept separate so a
   *  reply never discloses someone else's order to whoever happened to write in. */
  referencedForeignOrderNumbers: string[]
  fundraiser: {
    id: string
    name: string
    status: string
    endDate: string | null
  } | null
}

function displayName(first: string | null, last: string | null): string | null {
  const name = [first, last].filter(Boolean).join(' ').trim()
  return name || null
}

function toFact(order: {
  id: string
  orderNumber: string
  status: string
  paymentStatus: string
  fulfillmentStatus: string
  total: unknown
  createdAt: Date
  shippedAt: Date | null
  deliveredAt: Date | null
  trackingNumber: string | null
  trackingUrl: string | null
  carrierName: string | null
  items: Array<{ productName: string; quantity: number }>
}): OrderFact {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    total: String(order.total),
    placedAt: order.createdAt.toISOString().slice(0, 10),
    shippedAt: order.shippedAt?.toISOString().slice(0, 10) ?? null,
    deliveredAt: order.deliveredAt?.toISOString().slice(0, 10) ?? null,
    trackingNumber: order.trackingNumber,
    trackingUrl: order.trackingUrl,
    carrierName: order.carrierName,
    items: order.items.map((item) => `${item.quantity}× ${item.productName}`),
  }
}

const ORDER_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  paymentStatus: true,
  fulfillmentStatus: true,
  total: true,
  createdAt: true,
  shippedAt: true,
  deliveredAt: true,
  trackingNumber: true,
  trackingUrl: true,
  carrierName: true,
  fundraiserId: true,
  items: { select: { productName: true, quantity: true } },
} as const

/**
 * Everything known about the person who wrote in and what they are writing about.
 *
 * Never throws: a context lookup that fails leaves the classifier with less to work with,
 * which makes it escalate to a human — the correct failure direction.
 */
export async function buildEmailContext(
  fromEmail: string,
  messageText: string,
): Promise<EmailContext> {
  const empty: EmailContext = {
    customer: null,
    orders: [],
    referencedForeignOrderNumbers: [],
    fundraiser: null,
  }

  try {
    const email = fromEmail.toLowerCase()

    const [customer, ownOrders] = await Promise.all([
      prisma.customer.findUnique({
        where: { email },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          totalOrders: true,
          lastOrderAt: true,
        },
      }),
      // Both sides of how an order carries an address: a signed-in purchase hangs off the
      // user, a guest checkout carries the address on the order itself.
      prisma.order.findMany({
        where: { OR: [{ guestEmail: email }, { user: { email } }] },
        select: ORDER_SELECT,
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ])

    const mentioned = extractOrderNumbers(messageText)
    const ownNumbers = new Set(ownOrders.map((order) => order.orderNumber))

    // An order number in the body that the sender does not own is recorded but never
    // resolved: it is either a typo or somebody asking about an order that is not theirs,
    // and both need a human rather than an automatic answer containing order details.
    const foreign = mentioned.filter((number) => !ownNumbers.has(number))

    const fundraiserId = ownOrders.find((order) => order.fundraiserId)?.fundraiserId ?? null
    const fundraiser = fundraiserId
      ? await prisma.fundraiser
          .findUnique({
            where: { id: fundraiserId },
            select: { id: true, name: true, status: true, endDate: true },
          })
          .catch(() => null)
      : null

    return {
      customer: customer
        ? {
            id: customer.id,
            name: displayName(customer.firstName, customer.lastName),
            email: customer.email,
            totalOrders: customer.totalOrders,
            lastOrderAt: customer.lastOrderAt?.toISOString().slice(0, 10) ?? null,
          }
        : null,
      orders: ownOrders.map(toFact),
      referencedForeignOrderNumbers: foreign,
      fundraiser: fundraiser
        ? {
            id: fundraiser.id,
            name: fundraiser.name,
            status: String(fundraiser.status),
            endDate: fundraiser.endDate?.toISOString().slice(0, 10) ?? null,
          }
        : null,
    }
  } catch (error) {
    console.warn('[inbox] Could not build context for', fromEmail, error)
    return empty
  }
}
