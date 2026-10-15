import prisma from '@/lib/prisma'
import { getEasyPostClient } from '@/lib/shipping-api'
import {
  buildCustomerTimeline,
  latestCarrierLocation,
  type CarrierEvent,
  type CustomerTimelineEntry,
} from '@/lib/order-tracking/timeline'

/** Find an order by number for the phone-verified lookup, with every phone recorded on it. */
export async function findOrderForLookup(orderNumber: string) {
  return prisma.order.findFirst({
    where: { orderNumber: { equals: orderNumber, mode: 'insensitive' } },
    select: {
      id: true,
      orderNumber: true,
      guestPhone: true,
      user: { select: { phone: true } },
      shippingAddress: { select: { phone: true } },
      billingAddress: { select: { phone: true } },
    },
  })
}

/** Find the order a carrier tracking number belongs to. */
export async function findOrderByTrackingNumber(trackingNumber: string) {
  return prisma.order.findFirst({
    where: {
      OR: [
        { trackingNumber: { equals: trackingNumber, mode: 'insensitive' } },
        { shippingLabels: { some: { trackingCode: { equals: trackingNumber, mode: 'insensitive' } } } },
      ],
    },
    select: { id: true },
  })
}

export interface OrderTrackingView {
  orderNumber: string
  status: string
  placedAt: Date
  carrierName: string | null
  trackingNumber: string | null
  trackingUrl: string | null
  estimatedDelivery: Date | null
  deliveredAt: Date | null
  lastTrackingUpdate: Date | null
  currentLocation: string | null
  items: Array<{ name: string; quantity: number }>
  shipTo: string | null
  timeline: CustomerTimelineEntry[]
  smsSubscribed: boolean
}

/**
 * Everything the verified tracking page shows. Only call after the caller has proved
 * ownership (order number + phone, or the order access token).
 */
