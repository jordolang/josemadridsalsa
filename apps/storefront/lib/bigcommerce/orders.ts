import type { OrderStatus, PaymentStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { allocateCents } from '@/lib/bundles'
import { deriveFulfillmentStatus } from '@/lib/orders/fulfillment'
import { calculateFundraiserCommission } from '@/lib/fundraising/commission'
import { bigCommerceFetch } from './client'
import type { BigCommerceStoreKey } from './config'
import {
  findProductForJarLabel,
  getBigCommerceProducts,
  normalizeProductName,
  type BigCommerceProduct,
} from './catalog'
import {
  countsTowardCampaign,
  ensureBigCommerceFundraiser,
  extractFundraisingAttribution,
  recomputeFundraiserTotals,
  type BigCommerceFundraiserRef,
} from './fundraising-orders'

/**
 * Mirrors BigCommerce orders into this site's order table.
 *
 * Once retail checks out in BigCommerce, its orders never touch this database
 * — but sales dashboards, margin reports, "verified buyer" reviews and the
 * QuickBooks sync all read it. Each BigCommerce order is copied here as a
 * read-only record (`importSource = 'bigcommerce'`), kept current by the order
 * webhook and a periodic sweep. BigCommerce stays the place orders are worked:
 * nothing here emails the customer, touches stock or takes payment.
 *
 * Both stores are mirrored. Retail orders from the main store become `BC-<id>`;
 * orders from the fundraising store become `BCF-<id>`
 * (`importSource = 'bigcommerce-fundraising'`) and are credited to the
 * fundraiser for the group the buyer chose at checkout — see
 * `./fundraising-orders.ts`.
 */

export const BIGCOMMERCE_ORDER_SOURCE = 'bigcommerce'
export const BIGCOMMERCE_FUNDRAISING_ORDER_SOURCE = 'bigcommerce-fundraising'

const ORDER_SOURCE: Record<BigCommerceStoreKey, string> = {
  main: BIGCOMMERCE_ORDER_SOURCE,
  fundraising: BIGCOMMERCE_FUNDRAISING_ORDER_SOURCE,
}

/** Every import source a BigCommerce copy carries; for `where: { importSource: { in } }`. */
export const BIGCOMMERCE_ORDER_SOURCES = [BIGCOMMERCE_ORDER_SOURCE, BIGCOMMERCE_FUNDRAISING_ORDER_SOURCE]

/** True for a read-only copy of an order from either BigCommerce store. */
export function isBigCommerceOrderSource(importSource: string | null | undefined): boolean {
  return importSource === BIGCOMMERCE_ORDER_SOURCE || importSource === BIGCOMMERCE_FUNDRAISING_ORDER_SOURCE
}

/** The mirror's order number; also what makes mirroring idempotent. */
export function bigCommerceOrderNumber(bigCommerceOrderId: number, store: BigCommerceStoreKey = 'main'): string {
  return `${store === 'fundraising' ? 'BCF' : 'BC'}-${bigCommerceOrderId}`
}

// ---- Raw v2 shapes (only the fields read here) ----

type RawAddress = {
  first_name: string
  last_name: string
  company: string
  street_1: string
  street_2: string
  city: string
  state: string
  zip: string
  country_iso2: string
  phone: string
  email: string
  /** Answers to the store's custom checkout questions (the fundraising store's group and salesperson). */
  form_fields?: Array<{ name: string; value: unknown }>
}

export type RawBigCommerceOrder = {
  id: number
  status_id: number
  date_created: string
  date_shipped: string
  subtotal_ex_tax: string
  shipping_cost_ex_tax: string
  total_tax: string
  discount_amount: string
  coupon_discount: string
  gift_certificate_amount: string
  total_inc_tax: string
  payment_method: string
  customer_message: string
  billing_address: RawAddress
}

export type RawBigCommerceOrderProduct = {
  product_id: number
  name: string
  sku: string
  quantity: number
  quantity_shipped: number
  total_ex_tax: string
  product_options: Array<{ display_name: string; display_value: string }>
}

type RawShippingAddress = RawAddress & { shipping_method: string }
type RawShipment = { tracking_number: string; tracking_carrier: string; tracking_link: string }

// ---- Status ----

/** Shipped (2) and Completed (10): every item has gone out, whatever the per-item counts say. */
const FULLY_SHIPPED_STATUS_IDS = new Set([2, 10])

type MirroredStatus = { status: OrderStatus; paymentStatus: PaymentStatus }

/**
 * This site's status for a BigCommerce status id, or null for orders that are
 * not sales yet (incomplete, pending, awaiting payment).
 */
export function mapBigCommerceStatus(statusId: number, itemsShipped = 0): MirroredStatus | null {
  switch (statusId) {
    case 0: // Incomplete
    case 1: // Pending
    case 7: // Awaiting Payment
      return null
    case 8: // Awaiting Pickup
    case 9: // Awaiting Shipment
    case 11: // Awaiting Fulfillment
    case 12: // Manual Verification Required
    case 13: // Disputed
      return { status: 'PROCESSING', paymentStatus: 'PAID' }
    case 2: // Shipped
    case 3: // Partially Shipped
      return { status: 'SHIPPED', paymentStatus: 'PAID' }
    case 10: // Completed
      return { status: 'DELIVERED', paymentStatus: 'PAID' }
    case 5: // Cancelled
      return { status: 'CANCELLED', paymentStatus: 'CANCELED' }
    case 6: // Declined
      return { status: 'CANCELLED', paymentStatus: 'FAILED' }
    case 4: // Refunded
      return { status: 'REFUNDED', paymentStatus: 'REFUNDED' }
    case 14: // Partially Refunded
      return { status: itemsShipped > 0 ? 'SHIPPED' : 'PROCESSING', paymentStatus: 'PARTIALLY_REFUNDED' }
    default:
      return null
  }
}

// ---- Items ----

export type SiteProductRef = {
  id: string
  slug: string
  name: string
  sku: string
  featuredImage: string | null
  costPrice: number | null
}

export type MirrorItem = {
  productId: string
  quantity: number
  quantityFulfilled: number
  unitPrice: number
  totalPrice: number
  unitCost: number | null
  productName: string
  productSku: string
  productImage: string | null
}

const toCents = (value: string | number) => Math.round(Number(value) * 100)
const fromCents = (cents: number) => cents / 100

function resolveSiteProduct(
  bc: BigCommerceProduct | null,
  fallbackName: string,
  siteProducts: SiteProductRef[],
): SiteProductRef | null {
  if (bc?.siteSlug) {
    const bySlug = siteProducts.find((product) => product.slug === bc.siteSlug)
    if (bySlug) return bySlug
  }
  const wanted = normalizeProductName(bc?.name ?? fallbackName)
  return siteProducts.find((product) => normalizeProductName(product.name) === wanted) ?? null
}

function itemFor(site: SiteProductRef, quantity: number, quantityFulfilled: number, totalCents: number): MirrorItem {
  return {
    productId: site.id,
    quantity,
    quantityFulfilled: Math.min(quantityFulfilled, quantity),
    unitPrice: fromCents(Math.round(totalCents / quantity)),
    totalPrice: fromCents(totalCents),
    unitCost: site.costPrice,
    productName: site.name,
    productSku: site.sku,
    productImage: site.featuredImage,
  }
}

/**
 * Order lines as this site records them. A loose jar maps to its product; a
 * mix-and-match pack becomes one line per chosen jar with the pack's price
 * split across them to the cent, exactly as this site records its own packs,
 * so product and margin reports treat both the same. Lines that match no site
 * product are reported rather than guessed.
 */
export function buildMirrorItems(
  lines: RawBigCommerceOrderProduct[],
  catalog: BigCommerceProduct[],
  siteProducts: SiteProductRef[],
): { items: MirrorItem[]; unmatched: string[] } {
  const items: MirrorItem[] = []
  const unmatched: string[] = []

  for (const line of lines) {
    const bc = catalog.find((product) => product.id === line.product_id) ?? null
    const jarLabels = line.product_options
      .filter((option) => /^jar\s*\d+$/i.test(option.display_name.trim()))
      .map((option) => option.display_value)

    if (jarLabels.length === 0) {
      const site = resolveSiteProduct(bc, line.name, siteProducts)
      if (!site) {
        unmatched.push(`${line.quantity} × ${line.name}`)
        continue
      }
      items.push(itemFor(site, line.quantity, line.quantity_shipped, toCents(line.total_ex_tax)))
      continue
    }

    // A pack: every chosen jar, once per pack ordered.
    const jars = jarLabels.map((label) => {
      const jarProduct = findProductForJarLabel(catalog, label)
      return { label, site: resolveSiteProduct(jarProduct, label, siteProducts) }
    })
    const missing = jars.filter((jar) => !jar.site)
    if (missing.length > 0) {
      unmatched.push(`${line.quantity} × ${line.name} (${missing.map((jar) => jar.label).join(', ')})`)
      continue
    }

    const shares = allocateCents(toCents(line.total_ex_tax), jars.map(() => 1))
    jars.forEach((jar, index) => {
      items.push(itemFor(jar.site!, line.quantity, line.quantity_shipped, shares[index]))
    })
  }

  return { items, unmatched }
}

// ---- Mirroring ----

function toAddress(raw: RawAddress, userId: string | null): Prisma.AddressCreateInput {
  return {
    firstName: raw.first_name || '—',
    lastName: raw.last_name || '—',
    company: raw.company || null,
    street: [raw.street_1, raw.street_2].filter(Boolean).join(', ') || '—',
    city: raw.city || '—',
    state: raw.state || '—',
    zipCode: raw.zip || '—',
    country: raw.country_iso2 || 'US',
    phone: raw.phone || null,
    ...(userId ? { user: { connect: { id: userId } } } : {}),
  }
}

async function loadSiteProducts(): Promise<SiteProductRef[]> {
  const rows = await prisma.product.findMany({
    select: { id: true, slug: true, name: true, sku: true, featuredImage: true, costPrice: true },
  })
  return rows.map((row) => ({ ...row, costPrice: row.costPrice === null ? null : Number(row.costPrice) }))
}

export type MirrorResult = {
  action: 'created' | 'updated' | 'skipped'
  orderId?: string
  unmatched?: string[]
  /** Fundraising store only: the fundraiser credited, and whether this order created it. */
  fundraiserId?: string | null
  fundraiserCreated?: boolean
}

export type MirrorContext = {
  store?: BigCommerceStoreKey
  catalog?: BigCommerceProduct[]
  siteProducts?: SiteProductRef[]
  /**
   * When given, fundraisers whose totals need recomputing are collected here instead of
   * recomputed per order, so a backfill of thousands of orders recomputes each campaign once.
   */
  staleFundraisers?: Set<string>
}

const STORE_LABEL: Record<BigCommerceStoreKey, string> = {
  main: 'BigCommerce',
  fundraising: 'BigCommerce fundraising store',
}

/**
 * Copies one BigCommerce order into this site's order table, or brings an
 * existing copy up to date. Safe to call any number of times for the same
 * order. Orders that are not sales yet are skipped until they are.
 */
export async function mirrorBigCommerceOrder(
  bigCommerceOrderId: number,
  context?: MirrorContext,
): Promise<MirrorResult> {
  const store = context?.store ?? 'main'
  const fundraising = store === 'fundraising'
  const order = await bigCommerceFetch<RawBigCommerceOrder>(store, `v2/orders/${bigCommerceOrderId}`)
  const orderNumber = bigCommerceOrderNumber(order.id, store)
  const existing = await prisma.order.findUnique({
    where: { orderNumber },
    select: { id: true, fundraiserId: true, _count: { select: { fulfillments: true, returnRequests: true } } },
  })

  const lines = await bigCommerceFetch<RawBigCommerceOrderProduct[]>(store, `v2/orders/${order.id}/products`)
  const itemsShipped = (lines ?? []).reduce((sum, line) => sum + line.quantity_shipped, 0)
  const mapped = mapBigCommerceStatus(order.status_id, itemsShipped)
  if (!mapped && !existing) return { action: 'skipped' }

  const catalog = context?.catalog ?? (await getBigCommerceProducts(store))
  const siteProducts = context?.siteProducts ?? (await loadSiteProducts())
  const built = buildMirrorItems(lines ?? [], catalog, siteProducts)
  const unmatched = built.unmatched
  // Staff mark orders Shipped (or Completed) by changing the status, usually without recording
  // a shipment per item, so BigCommerce's shipped quantities stay at zero. Those statuses mean
  // the whole order went out; only Partially Shipped needs the per-item counts.
  const items = FULLY_SHIPPED_STATUS_IDS.has(order.status_id)
    ? built.items.map((item) => ({ ...item, quantityFulfilled: item.quantity }))
    : built.items

  const shipments =
    itemsShipped > 0
      ? ((await bigCommerceFetch<RawShipment[] | null>(store, `v2/orders/${order.id}/shipments`)) ?? [])
      : []
  const tracking = shipments.find((shipment) => shipment.tracking_number)
  const shipped = order.date_shipped ? new Date(order.date_shipped) : null
  const orderDate = new Date(order.date_created)

  // A new copy needs the shipping address; a fundraising order also needs it for attribution,
  // since the checkout answers have been stored on either address over the years.
  const shipping =
    !existing || fundraising
      ? (await bigCommerceFetch<RawShippingAddress[] | null>(store, `v2/orders/${order.id}/shipping_addresses`))?.[0]
      : undefined

  // Fundraising-store orders are credited to the group the buyer chose. The commission is
  // recorded and the order marked credited here, so the native credit can never add it again.
  let fundraiser: BigCommerceFundraiserRef | null = null
  let attributionFields: Pick<Prisma.OrderCreateInput, 'sellerName' | 'fundraiserCommission' | 'commissionCreditedAt'> | null = null
  if (fundraising) {
    const attribution = extractFundraisingAttribution(order.billing_address, shipping ? [shipping] : [])
    fundraiser = attribution.group ? await ensureBigCommerceFundraiser(attribution.group, orderDate) : null
    const counts = mapped !== null && countsTowardCampaign(mapped.status, mapped.paymentStatus)
    attributionFields = {
      sellerName: attribution.seller,
      fundraiserCommission:
        fundraiser && counts
          ? calculateFundraiserCommission(
              {
                subtotal: Number(order.subtotal_ex_tax),
                discountAmount: fromCents(toCents(order.discount_amount) + toCents(order.coupon_discount)),
              },
              fundraiser.commissionRate,
            )
          : null,
      commissionCreditedAt: fundraiser ? orderDate : null,
    }
  }

  const header = {
    // A BigCommerce status we do not map (a custom one) leaves the copy as it was.
    ...(mapped ?? {}),
    fulfillmentStatus: deriveFulfillmentStatus(items),
    subtotal: order.subtotal_ex_tax,
    shippingCost: order.shipping_cost_ex_tax,
    tax: order.total_tax,
    discountAmount: fromCents(toCents(order.discount_amount) + toCents(order.coupon_discount)),
    giftCertificateAmount: order.gift_certificate_amount,
    total: order.total_inc_tax,
    paymentMethod: order.payment_method || null,
    customerNotes: order.customer_message || null,
    shippedAt: shipped,
    trackingNumber: tracking?.tracking_number || null,
    carrierName: tracking?.tracking_carrier || null,
    trackingUrl: tracking?.tracking_link || null,
    adminNotes: [
      `${STORE_LABEL[store]} order #${order.id}. Managed in BigCommerce; this is a read-only copy.`,
      ...(unmatched.length ? [`Not copied (no matching product on this site): ${unmatched.join('; ')}`] : []),
    ].join('\n'),
  } satisfies Prisma.OrderUpdateInput

  const refreshTotals = async (orderId: string) => {
    const stale = new Set([existing?.fundraiserId, fundraiser?.id].filter((id): id is string => Boolean(id)))
    for (const id of stale) {
      if (context?.staleFundraisers) context.staleFundraisers.add(id)
      else await recomputeFundraiserTotals(id)
    }
    return {
      orderId,
      unmatched,
      ...(fundraising ? { fundraiserId: fundraiser?.id ?? null, fundraiserCreated: fundraiser?.created ?? false } : {}),
    }
  }

  if (existing) {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: existing.id },
        data: {
          ...header,
          ...(attributionFields ?? {}),
          ...(fundraising ? { fundraiser: fundraiser ? { connect: { id: fundraiser.id } } : { disconnect: true } } : {}),
        },
      })
      // Lines are replaced wholesale so an edit in BigCommerce is reflected — unless
      // something here already points at them, which a read-only copy should never have.
      if (existing._count.fulfillments === 0 && existing._count.returnRequests === 0) {
        await tx.orderItem.deleteMany({ where: { orderId: existing.id } })
        await tx.orderItem.createMany({ data: items.map((item) => ({ ...item, orderId: existing.id })) })
      }
    })
    return { action: 'updated', ...(await refreshTotals(existing.id)) }
  }

  const email = order.billing_address.email?.trim().toLowerCase() || null
  const user = email
    ? await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } })
    : null

  const created = await prisma.order.create({
    data: {
      ...header,
      ...(attributionFields ?? {}),
      ...(fundraiser ? { fundraiser: { connect: { id: fundraiser.id } } } : {}),
      orderNumber,
      createdAt: orderDate,
      salesChannel: fundraising ? 'FUNDRAISER' : 'WEBSITE',
      paymentChannel: 'ONLINE',
      paymentProvider: null,
      importSource: ORDER_SOURCE[store],
      importedAt: new Date(),
      shippingMethod: shipping?.shipping_method || null,
      ...(user ? { user: { connect: { id: user.id } } } : { guestEmail: email, guestPhone: order.billing_address.phone || null }),
      billingAddress: { create: { ...toAddress(order.billing_address, user?.id ?? null), type: 'BILLING' } },
      ...(shipping ? { shippingAddress: { create: { ...toAddress(shipping, user?.id ?? null), type: 'SHIPPING' } } } : {}),
      items: { create: items },
    },
    select: { id: true },
  })
  return { action: 'created', ...(await refreshTotals(created.id)) }
}

