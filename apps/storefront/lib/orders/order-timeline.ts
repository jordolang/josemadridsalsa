import type { DomainEventType } from '@/lib/domain-events/types'

/**
 * An order's activity timeline.
 *
 * `domain_events` only started collecting facts when the event log shipped, so a timeline
 * built purely from it renders empty for every order placed before then. The order row and
 * its payments/refunds still carry the timestamps of what happened, so this module merges
 * the two: recorded events where they exist, and entries reconstructed from those legacy
 * timestamps where they do not.
 *
 * The merge rule is per fact type: a legacy timestamp is only synthesized when no recorded
 * event of the corresponding type exists for that order. An order straddling the cutover
 * therefore shows each fact exactly once, and reconstructed entries are flagged so nobody
 * mistakes an inference for something that was actually observed.
 */

export type TimelineSource = 'recorded' | 'reconstructed'

export interface TimelineEntry {
  type: DomainEventType | LegacyTimelineType
  label: string
  at: Date
  source: TimelineSource
  detail?: string | null
  actorUserId?: string | null
}

/** Facts that only ever existed as a column, never as an emitted event. */
export type LegacyTimelineType =
  | 'order.placed'
  | 'order.confirmation_emailed'
  | 'order.invoice_sent'
  | 'order.invoice_printed'
  | 'order.packing_slip_printed'

export interface TimelineOrder {
  id: string
  createdAt: Date
  shippedAt?: Date | null
  deliveredAt?: Date | null
  confirmationEmailSentAt?: Date | null
  invoiceSentAt?: Date | null
  printedInvoiceAt?: Date | null
  printedPackingSlipAt?: Date | null
}

export interface TimelinePayment {
  paidAt?: Date | null
  amount: number
  provider?: string | null
}

export interface TimelineRefund {
  processedAt?: Date | null
  createdAt: Date
  amount: number
  provider?: string | null
}

export interface TimelineDomainEvent {
  type: string
  createdAt: Date
  payload?: unknown
  actorUserId?: string | null
}

const EVENT_LABELS: Record<string, string> = {
  'order.created': 'Order created',
  'order.cancelled': 'Order cancelled',
  'order.fulfilled': 'Order fulfilled',
  'order.partially_fulfilled': 'Partially fulfilled',
  'order.shipped': 'Shipped',
  'order.delivered': 'Delivered',
  'order.returned': 'Returned',
  'payment.completed': 'Payment completed',
  'payment.failed': 'Payment failed',
  'payment.refunded': 'Payment refunded',
  'refund.completed': 'Refund completed',
  'shipment.created': 'Shipping label purchased',
  'order.placed': 'Order placed',
  'order.confirmation_emailed': 'Confirmation email sent',
  'order.invoice_sent': 'Invoice sent',
  'order.invoice_printed': 'Invoice printed',
  'order.packing_slip_printed': 'Packing slip printed',
  'inventory.low': 'Inventory low',
  'inventory.out_of_stock': 'Out of stock',
  'inventory.adjusted': 'Inventory adjusted',
  'customer.created': 'Customer created',
}

export function timelineLabel(type: string): string {
  return EVENT_LABELS[type] ?? type
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`

export interface BuildOrderTimelineInput {
  order: TimelineOrder
  payments?: TimelinePayment[]
  refunds?: TimelineRefund[]
  events?: TimelineDomainEvent[]
}

/**
 * Merge recorded events and legacy timestamps into one chronological list, oldest first.
 */
export function buildOrderTimeline({
  order,
  payments = [],
  refunds = [],
  events = [],
}: BuildOrderTimelineInput): TimelineEntry[] {
  const entries: TimelineEntry[] = []
  const recordedTypes = new Set(events.map((e) => e.type))

  for (const event of events) {
    entries.push({
      type: event.type as DomainEventType,
      label: timelineLabel(event.type),
      at: event.createdAt,
      source: 'recorded',
      detail: describePayload(event.payload),
      actorUserId: event.actorUserId ?? null,
    })
  }

  /** Add a reconstructed entry unless the same fact was actually recorded. */
  const reconstruct = (
    type: DomainEventType | LegacyTimelineType,
    at: Date | null | undefined,
    detail?: string | null
  ) => {
    if (!at || recordedTypes.has(type)) return
    entries.push({ type, label: timelineLabel(type), at, source: 'reconstructed', detail })
  }

  // `order.created` is never emitted today, so the creation entry is always reconstructed
  // from createdAt — which every order has, guaranteeing a non-empty timeline.
  reconstruct('order.placed', order.createdAt)

  for (const payment of payments) {
    reconstruct(
      'payment.completed',
      payment.paidAt,
      `${money(payment.amount)}${payment.provider ? ` via ${payment.provider}` : ''}`
    )
  }

  for (const refund of refunds) {
    reconstruct(
      'payment.refunded',
      refund.processedAt ?? refund.createdAt,
      `${money(refund.amount)}${refund.provider ? ` via ${refund.provider}` : ''}`
    )
  }

  reconstruct('order.fulfilled', order.shippedAt)
  reconstruct('order.delivered', order.deliveredAt)
  reconstruct('order.confirmation_emailed', order.confirmationEmailSentAt)
  reconstruct('order.invoice_sent', order.invoiceSentAt)
  reconstruct('order.invoice_printed', order.printedInvoiceAt)
  reconstruct('order.packing_slip_printed', order.printedPackingSlipAt)

  return entries.sort((a, b) => a.at.getTime() - b.at.getTime())
}

/** Render a small event payload as a one-line detail string; ignore anything unreadable. */
function describePayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as Record<string, unknown>

  const parts: string[] = []
  if (typeof p.trackingNumber === 'string') parts.push(p.trackingNumber)
  if (typeof p.carrier === 'string') parts.push(p.carrier)
  if (typeof p.amount === 'number') parts.push(money(p.amount))
  if (typeof p.provider === 'string') parts.push(p.provider)

  return parts.length > 0 ? parts.join(' · ') : null
}
