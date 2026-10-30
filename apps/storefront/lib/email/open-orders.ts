/**
 * The "Open Orders" mailing list: everyone still waiting on an order.
 *
 * The list is never edited by hand. Each refresh purges every row and rebuilds
 * it from the site's own orders (storefront, fundraiser and BigCommerce-mirrored
 * orders all live in `orders`), so a send to it only reaches people whose order
 * is still open at that moment.
 */

import type { Prisma, SubscriberStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { subscriberStatusFor } from '@/lib/customers/customer-list'

/** Fixed id so the list can be found (and refreshed) without trusting its name. */
export const OPEN_ORDERS_LIST_ID = 'open-orders'
export const OPEN_ORDERS_LIST_NAME = 'Open Orders'
export const OPEN_ORDERS_SOURCE = 'open-orders'

/**
 * An order is open when it has been paid for and has not gone out yet:
 * - payment is PAID or PARTIALLY_REFUNDED (unpaid, failed and refunded orders are not owed anything),
 * - status is PENDING, CONFIRMED or PROCESSING (not SHIPPED, DELIVERED, CANCELLED or REFUNDED),
 * - fulfillment is UNFULFILLED or PARTIALLY_FULFILLED (something is still to ship),
 * - it was not a POS or event sale, which the customer carried away and which
 *   the POS leaves CONFIRMED + UNFULFILLED forever.
 */
export const OPEN_ORDER_WHERE: Prisma.OrderWhereInput = {
  paymentStatus: { in: ['PAID', 'PARTIALLY_REFUNDED'] },
  status: { in: ['PENDING', 'CONFIRMED', 'PROCESSING'] },
  fulfillmentStatus: { in: ['UNFULFILLED', 'PARTIALLY_FULFILLED'] },
  salesChannel: { notIn: ['POS', 'EVENT'] },
}

export interface OpenOrderRow {
  orderNumber: string
  salesChannel: string
  guestEmail: string | null
  guestPhone: string | null
  user: { email: string; name: string | null } | null
  shippingAddress: { firstName: string; lastName: string; phone?: string | null } | null
}

export interface OpenOrderContact {
  email: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  orderNumbers: string[]
  salesChannels: string[]
}

export function normalizeEmail(email: string | null | undefined): string | null {
  const v = email?.trim().toLowerCase()
  return v && v.includes('@') ? v : null
}

function splitName(name: string | null | undefined): [string | null, string | null] {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return [null, null]
  return [parts[0], parts.slice(1).join(' ') || null]
}

/** The address the order's emails go to: the account's, else the guest checkout's. */
export function orderEmail(order: Pick<OpenOrderRow, 'guestEmail' | 'user'>): string | null {
  return normalizeEmail(order.user?.email) ?? normalizeEmail(order.guestEmail)
}

/**
 * One contact per address across all of their open orders. The shipping name
 * wins over the account name: it is who the box is addressed to.
 */
export function buildOpenOrderContacts(orders: OpenOrderRow[]): OpenOrderContact[] {
  const byEmail = new Map<string, OpenOrderContact>()
  for (const order of orders) {
    const email = orderEmail(order)
    if (!email) continue

    const shipFirst = order.shippingAddress?.firstName?.trim() || null
    const shipLast = order.shippingAddress?.lastName?.trim() || null
    const [userFirst, userLast] = splitName(order.user?.name)
    const firstName = shipFirst ?? userFirst
    const lastName = shipFirst ? shipLast : userLast
    const phone = order.shippingAddress?.phone?.trim() || order.guestPhone?.trim() || null
    const channel = order.salesChannel.toLowerCase()

    const existing = byEmail.get(email)
    if (!existing) {
      byEmail.set(email, {
        email,
        firstName,
        lastName,
        phone,
        orderNumbers: [order.orderNumber],
        salesChannels: [channel],
      })
      continue
    }
    existing.orderNumbers.push(order.orderNumber)
    if (!existing.salesChannels.includes(channel)) existing.salesChannels.push(channel)
    if (!existing.firstName && firstName) {
      existing.firstName = firstName
      existing.lastName = lastName
    }
    if (!existing.phone && phone) existing.phone = phone
  }
  return Array.from(byEmail.values())
}

/** Every address with at least one open order, lower-cased. */
export async function loadOpenOrderEmails(): Promise<Set<string>> {
  const orders = await prisma.order.findMany({
    where: OPEN_ORDER_WHERE,
    select: { guestEmail: true, user: { select: { email: true, name: true } } },
  })
  const emails = new Set<string>()
  for (const order of orders) {
    const email = orderEmail(order)
    if (email) emails.add(email)
  }
  return emails
}

/**
 * Opted-out addresses stay on the list as non-subscribed rows so a campaign
 * skips them, the same way the customer-list builder treats them. Suppressions
 * and preferences are stored lower-cased (see `lib/email/suppression.ts`), so a
 * plain `in` over the normalized addresses finds them.
 */
async function loadOptOutStatuses(emails: string[]): Promise<Map<string, SubscriberStatus>> {
  const statuses = new Map<string, SubscriberStatus>()
  if (emails.length === 0) return statuses

  const [suppressions, preferences, customers] = await Promise.all([
    prisma.emailSuppression.findMany({
      where: { email: { in: emails } },
      select: { email: true, reason: true },
    }),
    prisma.unsubscribePreference.findMany({
      where: { email: { in: emails }, unsubscribeAll: true },
      select: { email: true },
    }),
    prisma.customer.findMany({
      where: { email: { in: emails }, emailStatus: { not: null } },
      select: { email: true, emailStatus: true },
    }),
  ])

  for (const c of customers) {
    const status = subscriberStatusFor(c.emailStatus)
    if (status !== 'SUBSCRIBED') statuses.set(c.email.toLowerCase(), status)
  }
  for (const p of preferences) statuses.set(p.email.toLowerCase(), 'UNSUBSCRIBED')
  for (const s of suppressions) {
    const status: SubscriberStatus =
      s.reason === 'HARD_BOUNCE' || s.reason === 'SOFT_BOUNCE'
        ? 'BOUNCED'
        : s.reason === 'SPAM_COMPLAINT'
          ? 'COMPLAINED'
          : 'UNSUBSCRIBED'
    statuses.set(s.email.toLowerCase(), status)
  }
  return statuses
}

export interface OpenOrdersRefreshResult {
  listId: string
  openOrders: number
  contacts: number
  subscribed: number
  optedOut: number
}

const INSERT_BATCH = 1000

/**
 * Purge the Open Orders list and rebuild it from the orders that are open now.
 * Creates the list on first use. The purge and the rebuild run in one
 * transaction, so a failure leaves the previous list intact.
 */
export async function refreshOpenOrdersList(
  createdById?: string | null,
): Promise<OpenOrdersRefreshResult> {
  const orders = await prisma.order.findMany({
    where: OPEN_ORDER_WHERE,
    orderBy: { createdAt: 'asc' },
    select: {
      orderNumber: true,
      salesChannel: true,
      guestEmail: true,
      guestPhone: true,
      user: { select: { email: true, name: true } },
      shippingAddress: { select: { firstName: true, lastName: true, phone: true } },
    },
  })

  const contacts = buildOpenOrderContacts(orders)
  const optOuts = await loadOptOutStatuses(contacts.map((c) => c.email))
  const now = new Date()

  const rows = contacts.map((c) => {
    const status = optOuts.get(c.email) ?? 'SUBSCRIBED'
    return {
      listId: OPEN_ORDERS_LIST_ID,
      email: c.email,
      firstName: c.firstName,
      lastName: c.lastName,
      phone: c.phone,
      status,
      unsubscribedAt: status === 'SUBSCRIBED' ? null : now,
      source: OPEN_ORDERS_SOURCE,
      tags: c.salesChannels,
      customFields: { orderNumbers: c.orderNumbers.join(', ') },
    }
  })

  await prisma.$transaction(
    async (tx) => {
      await tx.mailingList.upsert({
        where: { id: OPEN_ORDERS_LIST_ID },
        create: {
          id: OPEN_ORDERS_LIST_ID,
          name: OPEN_ORDERS_LIST_NAME,
          description:
            'Rebuilt from paid orders that have not shipped yet. Every refresh replaces all entries.',
          createdById: createdById ?? null,
        },
        update: {},
      })
      await tx.mailingListSubscriber.deleteMany({ where: { listId: OPEN_ORDERS_LIST_ID } })
      for (let i = 0; i < rows.length; i += INSERT_BATCH) {
        await tx.mailingListSubscriber.createMany({ data: rows.slice(i, i + INSERT_BATCH) })
      }
    },
    { timeout: 60_000 },
  )

  const subscribed = rows.filter((r) => r.status === 'SUBSCRIBED').length
  return {
    listId: OPEN_ORDERS_LIST_ID,
    openOrders: orders.length,
    contacts: rows.length,
    subscribed,
    optedOut: rows.length - subscribed,
  }
}
