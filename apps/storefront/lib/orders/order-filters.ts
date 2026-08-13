import type { Prisma } from '@prisma/client'
import { z } from 'zod'

import { PAID_PAYMENT_STATUSES } from '@/lib/payments/status'

import { SETTLED_FULFILLMENT_STATUSES } from './fulfillment'

/**
 * One definition of "which orders am I looking at", shared by the admin orders list, the
 * CSV export, and (later) the operational dashboard counts. Keeping it in one place is what
 * makes "filter the list, hit Export, get the same rows" true rather than aspirational — the
 * export route previously understood only `status` and a date range, so any filter added to
 * the page alone would have silently exported everything.
 */

/** Threshold above which an order counts as high value, per the admin spec. */
export const HIGH_VALUE_ORDER_THRESHOLD = 500

/** Shipping method the POS writes for in-store pickup. */
export const LOCAL_PICKUP_SHIPPING_METHOD = 'IN_STORE_PICKUP'

/** Business days are bucketed in Eastern time, matching the timeclock. */
export const BUSINESS_TIME_ZONE = 'America/New_York'

const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
] as const

const FULFILLMENT_STATUSES = [
  'UNFULFILLED',
  'PARTIALLY_FULFILLED',
  'FULFILLED',
  'DELIVERED',
  'RETURNED',
] as const

const SALES_CHANNELS = [
  'WEBSITE',
  'POS',
  'FUNDRAISER',
  'WHOLESALE',
  'EVENT',
  'MANUAL',
  'MARKETPLACE',
  'PHONE',
  'IMPORT',
] as const

const PAYMENT_STATUSES = [
  'PENDING',
  'PAID',
  'FAILED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'PROCESSING',
  'SUCCEEDED',
  'CANCELED',
] as const

/** `all` and empty string both mean "no constraint", so the UI can round-trip a cleared select. */
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.enum(values), z.literal('all'), z.literal('')])
    .optional()
    .transform((v) => (v === 'all' || v === '' ? undefined : v))

const optionalNumber = z
  .string()
  .optional()
  .transform((v) => {
    if (!v) return undefined
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  })

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/** Milliseconds a zone is offset from UTC at a given instant. */
function zoneOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
    .formatToParts(at)
    .reduce<Record<string, number>>((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = Number(part.value)
      return acc
    }, {})

  // formatToParts has second precision, so the milliseconds are carried over from the
  // original instant — otherwise the offset absorbs them and end-of-day lands a second late.
  const asUtc =
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute, parts.second) +
    at.getUTCMilliseconds()

  return asUtc - at.getTime()
}

/**
 * Resolve a `YYYY-MM-DD` picker value to an instant at the given local wall-clock time in
 * the business time zone. A date picker means the whole day: without this, "To: Feb 1"
 * resolves to Feb 1 00:00 UTC and silently excludes everything ordered that day.
 */
function resolveBusinessDay(value: string, endOfDay: boolean): Date | undefined {
  if (!DATE_ONLY.test(value)) {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
  }

  const [year, month, day] = value.split('-').map(Number)
  const naive = endOfDay
    ? Date.UTC(year, month - 1, day, 23, 59, 59, 999)
    : Date.UTC(year, month - 1, day, 0, 0, 0, 0)

  return new Date(naive - zoneOffsetMs(new Date(naive), BUSINESS_TIME_ZONE))
}

const optionalDate = (endOfDay: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v ? resolveBusinessDay(v, endOfDay) : undefined))

/**
 * Search params accepted by the orders list and export. Everything is optional and invalid
 * values degrade to "no constraint" rather than erroring — a filter bar should never 500 a
 * page because someone hand-edited the URL.
 */
export const OrderFilterSchema = z.object({
  search: z.string().trim().optional(),
  status: optionalEnum(ORDER_STATUSES),
  fulfillmentStatus: optionalEnum(FULFILLMENT_STATUSES),
  salesChannel: optionalEnum(SALES_CHANNELS),
  paymentStatus: optionalEnum(PAYMENT_STATUSES),
  shippingMethod: z.string().trim().optional(),
  startDate: optionalDate(false),
  endDate: optionalDate(true),
  minTotal: optionalNumber,
  maxTotal: optionalNumber,
  view: z.string().trim().optional(),
})

export type OrderFilterInput = z.input<typeof OrderFilterSchema>
export type OrderFilters = z.output<typeof OrderFilterSchema>

export function parseOrderFilters(params: Record<string, string | undefined>): OrderFilters {
  // .catch keeps a malformed URL from throwing; the caller gets an unfiltered view.
  return OrderFilterSchema.safeParse(params).data ?? OrderFilterSchema.parse({})
}