/**
 * Mirrors every order in `store` created or changed since `since`. The cron
 * uses it to catch anything a missed webhook left behind; the backfill script
 * uses it to copy history.
 */
export async function syncBigCommerceOrders(
  since: Date,
  onResult?: (bigCommerceOrderId: number, result: MirrorResult | Error) => void,
  store: BigCommerceStoreKey = 'main',
): Promise<{ created: number; updated: number; skipped: number; failed: number }> {
  const tally = { created: 0, updated: 0, skipped: 0, failed: 0 }
  const context: MirrorContext = {
    store,
    catalog: await getBigCommerceProducts(store),
    siteProducts: await loadSiteProducts(),
    staleFundraisers: new Set<string>(),
  }

  try {
    await syncPages(since, store, context, tally, onResult)
  } finally {
    // Whatever was copied before a failure still gets correct campaign totals.
    for (const id of context.staleFundraisers ?? []) await recomputeFundraiserTotals(id)
  }
  return tally
}

const SYNC_CONCURRENCY = 4

async function syncPages(
  since: Date,
  store: BigCommerceStoreKey,
  context: MirrorContext,
  tally: { created: number; updated: number; skipped: number; failed: number },
  onResult?: (bigCommerceOrderId: number, result: MirrorResult | Error) => void,
): Promise<void> {
  for (let page = 1; ; page++) {
    const orders =
      (await bigCommerceFetch<Array<{ id: number }> | null>(store, 'v2/orders', {
        query: { min_date_modified: since.toISOString(), sort: 'id:asc', limit: 250, page },
      })) ?? []

    // A few at a time: a backfill of years of orders is otherwise hours of round trips. The
    // client backs off on BigCommerce's 429s, and new fundraisers tolerate a concurrent create.
    const queue = orders.map(({ id }) => id)
    const worker = async () => {
      for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
        try {
          const result = await mirrorBigCommerceOrder(id, context)
          tally[result.action]++
          onResult?.(id, result)
        } catch (error) {
          tally.failed++
          onResult?.(id, error instanceof Error ? error : new Error(String(error)))
        }
      }
    }
    await Promise.all(Array.from({ length: SYNC_CONCURRENCY }, worker))
    if (orders.length < 250) return
  }
}
