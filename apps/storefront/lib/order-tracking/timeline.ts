/**
 * The customer-facing history of one order, newest first.
 *
 * Everything here is shown to the customer, so each source is filtered to what they may see:
 * staff notes come only from `OrderCustomerUpdate` (never `Order.adminNotes`), status changes
 * carry only the new status, and emails show just a subject and an opening line.
 */

export type CustomerTimelineKind =
  | 'received'
  | 'payment'
  | 'status'
  | 'note'
  | 'delay'
  | 'email_in'
  | 'email_out'
  | 'shipped'
  | 'carrier'
  | 'delivered'

export interface CustomerTimelineEntry {
  kind: CustomerTimelineKind
  at: Date
  title: string
  detail?: string | null
  location?: string | null
}

export interface CarrierEvent {
  status?: string | null
  message?: string | null
  datetime?: string | null
  tracking_location?: {
    city?: string | null
    state?: string | null
    country?: string | null
    zip?: string | null
  } | null
}

export interface CustomerTimelineInput {
  order: {
    createdAt: Date
    shippedAt?: Date | null
    deliveredAt?: Date | null
    carrierName?: string | null
    trackingNumber?: string | null
  }
  payments?: Array<{ paidAt?: Date | null }>
  statusChanges?: Array<{ at: Date; status: string }>
  updates?: Array<{ at: Date; kind: 'NOTE' | 'DELAY'; message: string }>
  inboundEmails?: Array<{ at: Date; subject: string; body?: string | null; snippet?: string | null }>
  outboundEmails?: Array<{ at: Date; subject: string }>
  carrierEvents?: CarrierEvent[]
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? titleCase(status)
}

function titleCase(value: string): string {
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

const PREVIEW_LENGTH = 140

/**
 * The first line a person actually wrote: skips blank lines, quoted reply text and
 * "On … wrote:" headers, and trims to a short preview.
 */
export function firstLineOf(text: string | null | undefined): string | null {
  if (!text) return null
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('>') || /^On .+wrote:$/i.test(line)) continue
    return line.length > PREVIEW_LENGTH ? `${line.slice(0, PREVIEW_LENGTH - 1).trimEnd()}…` : line
  }
  return null
}

/** "Zanesville, OH" from a carrier scan, or null when the scan has no place. */
export function carrierLocation(event: CarrierEvent): string | null {
  const loc = event.tracking_location
  if (!loc) return null
  // Carriers send cities in capitals ("COLUMBUS"); states are two-letter codes.
  const parts = [loc.city ? titleCase(loc.city) : null, loc.state ? loc.state.toUpperCase() : null]
    .filter(Boolean) as string[]
  if (parts.length === 0 && loc.country) parts.push(loc.country)
  return parts.length > 0 ? parts.join(', ') : null
}

/** The newest carrier scan that names a place — what the map centres on. */
export function latestCarrierLocation(events: CarrierEvent[] | null | undefined): string | null {
  if (!events?.length) return null
  const sorted = [...events].sort((a, b) => timeOf(b) - timeOf(a))
  for (const event of sorted) {
    const location = carrierLocation(event)
    if (location) return location
  }
  return null
}

function timeOf(event: CarrierEvent): number {
  const t = event.datetime ? new Date(event.datetime).getTime() : NaN
  return Number.isNaN(t) ? 0 : t
}

export function buildCustomerTimeline(input: CustomerTimelineInput): CustomerTimelineEntry[] {
  const { order } = input
  const entries: CustomerTimelineEntry[] = [
    { kind: 'received', at: order.createdAt, title: 'Order received' },
  ]

  for (const payment of input.payments ?? []) {
    if (payment.paidAt) entries.push({ kind: 'payment', at: payment.paidAt, title: 'Payment received' })
  }

  for (const change of input.statusChanges ?? []) {
    entries.push({ kind: 'status', at: change.at, title: `Status: ${statusLabel(change.status)}` })
  }

  for (const update of input.updates ?? []) {
    entries.push({
      kind: update.kind === 'DELAY' ? 'delay' : 'note',
      at: update.at,
      title: update.kind === 'DELAY' ? 'Delay' : 'Update from Jose Madrid Salsa',
      detail: update.message,
    })
  }

  for (const email of input.inboundEmails ?? []) {
    entries.push({
      kind: 'email_in',
      at: email.at,
      title: `Email received: ${email.subject || '(no subject)'}`,
      detail: firstLineOf(email.body) ?? firstLineOf(email.snippet),
    })
  }

  for (const email of input.outboundEmails ?? []) {
    entries.push({ kind: 'email_out', at: email.at, title: `Email sent to you: ${email.subject}` })
  }

  const carrierEvents = (input.carrierEvents ?? []).filter((e) => timeOf(e) > 0)
  for (const event of carrierEvents) {
    entries.push({
      kind: event.status === 'delivered' ? 'delivered' : 'carrier',
      at: new Date(event.datetime as string),
      title: event.message || (event.status ? titleCase(event.status) : 'Carrier update'),
      location: carrierLocation(event),
    })
  }

  // The carrier's own scans already say "delivered" and "accepted"; only fall back to the
  // order's timestamps when there are no scans to say it.
  const hasCarrierDelivered = carrierEvents.some((e) => e.status === 'delivered')
  if (order.shippedAt) {
    entries.push({
      kind: 'shipped',
      at: order.shippedAt,
      title: 'Shipped',
      detail: [order.carrierName, order.trackingNumber].filter(Boolean).join(' · ') || null,
    })
  }
  if (order.deliveredAt && !hasCarrierDelivered) {
    entries.push({ kind: 'delivered', at: order.deliveredAt, title: 'Delivered' })
  }

  return entries.sort((a, b) => b.at.getTime() - a.at.getTime())
}