export interface SavedOrderView {
  key: string
  label: string
  description: string
  /** Applied on top of (and overriding) whatever the user has selected. */
  filters: Partial<OrderFilters>
  /** Extra clauses a view needs that the flat filter shape cannot express. */
  where?: Prisma.OrderWhereInput
  /**
   * Filter keys this view's `where` already constrains. They are dropped from the user's
   * selections before building, because a leftover param and the view's own clause would
   * otherwise AND into a contradiction and return nothing — e.g. clicking Payment Failed
   * and then Needs Shipping leaves `paymentStatus=FAILED` in the URL, which cannot be true
   * at the same time as the view's `paymentStatus IN (PAID, SUCCEEDED)`.
   */
  owns?: (keyof OrderFilters)[]
}

/**
 * The everyday questions staff actually ask, as one-click views.
 *
 * Note `Needs Shipping` matches paid orders via PAID_PAYMENT_STATUSES rather than the string
 * 'PAID'. Orders finalized before the payment-status reconciliation are stored as SUCCEEDED,
 * and this is the one view where a false negative means an order never gets shipped.
 */
export const SAVED_ORDER_VIEWS: SavedOrderView[] = [
  {
    key: 'needs-shipping',
    label: 'Needs Shipping',
    description: 'Paid orders that are not fully fulfilled yet',
    filters: {},
    owns: ['paymentStatus', 'fulfillmentStatus', 'status'],
    where: {
      paymentStatus: { in: PAID_PAYMENT_STATUSES },
      fulfillmentStatus: { notIn: SETTLED_FULFILLMENT_STATUSES },
      status: { notIn: ['CANCELLED', 'REFUNDED'] },
    },
  },
  {
    key: 'high-value',
    label: 'High Value',
    description: `Orders over $${HIGH_VALUE_ORDER_THRESHOLD}`,
    filters: { minTotal: HIGH_VALUE_ORDER_THRESHOLD },
  },
  {
    key: 'payment-failed',
    label: 'Payment Failed',
    description: 'Orders where payment did not go through',
    filters: { paymentStatus: 'FAILED' },
  },
  {
    key: 'fundraiser',
    label: 'Fundraiser Orders',
    description: 'Orders attributed to a fundraising campaign',
    filters: { salesChannel: 'FUNDRAISER' },
  },
  {
    key: 'local-pickup',
    label: 'Local Pickup',
    description: 'In-store pickup orders still awaiting handoff',
    filters: { shippingMethod: LOCAL_PICKUP_SHIPPING_METHOD },
    owns: ['fulfillmentStatus', 'shippingMethod'],
    where: { fulfillmentStatus: { notIn: SETTLED_FULFILLMENT_STATUSES } },
  },
]

export function getSavedView(key?: string): SavedOrderView | undefined {
  if (!key) return undefined
  return SAVED_ORDER_VIEWS.find((v) => v.key === key)
}

/**
 * Turn parsed filters into a Prisma where clause.
 *
 * A saved view's own filters win over the user's selections, so clicking `Needs Shipping`
 * always shows what it says regardless of what was selected before.
 */
export function buildOrderWhere(filters: OrderFilters): Prisma.OrderWhereInput {
  const view = getSavedView(filters.view)
  let f: OrderFilters = filters

  if (view) {
    f = { ...filters }
    // Drop the keys the view constrains itself, then let its own filters win.
    for (const key of view.owns ?? []) {
      delete (f as Record<string, unknown>)[key]
    }
    f = { ...f, ...view.filters }
  }

  const where: Prisma.OrderWhereInput = {}
  const and: Prisma.OrderWhereInput[] = []

  if (f.search) {
    // Tracking number is included so staff can paste one straight from a carrier email.
    where.OR = [
      { orderNumber: { contains: f.search, mode: 'insensitive' } },
      { guestEmail: { contains: f.search, mode: 'insensitive' } },
      { trackingNumber: { contains: f.search, mode: 'insensitive' } },
      {
        user: {
          OR: [
            { email: { contains: f.search, mode: 'insensitive' } },
            { name: { contains: f.search, mode: 'insensitive' } },
          ],
        },
      },
    ]
  }

  if (f.status) where.status = f.status
  if (f.fulfillmentStatus) where.fulfillmentStatus = f.fulfillmentStatus
  if (f.salesChannel) where.salesChannel = f.salesChannel
  if (f.paymentStatus) where.paymentStatus = f.paymentStatus
  if (f.shippingMethod) where.shippingMethod = f.shippingMethod

  if (f.startDate || f.endDate) {
    where.createdAt = {
      ...(f.startDate ? { gte: f.startDate } : {}),
      ...(f.endDate ? { lte: f.endDate } : {}),
    }
  }

  if (f.minTotal !== undefined || f.maxTotal !== undefined) {
    where.total = {
      ...(f.minTotal !== undefined ? { gte: f.minTotal } : {}),
      ...(f.maxTotal !== undefined ? { lte: f.maxTotal } : {}),
    }
  }

  if (view?.where) and.push(view.where)
  if (and.length > 0) where.AND = and

  return where
}

/** Whether any constraint is active, so the UI can offer a "clear filters" affordance. */
export function hasActiveOrderFilters(filters: OrderFilters): boolean {
  return Object.entries(filters).some(([, value]) => value !== undefined && value !== '')
}