export async function loadOrderTrackingView(orderId: string): Promise<OrderTrackingView | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      createdAt: true,
      guestEmail: true,
      carrierName: true,
      trackingNumber: true,
      trackingUrl: true,
      estimatedDelivery: true,
      shippedAt: true,
      deliveredAt: true,
      lastTrackingUpdate: true,
      trackingHistory: true,
      user: { select: { email: true } },
      shippingAddress: { select: { city: true, state: true } },
      items: { select: { quantity: true, productName: true } },
      payments: { select: { paidAt: true } },
      customerUpdates: { select: { createdAt: true, kind: true, message: true } },
      smsSubscriptions: { where: { unsubscribedAt: null }, select: { id: true }, take: 1 },
    },
  })
  if (!order) return null

  const carrierEvents = await ensureCarrierEvents(order)
  const email = (order.user?.email ?? order.guestEmail)?.toLowerCase() ?? null

  const [statusLogs, inboundEmails, outboundEmails] = await Promise.all([
    prisma.auditLog.findMany({
      where: { entityType: 'order', entityId: order.id, action: 'update' },
      select: { createdAt: true, changes: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.inboundEmail.findMany({
      where: {
        OR: [
          { orderId: order.id },
          ...(email
            ? [
                // Unlinked mail from the buyer since the order was placed. Mail the sweep
                // linked to one of their other orders belongs on that order's page.
                {
                  orderId: null,
                  fromEmail: { equals: email, mode: 'insensitive' as const },
                  receivedAt: { gte: order.createdAt },
                },
              ]
            : []),
        ],
      },
      select: { receivedAt: true, subject: true, body: true, snippet: true },
      orderBy: { receivedAt: 'desc' },
      take: 50,
    }),
    email
      ? prisma.emailLog.findMany({
          where: {
            recipientEmail: { equals: email, mode: 'insensitive' },
            subject: { contains: order.orderNumber, mode: 'insensitive' },
            createdAt: { gte: order.createdAt },
            status: { notIn: ['FAILED', 'BOUNCED'] },
          },
          select: { createdAt: true, sentAt: true, subject: true },
          take: 50,
        })
      : Promise.resolve([]),
  ])

  const timeline = buildCustomerTimeline({
    order,
    payments: order.payments,
    statusChanges: statusLogs.flatMap((log) => {
      const status = statusFromChanges(log.changes)
      return status ? [{ at: log.createdAt, status }] : []
    }),
    updates: order.customerUpdates.map((u) => ({ at: u.createdAt, kind: u.kind, message: u.message })),
    inboundEmails: inboundEmails.map((e) => ({
      at: e.receivedAt,
      subject: e.subject,
      body: e.body,
      snippet: e.snippet,
    })),
    outboundEmails: outboundEmails.map((e) => ({ at: e.sentAt ?? e.createdAt, subject: e.subject })),
    carrierEvents,
  })

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    placedAt: order.createdAt,
    carrierName: order.carrierName,
    trackingNumber: order.trackingNumber,
    trackingUrl: order.trackingUrl,
    estimatedDelivery: order.estimatedDelivery,
    deliveredAt: order.deliveredAt,
    lastTrackingUpdate: order.lastTrackingUpdate,
    currentLocation: latestCarrierLocation(carrierEvents),
    items: order.items.map((i) => ({
      name: i.productName,
      quantity: i.quantity,
    })),
    shipTo: [order.shippingAddress?.city, order.shippingAddress?.state].filter(Boolean).join(', ') || null,
    timeline,
    smsSubscribed: order.smsSubscriptions.length > 0,
  }
}

/** The new status from an audit-log `changes` blob written by the admin status route. */
export function statusFromChanges(changes: unknown): string | null {
  if (!changes || typeof changes !== 'object') return null
  const status = (changes as { status?: { to?: unknown } }).status
  return typeof status?.to === 'string' ? status.to : null
}

/**
 * Carrier scans for the order, registering an EasyPost tracker the first time a tracking
 * number is seen without any history.
 *
 * Labels bought through EasyPost get a tracker automatically; numbers pasted in by hand
 * (Pirate Ship, a counter) never had one, so their page would show no scans and the
 * webhook would never fire. Creating the tracker here fetches the current scans and
 * subscribes the number to `tracker.updated` webhooks from then on.
 */
export async function ensureCarrierEvents(order: {
  id: string
  trackingNumber: string | null
  carrierName: string | null
  trackingHistory: unknown
  lastTrackingUpdate: Date | null
}): Promise<CarrierEvent[]> {
  const existing = Array.isArray(order.trackingHistory) ? (order.trackingHistory as CarrierEvent[]) : []
  // Same switch `getEasyPostClient` reads; skip quietly when EasyPost isn't the provider.
  const easyPostConfigured =
    Boolean(process.env.SHIPPING_API_KEY) && (process.env.SHIPPING_PROVIDER ?? 'easypost') === 'easypost'
  // A tracker that exists but has no scans yet still sets lastTrackingUpdate; don't register it
  // again on every view — the webhook delivers its scans.
  if (existing.length > 0 || order.lastTrackingUpdate || !order.trackingNumber || !easyPostConfigured) {
    return existing
  }

  try {
    // The EasyPost SDK's published types don't include the Tracker service.
    const client = getEasyPostClient() as unknown as {
      Tracker: {
        create: (params: { tracking_code: string; carrier?: string }) => Promise<{
          tracking_details?: CarrierEvent[]
          est_delivery_date?: string | null
        }>
      }
    }
    const tracker = await client.Tracker.create({
      tracking_code: order.trackingNumber,
      carrier: order.carrierName ?? undefined,
    })
    const events = tracker.tracking_details ?? []
    await prisma.order.update({
      where: { id: order.id },
      data: {
        trackingHistory: events as object,
        lastTrackingUpdate: new Date(),
        ...(tracker.est_delivery_date ? { estimatedDelivery: new Date(tracker.est_delivery_date) } : {}),
      },
    })
    return events
  } catch (error) {
    console.error('Could not register EasyPost tracker for order', order.id, error)
    return existing
  }
}
