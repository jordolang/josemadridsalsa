/**
 * Data loaders for the desktop admin shell.
 *
 * Every figure here is read from the database. Where the design called for a
 * column this schema does not carry — a wholesale price on `Product`, a mailing
 * address on `Customer`, jar counts per fundraiser participant — the column is
 * replaced by the nearest field that is actually true rather than filled with a
 * plausible number.
 *
 * Loaders are deliberately capped: the shell is a keyboard-driven table, not a
 * report builder, so each section reads a recent window and says so in its
 * totals row.
 */

import { SalesChannel, type Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { gmailThreadUrl } from '@/lib/inbox/gmail'
import { isMissingTableError } from '@/lib/prisma-errors'
import {
  findPage,
  findSection,
  pageKind,
  pagesFor,
  type DesktopPage,
  type DesktopSection,
  type DesktopSectionId,
} from './sections'
import { allowedPages } from './access'
import { getPlatformStats, getRecentAudit, getStatusChecks } from '@/lib/developer/status'
import {
  reconcileYears,
  summariseReconciliation,
  type ReconciliationStatus,
} from '@/lib/financials/reconciliation'
import type { AnalyticsRangeKey } from '@/lib/analytics/date-range'
import { getCohortReport } from '@/lib/analytics/cohort-retention.server'
import type { CohortRow } from '@/lib/analytics/cohort-retention'
import { getMarginReport } from '@/lib/analytics/margin-report.server'
import { getAttributionReport } from '@/lib/analytics/utm-report.server'
import { DIRECT_LABEL } from '@/lib/analytics/utm-report'
import { POINTS_PER_DOLLAR } from '@/lib/loyalty'
import { rewardReturnPercent } from '@/lib/loyalty-rewards-schema'
import {
  bytes,
  centsToMoney,
  channelLabel,
  channelTone,
  count,
  excerpt,
  heatTone,
  humanise,
  money,
  moneyShort,
  orderStatusTone,
  percent,
  personName,
  place,
  shortDate,
  stamp,
  stars,
  STORE_TIME_ZONE,
  toNumber,
} from './format'
import type { FormId, FormValues, WriteOpId } from './forms'
import { DEFAULT_LIST, type ListQuery } from './list'
import type {
  AnalyticsPayload,
  Cell,
  Column,
  DashboardPayload,
  DesktopBadges,
  DesktopCommand,
  EventsPayload,
  Inspector,
  InspectorLine,
  LinkPayload,
  Row,
  SectionPayload,
  SettingsPayload,
  TablePayload,
  Tone,
} from './types'

/**
 * Search the database for every word of `q`, each matching any of `fields`.
 *
 * Used by the lists that outgrow their window, so a customer outside the newest
 * rows is still found. Undefined when there is nothing to search for, which
 * Prisma reads as no condition at all.
 */
type WordFilter = { contains: string; mode: 'insensitive' }

function matching<W>(q: string, fields: (word: WordFilter, raw: string) => W[]): W | undefined {
  const words = searchWords(q)
  if (words.length === 0) return undefined
  return { AND: words.map((word) => ({ OR: fields({ contains: word, mode: 'insensitive' }, word) })) } as W
}

function searchWords(q: string): string[] {
  return q.split(/\s+/).filter(Boolean)
}

/**
 * A four-digit word as a year, for the lists whose search text carries one.
 * Each searchable loader matches every field its row's `search` text holds,
 * because the shell trusts the database's answer for those pages rather than
 * filtering again — a field left out here is a search that quietly finds nothing.
 */
const yearOf = (word: string): number | null => (/^\d{4}$/.test(word) ? Number(word) : null)

/** Pages whose loader passes `list.q` to the database, rather than leaving it to the filter box. */
const SEARCHABLE_PAGES = new Set([
  'orders',
  'customers',
  'audit',
  'email.lists',
  'media.documents',
  'media.mileage',
  'media.shows',
])

/**
 * An order only counts as a sale once it is paid, and exchange replacements are
 * fulfillment obligations rather than revenue (see the note on
 * `Order.exchangeForReturnId`).
 */
const SOLD = {
  paymentStatus: { in: ['PAID', 'SUCCEEDED'] },
  exchangeForReturnId: null,
} satisfies Prisma.OrderWhereInput

/**
 * Run a query that may hit a table this database has not migrated yet.
 *
 * A section whose table is missing shows as empty, which is the truth, instead
 * of taking the whole window down with it.
 */
async function safe<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (isMissingTableError(error)) return fallback
    throw error
  }
}

const text = (value: string, extra: Partial<Cell> = {}): Cell => ({ text: value, ...extra })

function statusCell(label: string, tone: Tone): Cell {
  return { text: label, tone, dot: true }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/**
 * Shorthand for the four things a button in this window can do.
 *
 * A loader hands the shell commands rather than links, and an `edit` carries the
 * record it read alongside them — the sheet opens filled in, without a second
 * round trip to fetch what this query already has in hand.
 */
const form = (
  id: FormId,
  options: { recordId?: string; values?: FormValues; title?: string } = {},
): DesktopCommand => ({ kind: 'form', form: id, ...options })

const write = (
  op: WriteOpId,
  recordId: string,
  options: { confirm?: string; success?: string; danger?: boolean; values?: FormValues } = {},
): DesktopCommand => ({ kind: 'write', op, recordId, ...options })

const jump = (section: DesktopSectionId): DesktopCommand => ({ kind: 'section', section })

/** Move the window to one page inside a section, e.g. `email.suppressions`. */
const page = (id: string): DesktopCommand => ({ kind: 'page', page: id })

const link = (href: string): DesktopCommand => ({ kind: 'open', href })

/** A shipping label: the desktop apps print it on the label printer, a browser opens it. */
const printLabel = (href: string): DesktopCommand => ({ kind: 'label', href })

// ---------------------------------------------------------------------------
// Form values
// ---------------------------------------------------------------------------

/** A `date` input wants `YYYY-MM-DD`, and it has to be the day it is in Ohio. */
const DATE_INPUT = new Intl.DateTimeFormat('en-CA', {
  timeZone: STORE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function dateValue(value: Date | null | undefined): string {
  return value ? DATE_INPUT.format(value) : ''
}

/** A `datetime` field travels as an instant; the sheet shows it in local time. */
function instantValue(value: Date | null | undefined): string {
  return value ? value.toISOString() : ''
}

function moneyValue(value: Prisma.Decimal | number | null | undefined): string {
  return value === null || value === undefined ? '' : toNumber(value).toFixed(2)
}

function numberValue(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value)
}

function textValue(value: string | null | undefined): string {
  return value ?? ''
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

const ORDER_FILTERS = ['All channels', 'Online', 'Wholesale', 'Fundraiser', 'Shows']
const ORDER_FILTER_CHANNELS = ['', 'WEBSITE', 'WHOLESALE', 'FUNDRAISER', 'EVENT']

async function loadOrders(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const orders = await safe(
    () =>
      prisma.order.findMany({
        where: matching<Prisma.OrderWhereInput>(list.q, (word, raw) => [
          { orderNumber: word },
          { guestEmail: word },
          { trackingNumber: word },
          { user: { is: { OR: [{ name: word }, { email: word }] } } },
          {
            shippingAddress: {
              is: { OR: [{ firstName: word }, { lastName: word }, { city: word }, { state: word }] },
            },
          },
          // The Channel column shows a label ("Online", "Shows"); match it to the enum.
          ...Object.values(SalesChannel)
            .filter((channel) => channelLabel(channel).toLowerCase().includes(raw.toLowerCase()))
            .map((channel) => ({ salesChannel: channel })),
        ]),
        orderBy: { createdAt: 'desc' },
        take: list.limit,
        include: {
          user: { select: { name: true, email: true } },
          shippingAddress: { select: { firstName: true, lastName: true, city: true, state: true } },
          items: { select: { quantity: true } },
        },
      }),
    [],
  )

  const columns: Column[] = [
    { label: 'Order', width: '104px' },
    { label: 'Customer', width: 'minmax(0,1.5fr)' },
    { label: 'Ship to', width: 'minmax(0,1.1fr)' },
    { label: 'Channel', width: '96px' },
    { label: 'Jars', width: '54px', right: true },
    { label: 'Total', width: '92px', right: true },
    { label: 'Status', width: '122px' },
    { label: 'Placed', width: '112px' },
  ]

  let jars = 0
  let value = 0

  const rows: Row[] = orders.map((order) => {
    const units = order.items.reduce((sum, item) => sum + item.quantity, 0)
    const total = toNumber(order.total)
    jars += units
    value += total

    const customer = personName({
      name: order.user?.name,
      firstName: order.shippingAddress?.firstName,
      lastName: order.shippingAddress?.lastName,
      email: order.user?.email ?? order.guestEmail,
    })
    const shipTo = order.shippingAddress ? place(order.shippingAddress) : '—'
    const channel = channelLabel(order.salesChannel)

    return {
      id: order.id,
      open: form('order.status', {
        recordId: order.id,
        title: `Order ${order.orderNumber}`,
        values: {
          status: order.status,
          paymentStatus: order.paymentStatus,
          salesChannel: order.salesChannel,
          adminNotes: textValue(order.adminNotes),
        },
      }),
      search: `${order.orderNumber} ${customer} ${shipTo} ${channel}`,
      buckets: bucketsFor(ORDER_FILTER_CHANNELS, order.salesChannel),
      cells: [
        text(order.orderNumber, { mono: true, dim: true }),
        text(customer, { strong: true }),
        text(shipTo, { dim: true }),
        { text: channel, dim: true, dot: true, tone: channelTone(order.salesChannel) },
        text(count(units), { mono: true, right: true }),
        text(money(total), { mono: true, right: true, strong: true }),
        statusCell(humanise(order.status), orderStatusTone(order.status)),
        text(stamp(order.createdAt), { mono: true, dim: true }),
      ],
      inspector: {
        title: order.orderNumber,
        tag: humanise(order.status),
        tagTone: orderStatusTone(order.status),
        groups: [
          {
            label: 'ORDER',
            fields: [
              { label: 'Customer', value: customer },
              { label: 'Channel', value: channel },
              { label: 'Placed', value: stamp(order.createdAt), mono: true },
              { label: 'Ship to', value: shipTo },
              { label: 'Method', value: order.shippingMethod ?? '—' },
              { label: 'Tracking', value: order.trackingNumber ?? '—', mono: true },
            ],
          },
          {
            label: 'MONEY',
            fields: [
              { label: 'Subtotal', value: money(order.subtotal), mono: true },
              { label: 'Shipping', value: money(order.shippingCost), mono: true },
              { label: 'Tax', value: money(order.tax), mono: true },
              { label: 'Discount', value: money(order.discountAmount), mono: true },
              { label: 'Total', value: money(total), mono: true, strong: true },
              { label: 'Payment', value: humanise(order.paymentStatus) },
              { label: 'Fulfillment', value: humanise(order.fulfillmentStatus) },
            ],
          },
        ],
      
        actions: [
          {
            label: 'Edit order…',
            shortcut: '⌘⏎',
            command: form('order.status', {
              recordId: order.id,
              title: `Order ${order.orderNumber}`,
              values: {
                status: order.status,
                paymentStatus: order.paymentStatus,
                salesChannel: order.salesChannel,
                adminNotes: textValue(order.adminNotes),
              },
            }),
          },
          {
            label: 'Shipping & tracking…',
            shortcut: '⌘S',
            command: form('order.tracking', {
              recordId: order.id,
              title: `Tracking · ${order.orderNumber}`,
              values: {
                carrierName: textValue(order.carrierName),
                shippingMethod: textValue(order.shippingMethod),
                trackingNumber: textValue(order.trackingNumber),
                trackingUrl: textValue(order.trackingUrl),
                shippedAt: instantValue(order.shippedAt),
                estimatedDelivery: dateValue(order.estimatedDelivery),
              },
            }),
          },
          ...(order.paymentStatus === 'PAID' || order.paymentStatus === 'SUCCEEDED'
            ? []
            : [
                {
                  label: 'Mark paid',
                  shortcut: '⌘⇧P',
                  command: write('order.markPaid', order.id, {
                    confirm: `Mark ${order.orderNumber} as paid? This does not take any money — it records that it arrived.`,
                  }),
                },
              ]),
          // A button rather than only the status sheet, so a stack of paid orders
          // can be marked shipped together from the bulk bar. It sends what the
          // sheet would, with the status moved on, so fulfillment is stamped by
          // the same handler either way.
          ...((order.paymentStatus === 'PAID' || order.paymentStatus === 'SUCCEEDED') &&
          ['PENDING', 'CONFIRMED', 'PROCESSING'].includes(order.status)
            ? [
                {
                  label: 'Mark shipped',
                  command: write('order.status', order.id, {
                    values: {
                      status: 'SHIPPED',
                      paymentStatus: order.paymentStatus,
                      salesChannel: order.salesChannel,
                      adminNotes: textValue(order.adminNotes),
                    },
                    confirm: `Mark ${order.orderNumber} shipped? Every line is recorded as fulfilled.`,
                    success: `${order.orderNumber} marked shipped`,
                  }),
                },
              ]
            : []),
          ...(order.status === 'CANCELLED'
            ? []
            : [
                {
                  label: 'Cancel order',
                  danger: true,
                  command: write('order.cancel', order.id, {
                    confirm: `Cancel ${order.orderNumber}? Stock already taken out is not put back automatically.`,
                    danger: true,
                  }),
                },
              ]),
          { label: 'Print packing slip…', command: link(`/admin/orders/${order.id}/packing-slip`), shortcut: '⌘I' },
          { label: 'Returns', command: page('orders.returns'), shortcut: '⌘⇧B' },
          { label: 'Customers', command: jump('customers'), shortcut: '⌘U' },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} orders`),
      text(''),
      text(''),
      text(''),
      text(count(jars), { right: true }),
      text(money(value), { right: true, strong: true }),
      text(''),
      text(rows.length === list.limit ? `latest ${list.limit}` : '', { dim: true }),
    ],
  }
}

/** Which filter chips a row belongs to, given a chip-index-to-value map. */
function bucketsFor(values: readonly string[], actual: string): number[] {
  const buckets = [0]
  values.forEach((value, index) => {
    if (index > 0 && value === actual) buckets.push(index)
  })
  return buckets
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

const PRODUCT_FILTERS = ['All products', 'Active', 'Mild', 'Medium', 'Hot']
const PRODUCT_FILTER_HEAT = ['', '', 'MILD', 'MEDIUM', 'HOT']

/**
 * What the edit sheet opens with.
 *
 * The row and the inspector both offer the same edit, so the values live here
 * once rather than being written out beside each of them.
 */
function productEditValues(product: Prisma.ProductGetPayload<object>): FormValues {
  return {
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    barcode: textValue(product.barcode),
    categoryId: product.categoryId,
    heatLevel: product.heatLevel,
    description: textValue(product.description),
    ingredients: product.ingredients.join(', '),
    price: moneyValue(product.price),
    compareAtPrice: moneyValue(product.compareAtPrice),
    costPrice: moneyValue(product.costPrice),
    weight: moneyValue(product.weight),
    inventory: numberValue(product.inventory),
    // The same count, kept so the handler can tell a corrected field from an
    // untouched one rather than diffing against a fresh read.
    inventoryAt: numberValue(product.inventory),
    lowStockThreshold: numberValue(product.lowStockThreshold),
    unitsPerCase: numberValue(product.unitsPerCase),
    sortOrder: numberValue(product.sortOrder),
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    featuredImage: textValue(product.featuredImage),
    images: product.images,
    metaTitle: textValue(product.metaTitle),
    metaDescription: textValue(product.metaDescription),
    ogImage: textValue(product.ogImage),
    searchKeywords: product.searchKeywords.join(', '),
  }
}

async function loadProducts(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const products = await safe(
    () =>
      prisma.product.findMany({
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        take: list.limit,
        include: { category: { select: { name: true } } },
      }),
    [],
  )

  const columns: Column[] = [
    { label: 'Product', width: 'minmax(150px,1.6fr)' },
    { label: 'SKU', width: '104px' },
    { label: 'Category', width: '92px' },
    { label: 'Heat', width: '78px' },
    { label: 'Retail', width: '76px', right: true },
    { label: 'Cost', width: '76px', right: true },
    { label: 'Margin', width: '66px', right: true },
    { label: 'Status', width: '86px' },
    { label: 'Updated', width: '72px' },
  ]

  let retailTotal = 0
  let priced = 0

  const rows: Row[] = products.map((product) => {
    const retail = toNumber(product.price)
    const cost = product.costPrice === null ? null : toNumber(product.costPrice)
    const margin = cost !== null && retail > 0 ? ((retail - cost) / retail) * 100 : null
    retailTotal += retail
    priced += 1

    return {
      id: product.id,
      open: form('product.edit', {
        recordId: product.id,
        title: product.name,
        values: productEditValues(product),
      }),
      search: `${product.name} ${product.sku} ${product.barcode ?? ''} ${product.category.name}`,
      buckets: [
        0,
        ...(product.isActive ? [1] : []),
        ...PRODUCT_FILTER_HEAT.flatMap((heat, index) =>
          index > 1 && heat === product.heatLevel ? [index] : [],
        ),
      ],
      cells: [
        text(product.name, { strong: true }),
        text(product.sku, { mono: true, dim: true }),
        text(product.category.name, { dim: true }),
        { text: humanise(product.heatLevel), dim: true, dot: true, tone: heatTone(product.heatLevel) },
        text(money(retail), { mono: true, right: true }),
        text(cost === null ? '—' : money(cost), { mono: true, right: true, dim: true }),
        text(margin === null ? '—' : percent(margin, 0), { mono: true, right: true }),
        statusCell(product.isActive ? 'Active' : 'Inactive', product.isActive ? 'good' : 'muted'),
        text(shortDate(product.updatedAt), { mono: true, dim: true }),
      ],
      inspector: {
        title: product.name,
        tag: humanise(product.heatLevel),
        tagTone: heatTone(product.heatLevel),
        groups: [
          {
            label: 'PRODUCT',
            fields: [
              { label: 'SKU', value: product.sku, mono: true },
              { label: 'Category', value: product.category.name },
              { label: 'Heat', value: humanise(product.heatLevel) },
              { label: 'Units per case', value: count(product.unitsPerCase), mono: true },
              { label: 'Status', value: product.isActive ? 'Active' : 'Inactive' },
              { label: 'Updated', value: shortDate(product.updatedAt), mono: true },
            ],
          },
          {
            label: 'PRICING',
            fields: [
              { label: 'Retail', value: money(retail), mono: true },
              { label: 'Compare at', value: product.compareAtPrice ? money(product.compareAtPrice) : '—', mono: true },
              { label: 'Unit cost', value: cost === null ? 'Not set' : money(cost), mono: true },
              { label: 'Margin', value: margin === null ? '—' : percent(margin), mono: true, strong: true },
            ],
          },
          {
            label: 'STOCK',
            fields: [
              { label: 'On hand', value: count(product.inventory), mono: true },
              { label: 'Reserved', value: count(product.stockReserved), mono: true },
              { label: 'Available', value: count(product.inventory - product.stockReserved), mono: true },
              { label: 'Reorder at', value: count(product.lowStockThreshold), mono: true },
              { label: 'Stock status', value: humanise(product.stockStatus) },
            ],
          },
        ],
      
        actions: [
          {
            label: 'Edit product…',
            shortcut: '⌘⏎',
            command: form('product.edit', {
              recordId: product.id,
              title: product.name,
              values: productEditValues(product),
            }),
          },
          {
            label: 'Adjust stock…',
            shortcut: '⌘I',
            command: form('inventory.adjust', {
              recordId: product.id,
              title: `Adjust ${product.name} — ${count(product.inventory)} on hand`,
            }),
          },
          {
            label: product.isActive ? 'Hide from the store' : 'Put back in the store',
            shortcut: '⌘⇧H',
            command: write('product.toggleActive', product.id),
          },
          { label: 'View on the storefront…', command: link(`/products/${product.slug}`), shortcut: '⌘O' },
          {
            label: 'Delete product',
            danger: true,
            command: write('product.delete', product.id, {
              confirm: `Delete ${product.name}? A product that has been sold is retired instead, so its order lines survive.`,
              danger: true,
            }),
          },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} products`),
      text(''),
      text(''),
      text(''),
      text(priced ? `${money(retailTotal / priced)} avg` : '—', { right: true }),
      text(''),
      text(''),
      text(`${count(products.filter((product) => product.isActive).length)} active`),
      text(''),
    ],
  }
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

const INVENTORY_FILTERS = ['All SKUs', 'Below reorder', 'Watch', 'Healthy']

/** Where a SKU sits against its reorder point. */
function stockStanding(available: number, reorder: number): { label: string; tone: Tone; bucket: number } {
  if (available <= reorder) return { label: 'Below reorder', tone: 'bad', bucket: 1 }
  if (available <= reorder * 2) return { label: 'Watch', tone: 'warn', bucket: 2 }
  return { label: 'Healthy', tone: 'good', bucket: 3 }
}

async function loadInventory(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const products = await safe(
    () =>
      prisma.product.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        take: list.limit,
      }),
    [],
  )

  const columns: Column[] = [
    { label: 'Product', width: 'minmax(0,1.5fr)' },
    { label: 'SKU', width: '126px' },
    { label: 'Heat', width: '82px' },
    { label: 'On hand', width: '74px', right: true },
    { label: 'Reserved', width: '74px', right: true },
    { label: 'Available', width: '74px', right: true },
    { label: 'Reorder', width: '70px', right: true },
    { label: 'Cases', width: '58px', right: true },
    { label: 'Status', width: '118px' },
  ]

  let onHand = 0
  let reserved = 0

  const rows: Row[] = products.map((product) => {
    const available = product.inventory - product.stockReserved
    const standing = stockStanding(available, product.lowStockThreshold)
    onHand += product.inventory
    reserved += product.stockReserved

    return {
      id: product.id,
      open: form('inventory.adjust', {
        recordId: product.id,
        title: `Adjust ${product.name} — ${count(product.inventory)} on hand`,
      }),
      search: `${product.name} ${product.sku} ${product.barcode ?? ''}`,
      buckets: [0, standing.bucket],
      cells: [
        text(product.name, { strong: true }),
        text(product.sku, { mono: true, dim: true }),
        { text: humanise(product.heatLevel), dim: true, dot: true, tone: heatTone(product.heatLevel) },
        text(count(product.inventory), { mono: true, right: true, strong: true }),
        text(count(product.stockReserved), { mono: true, right: true, dim: true }),
        text(count(available), { mono: true, right: true, tone: standing.tone === 'bad' ? 'bad' : undefined }),
        text(count(product.lowStockThreshold), { mono: true, right: true, dim: true }),
        text(count(Math.floor(product.inventory / Math.max(product.unitsPerCase, 1))), {
          mono: true,
          right: true,
          dim: true,
        }),
        statusCell(standing.label, standing.tone),
      ],
      inspector: {
        title: product.name,
        tag: standing.label,
        tagTone: standing.tone,
        groups: [
          {
            label: 'STOCK',
            fields: [
              { label: 'SKU', value: product.sku, mono: true },
              { label: 'On hand', value: count(product.inventory), mono: true },
              { label: 'Reserved', value: count(product.stockReserved), mono: true },
              { label: 'Available', value: count(available), mono: true, strong: true },
              { label: 'Reorder point', value: count(product.lowStockThreshold), mono: true },
              { label: 'Units per case', value: count(product.unitsPerCase), mono: true },
            ],
          },
          {
            label: 'COSTING',
            fields: [
              { label: 'Unit cost', value: product.costPrice ? money(product.costPrice) : 'Not set', mono: true },
              { label: 'Retail', value: money(product.price), mono: true },
              {
                label: 'Stock at cost',
                value: product.costPrice ? money(toNumber(product.costPrice) * product.inventory) : '—',
                mono: true,
              },
              { label: 'Stock at retail', value: money(toNumber(product.price) * product.inventory), mono: true },
            ],
          },
        ],
      
        actions: [
          {
            label: 'Adjust stock…',
            shortcut: '⌘⏎',
            command: form('inventory.adjust', {
              recordId: product.id,
              title: `Adjust ${product.name} — ${count(product.inventory)} on hand`,
            }),
          },
          {
            label: 'Reorder point…',
            shortcut: '⌘⇧B',
            command: form('inventory.thresholds', {
              recordId: product.id,
              title: `Reorder point · ${product.name}`,
              values: {
                lowStockThreshold: numberValue(product.lowStockThreshold),
                unitsPerCase: numberValue(product.unitsPerCase),
              },
            }),
          },
          {
            label: 'New purchase order…',
            shortcut: '⌘U',
            command: form('purchase.create', {
              title: `Reorder ${product.name}`,
              values: {
                items: [
                  {
                    productId: product.id,
                    quantity: String(Math.max(product.unitsPerCase, 1)),
                    unitPrice: moneyValue(product.costPrice),
                  },
                ],
              },
            }),
          },
          { label: 'Purchase orders', command: jump('purchase'), shortcut: '⌘⇧P' },
          { label: 'Analytics', command: jump('analytics'), shortcut: '⌘N' },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} SKUs`),
      text(''),
      text(''),
      text(count(onHand), { right: true, strong: true }),
      text(count(reserved), { right: true }),
      text(count(onHand - reserved), { right: true }),
      text(''),
      text(''),
      text(''),
    ],
  }
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

const CUSTOMER_FILTERS = ['Everyone', 'Standard', 'Wholesale', 'Fundraising', 'Has ordered']
const CUSTOMER_FILTER_TYPES = ['', 'STANDARD', 'WHOLESALE', 'FUNDRAISING']

async function loadCustomers(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const customers = await safe(
    () =>
      prisma.customer.findMany({
        where: matching<Prisma.CustomerWhereInput>(list.q, (word) => [
          { email: word },
          { firstName: word },
          { lastName: word },
          { phone: word },
          { sourceName: word },
        ]),
        orderBy: [{ totalSpent: 'desc' }, { email: 'asc' }],
        take: list.limit,
      }),
    [],
  )

  const total = await safe(() => prisma.customer.count(), 0)

  const columns: Column[] = [
    { label: 'Customer', width: 'minmax(140px,1.3fr)' },
    { label: 'Email', width: 'minmax(140px,1.4fr)' },
    { label: 'Type', width: '96px' },
    { label: 'Source', width: 'minmax(96px,1fr)' },
    { label: 'Orders', width: '58px', right: true },
    { label: 'Lifetime', width: '94px', right: true },
    { label: 'Last order', width: '76px' },
  ]

  let orders = 0
  let spend = 0

  const rows: Row[] = customers.map((customer) => {
    const name = personName({
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
    })
    const spent = toNumber(customer.totalSpent)
    orders += customer.totalOrders
    spend += spent

    return {
      id: customer.id,
      open: form('customer.edit', { recordId: customer.id, title: name, values: {
          firstName: textValue(customer.firstName),
          lastName: textValue(customer.lastName),
          phone: textValue(customer.phone),
          accountType: customer.accountType,
          sourceName: textValue(customer.sourceName),
          notes: textValue(customer.notes),
        }, }),
      search: `${name} ${customer.email} ${customer.sourceName ?? ''}`,
      buckets: [
        ...bucketsFor(CUSTOMER_FILTER_TYPES, customer.accountType),
        ...(customer.totalOrders > 0 ? [4] : []),
      ],
      cells: [
        text(name, { strong: true }),
        text(customer.email, { mono: true, dim: true }),
        {
          text: humanise(customer.accountType),
          dim: true,
          dot: true,
          tone: customer.accountType === 'WHOLESALE' ? 'warn' : customer.accountType === 'FUNDRAISING' ? 'good' : 'muted',
        },
        text(customer.sourceName ?? humanise(customer.source), { dim: true }),
        text(count(customer.totalOrders), { mono: true, right: true }),
        text(money(spent), { mono: true, right: true, strong: true }),
        text(shortDate(customer.lastOrderAt), { mono: true, dim: true }),
      ],
      inspector: {
        title: name,
        tag: humanise(customer.accountType),
        tagTone: customer.accountType === 'WHOLESALE' ? 'warn' : customer.accountType === 'FUNDRAISING' ? 'good' : 'accent',
        groups: [
          {
            label: 'CONTACT',
            fields: [
              { label: 'Email', value: customer.email, mono: true },
              { label: 'Phone', value: customer.phone ?? '—' },
              { label: 'Type', value: humanise(customer.accountType) },
              { label: 'Source', value: customer.sourceName ?? humanise(customer.source) },
              { label: 'Email status', value: customer.emailStatus ?? '—' },
            ],
          },
          {
            label: 'VALUE',
            fields: [
              { label: 'Orders', value: count(customer.totalOrders), mono: true },
              { label: 'Lifetime', value: money(spent), mono: true, strong: true },
              {
                label: 'Average order',
                value: customer.totalOrders > 0 ? money(spent / customer.totalOrders) : '—',
                mono: true,
              },
              { label: 'Last order', value: shortDate(customer.lastOrderAt), mono: true },
            ],
          },
          ...(customer.notes
            ? [{ label: 'NOTES', fields: [{ label: 'Note', value: customer.notes, wrap: true }] }]
            : []),
        ],
      
        actions: [
          {
            label: 'Edit customer…',
            shortcut: '⌘⏎',
            command: form('customer.edit', {
              recordId: customer.id,
              title: name,
              values: {
                firstName: textValue(customer.firstName),
                lastName: textValue(customer.lastName),
                phone: textValue(customer.phone),
                accountType: customer.accountType,
                sourceName: textValue(customer.sourceName),
                notes: textValue(customer.notes),
              },
            }),
          },
          {
            label: 'New order for them…',
            shortcut: '⌘N',
            command: form('order.create', {
              title: `New order · ${name}`,
              values: {
                firstName: textValue(customer.firstName),
                lastName: textValue(customer.lastName),
                phone: textValue(customer.phone),
                salesChannel: customer.accountType === 'WHOLESALE' ? 'WHOLESALE' : 'PHONE',
              },
            }),
          },
          { label: 'Orders', command: jump('orders'), shortcut: '⌘O' },
          { label: 'Import customers…', command: link('/admin/customers/import'), shortcut: '⌘I' },
          {
            label: 'Delete customer',
            danger: true,
            command: write('customer.delete', customer.id, {
              confirm: `Delete ${customer.email}? Their orders stay; only the customer record goes.`,
              danger: true,
            }),
          },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} of ${count(total)}`),
      text(''),
      text(''),
      text(''),
      text(count(orders), { right: true }),
      text(money(spend), { right: true, strong: true }),
      text(''),
    ],
  }
}

// ---------------------------------------------------------------------------
// Fundraisers
// ---------------------------------------------------------------------------

const FUNDRAISER_FILTERS = ['All participants', 'Active campaigns', 'Has sales', 'No sales yet']

async function loadFundraisers(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const participants = await safe(
    () =>
      prisma.fundraiserParticipant.findMany({
        orderBy: [{ totalRevenue: 'desc' }, { name: 'asc' }],
        take: list.limit,
        include: {
          // Everything the campaign's own edit sheet needs, so opening it from a
          // participant row costs no second query.
          fundraiser: {
            select: {
              id: true,
              name: true,
              slug: true,
              organizationName: true,
              contactEmail: true,
              contactPhone: true,
              description: true,
              status: true,
              goal: true,
              totalRevenue: true,
              commissionRate: true,
              defaultUnitPrice: true,
              startDate: true,
              endDate: true,
              fulfillmentMethod: true,
              brochureOption: true,
              subdomain: true,
              isActive: true,
              missionStatement: true,
            },
          },
        },
      }),
    [],
  )

  const columns: Column[] = [
    { label: 'Participant', width: 'minmax(0,1.3fr)' },
    { label: 'Fundraiser', width: 'minmax(0,1.2fr)' },
    { label: 'Organization', width: 'minmax(0,1fr)' },
    { label: 'Orders', width: '64px', right: true },
    { label: 'Sales', width: '96px', right: true },
    { label: 'To org', width: '96px', right: true },
    { label: 'Status', width: '104px' },
  ]

  let orders = 0
  let sales = 0
  let commission = 0

  const rows: Row[] = participants.map((participant) => {
    const revenue = toNumber(participant.totalRevenue)
    const payout = toNumber(participant.totalCommission)
    orders += participant.totalOrders
    sales += revenue
    commission += payout

    const live = participant.fundraiser.status === 'ACTIVE'
    const campaign = participant.fundraiser

    return {
      id: participant.id,
      open: form('participant.edit', {
        recordId: participant.id,
        title: participant.name,
        values: {
          name: participant.name,
          email: participant.email,
          phone: textValue(participant.phone),
          status: participant.status,
          referralCode: participant.referralCode,
        },
      }),
      search: `${participant.name} ${participant.email} ${participant.fundraiser.name} ${participant.fundraiser.organizationName}`,
      buckets: [0, ...(live ? [1] : []), ...(revenue > 0 ? [2] : [3])],
      cells: [
        text(participant.name, { strong: true }),
        text(participant.fundraiser.name, { dim: true }),
        text(participant.fundraiser.organizationName, { dim: true }),
        text(count(participant.totalOrders), { mono: true, right: true }),
        text(money(revenue), { mono: true, right: true }),
        text(money(payout), { mono: true, right: true, strong: true }),
        statusCell(humanise(participant.status), participant.status === 'ACTIVE' ? 'good' : 'muted'),
      ],
      inspector: {
        title: participant.name,
        tag: humanise(participant.fundraiser.status),
        tagTone: live ? 'good' : 'muted',
        groups: [
          {
            label: 'CAMPAIGN',
            fields: [
              { label: 'Fundraiser', value: participant.fundraiser.name },
              { label: 'Organization', value: participant.fundraiser.organizationName },
              {
                label: 'Runs',
                value: `${shortDate(participant.fundraiser.startDate)} – ${shortDate(participant.fundraiser.endDate)}`,
              },
              // Goal and raised are both gross sales, not the group's cut.
              { label: 'Goal (sales)', value: participant.fundraiser.goal ? money(participant.fundraiser.goal) : '—', mono: true },
              { label: 'Raised (sales)', value: money(participant.fundraiser.totalRevenue), mono: true },
              { label: 'Split to org', value: `${percent(toNumber(participant.fundraiser.commissionRate), 0)}`, mono: true },
            ],
          },
          {
            label: 'PARTICIPANT',
            fields: [
              { label: 'Email', value: participant.email, mono: true },
              { label: 'Referral code', value: participant.referralCode, mono: true },
              { label: 'Orders', value: count(participant.totalOrders), mono: true },
              { label: 'Sales', value: money(revenue), mono: true },
              { label: 'To org', value: money(payout), mono: true, strong: true },
            ],
          },
        ],
      
        actions: [
          {
            label: 'Edit participant…',
            shortcut: '⌘⏎',
            command: form('participant.edit', {
              recordId: participant.id,
              title: participant.name,
              values: {
                name: participant.name,
                email: participant.email,
                phone: textValue(participant.phone),
                status: participant.status,
                referralCode: participant.referralCode,
              },
            }),
          },
          {
            label: 'Edit campaign…',
            shortcut: '⌘E',
            command: form('fundraiser.edit', {
              recordId: campaign.id,
              title: campaign.name,
              values: {
                name: campaign.name,
                slug: campaign.slug,
                organizationName: campaign.organizationName,
                contactEmail: campaign.contactEmail,
                contactPhone: textValue(campaign.contactPhone),
                description: textValue(campaign.description),
                startDate: dateValue(campaign.startDate),
                endDate: dateValue(campaign.endDate),
                goal: moneyValue(campaign.goal),
                commissionRate: moneyValue(campaign.commissionRate),
                defaultUnitPrice: moneyValue(campaign.defaultUnitPrice),
                status: campaign.status,
                fulfillmentMethod: campaign.fulfillmentMethod,
                brochureOption: campaign.brochureOption ?? '',
                subdomain: textValue(campaign.subdomain),
                isActive: campaign.isActive,
                missionStatement: textValue(campaign.missionStatement),
              },
            }),
          },
          {
            label: 'Add a participant…',
            shortcut: '⌘U',
            command: form('participant.create', {
              title: `Add to ${campaign.name}`,
              values: { fundraiserId: campaign.id },
            }),
          },
          ...(campaign.status === 'ENDED' || campaign.status === 'CANCELLED'
            ? []
            : [
                {
                  label: 'End the campaign',
                  command: write('fundraiser.end', campaign.id, {
                    confirm: `End ${campaign.name}? Its store stops taking orders and the campaign is marked ended.`,
                  }),
                },
              ]),
          { label: 'Battle arena', command: page('fundraisers.arena'), shortcut: '⌘B' },
          {
            label: 'Remove participant',
            danger: true,
            command: write('participant.delete', participant.id, {
              confirm: `Remove ${participant.name} from ${campaign.name}? Anyone with sales is kept and must be made inactive instead.`,
              danger: true,
            }),
          },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} participants`),
      text(''),
      text(''),
      text(count(orders), { right: true }),
      text(money(sales), { right: true }),
      text(money(commission), { right: true, strong: true }),
      text(''),
    ],
  }
}

// ---------------------------------------------------------------------------
// Events & shows
// ---------------------------------------------------------------------------

const EVENT_FILTERS = ['Upcoming', 'Confirmed', 'Pending', 'Past']

const EVENT_STATUS_TONE: Record<string, Tone> = {
  CONFIRMED: 'good',
  ACCEPTED: 'good',
  APPLIED: 'warn',
  INTERESTED: 'warn',
  WAITLISTED: 'warn',
  DECLINED: 'bad',
  CANCELLED: 'bad',
}

/** Calendar cells for `month`, Sunday-first, padded to whole weeks. */
function buildCalendar(month: Date, events: { startDate: Date; title: string }[]) {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const first = new Date(year, monthIndex, 1)
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const lead = first.getDay()
  const cellCount = Math.ceil((lead + daysInMonth) / 7) * 7
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIndex

  const byDay = new Map<number, string[]>()
  for (const event of events) {
    if (event.startDate.getFullYear() !== year || event.startDate.getMonth() !== monthIndex) continue
    const day = event.startDate.getDate()
    byDay.set(day, [...(byDay.get(day) ?? []), event.title])
  }

  return Array.from({ length: cellCount }, (_, index) => {
    const day = index - lead + 1
    const inMonth = day >= 1 && day <= daysInMonth
    return {
      day: inMonth ? String(day) : '',
      inMonth,
      today: inMonth && isCurrentMonth && day === today.getDate(),
      events: inMonth ? (byDay.get(day) ?? []) : [],
    }
  })
}

async function loadEvents(list: ListQuery = DEFAULT_LIST): Promise<EventsPayload> {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const [monthEvents, listed] = await Promise.all([
    safe(
      () =>
        prisma.featuredEvent.findMany({
          where: { startDate: { gte: monthStart, lt: monthEnd } },
          select: { startDate: true, title: true },
          orderBy: { startDate: 'asc' },
        }),
      [],
    ),
    safe(
      () =>
        prisma.featuredEvent.findMany({
          orderBy: { startDate: 'desc' },
          take: list.limit,
        }),
      [],
    ),
  ])

  const columns: Column[] = [
    { label: 'Date', width: '78px' },
    { label: 'Show', width: 'minmax(0,1.6fr)' },
    { label: 'Where', width: 'minmax(0,1fr)' },
    { label: 'Booth fee', width: '86px', right: true },
    { label: 'Taken', width: '92px', right: true },
    { label: 'Status', width: '104px' },
  ]

  const rows: Row[] = listed.map((event) => {
    const tone = EVENT_STATUS_TONE[event.bookingStatus] ?? 'muted'
    const upcoming = event.startDate >= now
    const taken = toNumber(event.cashSales) + toNumber(event.cardSales)
    const where = place({ city: event.city, state: event.state }) === '—' ? (event.location ?? '—') : place(event)

    return {
      id: event.id,
      open: form('event.edit', { recordId: event.id, title: event.title, values: {
          title: event.title,
          venue: textValue(event.venue),
          city: textValue(event.city),
          state: textValue(event.state),
          startDate: dateValue(event.startDate),
          endDate: dateValue(event.endDate),
          eventTimes: textValue(event.eventTimes),
          bookingStatus: event.bookingStatus,
          applicationDeadline: dateValue(event.applicationDeadline),
          description: textValue(event.description),
          boothFee: moneyValue(event.boothFee),
          attendance: numberValue(event.attendance),
          costOfFuel: moneyValue(event.costOfFuel),
          lodging: moneyValue(event.lodging),
          meals: moneyValue(event.meals),
          isWhereIsJose: event.isWhereIsJose,
        }, }),
      search: `${event.title} ${where} ${event.venue ?? ''}`,
      buckets: [
        ...(upcoming ? [0] : [3]),
        ...(event.bookingStatus === 'CONFIRMED' || event.bookingStatus === 'ACCEPTED' ? [1] : []),
        ...(event.bookingStatus === 'APPLIED' || event.bookingStatus === 'INTERESTED' || event.bookingStatus === 'WAITLISTED'
          ? [2]
          : []),
      ],
      cells: [
        text(shortDate(event.startDate), { mono: true, dim: true }),
        text(event.title, { strong: true }),
        text(where, { dim: true }),
        text(event.boothFee ? money(event.boothFee) : '—', { mono: true, right: true, dim: true }),
        text(taken > 0 ? money(taken) : '—', { mono: true, right: true, strong: taken > 0 }),
        statusCell(humanise(event.bookingStatus), tone),
      ],
      inspector: {
        title: event.title,
        tag: humanise(event.bookingStatus),
        tagTone: tone,
        groups: [
          {
            label: 'SHOW',
            fields: [
              { label: 'Starts', value: shortDate(event.startDate), mono: true },
              { label: 'Ends', value: shortDate(event.endDate), mono: true },
              { label: 'Venue', value: event.venue ?? event.location ?? '—' },
              { label: 'Where', value: where },
              { label: 'Hours', value: event.eventTimes ?? '—' },
              { label: 'Drive time', value: event.driveTime ?? '—', mono: true },
            ],
          },
          {
            label: 'COSTS',
            fields: [
              { label: 'Booth fee', value: event.boothFee ? money(event.boothFee) : '—', mono: true },
              { label: 'Fuel', value: event.costOfFuel ? money(event.costOfFuel) : '—', mono: true },
              { label: 'Lodging', value: event.lodging ? money(event.lodging) : '—', mono: true },
              { label: 'Meals', value: event.meals ? money(event.meals) : '—', mono: true },
              { label: 'Other', value: event.otherExpenses ? money(event.otherExpenses) : '—', mono: true },
            ],
          },
          {
            label: 'TAKINGS',
            fields: [
              { label: 'Cash', value: event.cashSales ? money(event.cashSales) : '—', mono: true },
              { label: 'Card', value: event.cardSales ? money(event.cardSales) : '—', mono: true },
              { label: 'Total', value: taken > 0 ? money(taken) : '—', mono: true, strong: true },
              { label: 'Attendance', value: event.attendance ? count(event.attendance) : '—', mono: true },
            ],
          },
        ],
      
        actions: [
          {
            label: 'Edit show…',
            shortcut: '⌘⏎',
            command: form('event.edit', {
              recordId: event.id,
              title: event.title,
              values: {
          title: event.title,
          venue: textValue(event.venue),
          city: textValue(event.city),
          state: textValue(event.state),
          startDate: dateValue(event.startDate),
          endDate: dateValue(event.endDate),
          eventTimes: textValue(event.eventTimes),
          bookingStatus: event.bookingStatus,
          applicationDeadline: dateValue(event.applicationDeadline),
          description: textValue(event.description),
          boothFee: moneyValue(event.boothFee),
          attendance: numberValue(event.attendance),
          costOfFuel: moneyValue(event.costOfFuel),
          lodging: moneyValue(event.lodging),
          meals: moneyValue(event.meals),
          isWhereIsJose: event.isWhereIsJose,
        },
            }),
          },
          {
            label: 'Show financials…',
            shortcut: '⌘N',
            command: form('event.financials', {
              recordId: event.id,
              title: `Financials · ${event.title}`,
              values: {
                cashSales: moneyValue(event.cashSales),
                cardSales: moneyValue(event.cardSales),
                boothFee: moneyValue(event.boothFee),
                costOfFuel: moneyValue(event.costOfFuel),
                lodging: moneyValue(event.lodging),
                meals: moneyValue(event.meals),
                otherExpenses: moneyValue(event.otherExpenses),
                otherExpensesNote: textValue(event.otherExpensesNote),
              },
            }),
          },
          { label: 'Packing manifests', command: page('events.manifests'), shortcut: '⌘F' },
          {
            label: 'Delete show',
            danger: true,
            command: write('event.delete', event.id, {
              confirm: `Delete ${event.title} from the calendar? Its takings go with it.`,
              danger: true,
            }),
          },
        ],
      },
    }
  })

  const monthLabel = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: STORE_TIME_ZONE,
  }).format(monthStart)

  return {
    view: 'events',
    monthLabel,
    monthSummary:
      monthEvents.length === 0
        ? 'Nothing on the calendar this month'
        : `${count(monthEvents.length)} date${monthEvents.length === 1 ? '' : 's'} this month`,
    days: buildCalendar(monthStart, monthEvents),
    columns,
    rows,
  }
}

// ---------------------------------------------------------------------------
// Financials — general ledger
// ---------------------------------------------------------------------------

const LEDGER_FILTERS = ['All entries', 'Income', 'Expenses', 'Not exported']

async function loadLedger(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const entries = await safe(
    () =>
      prisma.ledgerEntry.findMany({
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: list.limit,
      }),
    [],
  )

  const columns: Column[] = [
    { label: 'Date', width: '78px' },
    { label: 'Description', width: 'minmax(0,1.6fr)' },
    { label: 'Category', width: 'minmax(0,150px)' },
    { label: 'Debit', width: '96px', right: true },
    { label: 'Credit', width: '96px', right: true },
    { label: 'Source', width: '104px' },
    { label: 'Exported', width: '110px' },
  ]

  let debits = 0
  let credits = 0
  let unexported = 0

  // Oldest first so the running balance accumulates in the direction money moved,
  // then flipped back to newest-first for display.
  const chronological = [...entries].reverse()
  let balance = 0
  const balances = new Map<string, number>()
  for (const entry of chronological) {
    balance += entry.direction === 'INCOME' ? entry.amountCents : -entry.amountCents
    balances.set(entry.id, balance)
  }

  const rows: Row[] = entries.map((entry) => {
    const income = entry.direction === 'INCOME'
    if (income) credits += entry.amountCents
    else debits += entry.amountCents
    if (!entry.exportedAt) unexported += 1

    return {
      id: entry.id,
      // A derived row has no sheet of its own: the record it came from owns it.
      open: entry.isManual
        ? form('ledger.edit', { recordId: entry.id, title: entry.description, values: {
          date: dateValue(entry.date),
          direction: entry.direction,
          amount: (entry.amountCents / 100).toFixed(2),
          category: entry.category,
          description: entry.description,
          counterparty: textValue(entry.counterparty),
          paymentMethod: textValue(entry.paymentMethod),
          channel: entry.channel ?? '',
          memo: textValue(entry.memo),
        }, })
        : undefined,
      search: `${entry.description} ${entry.counterparty ?? ''} ${entry.category}`,
      buckets: [0, ...(income ? [1] : [2]), ...(entry.exportedAt ? [] : [3])],
      cells: [
        text(shortDate(entry.date), { mono: true, dim: true }),
        text(entry.description, { strong: true }),
        text(humanise(entry.category), { dim: true }),
        text(income ? '—' : centsToMoney(entry.amountCents), {
          mono: true,
          right: true,
          tone: income ? undefined : 'bad',
          dim: income,
        }),
        text(income ? centsToMoney(entry.amountCents) : '—', {
          mono: true,
          right: true,
          tone: income ? 'good' : undefined,
          dim: !income,
        }),
        text(humanise(entry.source), { dim: true, mono: true }),
        statusCell(entry.exportedAt ? shortDate(entry.exportedAt) : 'Not exported', entry.exportedAt ? 'good' : 'warn'),
      ],
      inspector: {
        title: entry.description,
        tag: humanise(entry.direction),
        tagTone: income ? 'good' : 'bad',
        groups: [
          {
            label: 'ENTRY',
            fields: [
              { label: 'Date', value: shortDate(entry.date), mono: true },
              { label: 'Amount', value: centsToMoney(entry.amountCents), mono: true, strong: true },
              { label: 'Category', value: humanise(entry.category) },
              { label: 'Source', value: humanise(entry.source) },
              { label: 'Counterparty', value: entry.counterparty ?? '—' },
              { label: 'Channel', value: entry.channel ? channelLabel(entry.channel) : '—' },
              { label: 'Method', value: entry.paymentMethod ?? '—' },
              { label: 'Entered by hand', value: entry.isManual ? 'Yes' : 'No' },
              { label: 'Balance after', value: centsToMoney(balances.get(entry.id) ?? 0), mono: true },
            ],
          },
          ...(entry.memo ? [{ label: 'MEMO', fields: [{ label: 'Note', value: entry.memo, wrap: true }] }] : []),
        ],
      
        actions: [
          // Only a hand-entered row is editable here; anything derived from an
          // order, a refund or an import is owned by the record it came from.
          ...(entry.isManual
            ? [
                {
                  label: 'Edit entry…',
                  shortcut: '⌘⏎',
                  command: form('ledger.edit', {
                    recordId: entry.id,
                    title: entry.description,
                    values: {
          date: dateValue(entry.date),
          direction: entry.direction,
          amount: (entry.amountCents / 100).toFixed(2),
          category: entry.category,
          description: entry.description,
          counterparty: textValue(entry.counterparty),
          paymentMethod: textValue(entry.paymentMethod),
          channel: entry.channel ?? '',
          memo: textValue(entry.memo),
        },
                  }),
                },
              ]
            : []),
          { label: 'New entry…', shortcut: '⌘N', command: form('ledger.create') },
          ...(entry.exportedAt
            ? []
            : [{ label: 'Mark exported', shortcut: '⌘E', command: write('ledger.markExported', entry.id) }]),
          { label: 'Reconciliation', command: page('ledger.reconciliation'), shortcut: '⌘⇧B' },
          { label: 'Import ledger…', command: link('/admin/financials/ledger/import'), shortcut: '⌘I' },
          ...(entry.isManual
            ? [
                {
                  label: 'Delete entry',
                  danger: true,
                  command: write('ledger.delete', entry.id, {
                    confirm: `Delete “${entry.description}”? Only hand-entered rows can go.`,
                    danger: true,
                  }),
                },
              ]
            : []),
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(''),
      text(`${count(rows.length)} entries`),
      text(''),
      text(centsToMoney(debits), { right: true, tone: 'bad' }),
      text(centsToMoney(credits), { right: true, tone: 'good' }),
      text(centsToMoney(credits - debits), { right: true, strong: true }),
      text(unexported ? `${count(unexported)} not exported` : 'All exported', { tone: unexported ? 'warn' : 'good' }),
    ],
  }
}

// ---------------------------------------------------------------------------
// Database console
// ---------------------------------------------------------------------------

/**
 * Row counts for the tables worth watching.
 *
 * Only counts are shown. On-disk size, index count and last-write time all need
 * `pg_catalog` queries, and this codebase goes through Prisma rather than raw
 * SQL, so those columns are left out instead of being estimated.
 */
const COUNTED_TABLES: { label: string; table: string; count: () => Promise<number> }[] = [
  { label: 'Orders', table: 'orders', count: () => prisma.order.count() },
  { label: 'Order items', table: 'order_items', count: () => prisma.orderItem.count() },
  { label: 'Products', table: 'products', count: () => prisma.product.count() },
  { label: 'Customers', table: 'customers', count: () => prisma.customer.count() },
  { label: 'Users', table: 'users', count: () => prisma.user.count() },
  { label: 'Payments', table: 'payments', count: () => prisma.payment.count() },
  { label: 'Fundraisers', table: 'fundraisers', count: () => prisma.fundraiser.count() },
  { label: 'Fundraiser participants', table: 'fundraiser_participants', count: () => prisma.fundraiserParticipant.count() },
  { label: 'Ledger entries', table: 'ledger_entries', count: () => prisma.ledgerEntry.count() },
  { label: 'Events & shows', table: 'featured_events', count: () => prisma.featuredEvent.count() },
  { label: 'Reviews', table: 'reviews', count: () => prisma.review.count() },
  { label: 'Email campaigns', table: 'email_campaigns', count: () => prisma.emailCampaign.count() },
  { label: 'Audit logs', table: 'audit_logs', count: () => prisma.auditLog.count() },
  { label: 'Notifications', table: 'notifications', count: () => prisma.notification.count() },
]

async function loadDatabase(): Promise<TablePayload> {
  const counts = await Promise.all(
    COUNTED_TABLES.map(async (entry) => ({ ...entry, rows: await safe(entry.count, 0) })),
  )
  counts.sort((a, b) => b.rows - a.rows)

  const columns: Column[] = [
    { label: 'Model', width: 'minmax(0,1fr)' },
    { label: 'Table', width: 'minmax(0,1.2fr)' },
    { label: 'Rows', width: '110px', right: true },
  ]

  const total = counts.reduce((sum, entry) => sum + entry.rows, 0)

  const rows: Row[] = counts.map((entry) => ({
    id: entry.table,
    open: jump('database'),
    search: `${entry.label} ${entry.table}`,
    buckets: [0, ...(entry.rows > 0 ? [1] : [2])],
    cells: [
      text(entry.label, { strong: true }),
      text(entry.table, { mono: true, dim: true }),
      text(count(entry.rows), { mono: true, right: true }),
    ],
    inspector: {
      title: entry.table,
      tag: `${count(entry.rows)} rows`,
      tagTone: 'accent',
      groups: [
        {
          label: 'TABLE',
          fields: [
            { label: 'Model', value: entry.label },
            { label: 'Table', value: entry.table, mono: true },
            { label: 'Rows', value: count(entry.rows), mono: true, strong: true },
          ],
        },
        {
          label: 'NOT SHOWN HERE',
          fields: [
            { label: 'On-disk size', value: 'Needs pg_catalog', wrap: true },
            { label: 'Index count', value: 'Needs pg_catalog', wrap: true },
            { label: 'Where', value: 'Open the Database Console', wrap: true },
          ],
        },
      ],
    
      actions: [
        { label: 'Database console', command: jump('database'), shortcut: '⌘⏎' },
        { label: 'Developer console…', command: link('/admin/developer'), shortcut: '⌘D' },
      ],
    },
  }))

  return {
    view: 'table',
    columns,
    rows,
    totals: [text(`${count(rows.length)} tables`), text(''), text(count(total), { right: true, strong: true })],
  }
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

/** Midnight tonight and midnight this morning, in store time. */
function todayRange(): { start: Date; end: Date } {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: STORE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0')
  const start = new Date(get('year'), get('month') - 1, get('day'))
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

async function loadDashboard(): Promise<DashboardPayload> {
  const { start, end } = todayRange()
  const now = new Date()

  const [todayOrders, todayTotals, liveFundraisers, products, upcoming] = await Promise.all([
    safe(
      () =>
        prisma.order.findMany({
          where: { createdAt: { gte: start, lt: end } },
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: {
            user: { select: { name: true, email: true } },
            shippingAddress: { select: { firstName: true, lastName: true } },
          },
        }),
      [],
    ),
    safe(
      () =>
        prisma.order.aggregate({
          where: { createdAt: { gte: start, lt: end }, ...SOLD },
          _sum: { total: true },
          _count: { _all: true },
        }),
      { _sum: { total: null }, _count: { _all: 0 } },
    ),
    safe(() => prisma.fundraiser.findMany({ where: { status: 'ACTIVE' }, select: { totalRevenue: true } }), []),
    safe(() => prisma.product.findMany({ where: { isActive: true } }), []),
    safe(
      () =>
        prisma.featuredEvent.findMany({
          where: { startDate: { gte: now } },
          orderBy: { startDate: 'asc' },
          take: 5,
          select: { startDate: true, title: true, city: true, state: true, location: true },
        }),
      [],
    ),
  ])

  const jarsOnHand = products.reduce((sum, product) => sum + product.inventory, 0)
  const lowStock = products
    .map((product) => ({
      id: product.id,
      name: product.name,
      inventory: product.inventory,
      available: product.inventory - product.stockReserved,
      reorder: product.lowStockThreshold,
    }))
    .filter((entry) => entry.available <= entry.reorder)
    .sort((a, b) => a.available - a.reorder - (b.available - b.reorder))

  const fundraiserRaised = liveFundraisers.reduce((sum, fundraiser) => sum + toNumber(fundraiser.totalRevenue), 0)
  const paidToday = todayTotals._count._all
  const revenueToday = toNumber(todayTotals._sum.total)

  return {
    view: 'dashboard',
    stats: [
      {
        label: 'REVENUE TODAY',
        value: moneyShort(revenueToday),
        note: `${count(paidToday)} paid order${paidToday === 1 ? '' : 's'}`,
      },
      {
        label: 'ORDERS TODAY',
        value: count(todayOrders.length),
        note: todayOrders.length ? 'all statuses, newest first' : 'nothing placed yet today',
      },
      {
        label: 'FUNDRAISERS LIVE',
        value: count(liveFundraisers.length),
        // Fundraiser revenue is gross sales, not the group's share.
        note: `${money(fundraiserRaised)} in sales`,
      },
      {
        label: 'JARS ON HAND',
        value: count(jarsOnHand),
        note: lowStock.length
          ? `${count(lowStock.length)} SKU${lowStock.length === 1 ? '' : 's'} at or below reorder`
          : 'every SKU above its reorder point',
        tone: lowStock.length ? 'bad' : undefined,
      },
    ],
    todayOrders: todayOrders.map((order) => ({
      id: order.orderNumber,
      customer: personName({
        name: order.user?.name,
        firstName: order.shippingAddress?.firstName,
        lastName: order.shippingAddress?.lastName,
        email: order.user?.email ?? order.guestEmail,
      }),
      channel: channelLabel(order.salesChannel),
      total: money(order.total),
      open: form('order.status', {
        recordId: order.id,
        title: `Order ${order.orderNumber}`,
        values: {
          status: order.status,
          paymentStatus: order.paymentStatus,
          salesChannel: order.salesChannel,
          adminNotes: textValue(order.adminNotes),
        },
      }),
    })),
    lowStock: lowStock.slice(0, 8).map((entry) => ({
      name: entry.name,
      available: count(entry.available),
      gap: `−${count(Math.max(entry.reorder - entry.available, 0))}`,
      // Straight to the adjustment, because that is what a low row is asking for.
      open: form('inventory.adjust', {
        recordId: entry.id,
        title: `Adjust ${entry.name} — ${count(entry.inventory)} on hand`,
      }),
    })),
    nextEvents: upcoming.map((event) => ({
      date: shortDate(event.startDate),
      name: event.title,
      city: place(event) === '—' ? (event.location ?? '—') : place(event),
      open: jump('events'),
    })),
    inspector: {
      title: 'Today',
      tag: shortDate(now),
      tagTone: 'accent',
      groups: [
        {
          label: 'AT A GLANCE',
          fields: [
            { label: 'Orders today', value: count(todayOrders.length), mono: true },
            { label: 'Revenue today', value: money(revenueToday), mono: true },
            { label: 'Fundraisers live', value: count(liveFundraisers.length), mono: true },
            { label: 'Shows upcoming', value: count(upcoming.length), mono: true },
          ],
        },
        {
          label: 'NEEDS YOU',
          fields: [
            { label: 'Below reorder', value: `${count(lowStock.length)} SKUs` },
            { label: 'Active products', value: count(products.length) },
          ],
        },
      ],
    
      actions: [
        { label: 'New order…', shortcut: '⌘⏎', command: form('order.create') },
        { label: 'New ledger entry…', shortcut: '⌘L', command: form('ledger.create') },
        { label: 'Inventory', shortcut: '⌘I', command: jump('inventory') },
        { label: 'Financials', shortcut: '⌘F', command: jump('ledger') },
      ],
    },
  }
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

const MONTH_LABEL = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: STORE_TIME_ZONE })

interface TopProduct {
  name: string
  quantity: number
  revenue: number
}

/**
 * Best-selling products by revenue in the window.
 *
 * Grouped on `OrderItem.productName` — the name snapshotted at the time of sale
 * — so a product that has since been renamed still reports under what it was
 * actually sold as.
 */
async function topProductsSince(since: Date): Promise<TopProduct[]> {
  const grouped = await safe(
    () =>
      prisma.orderItem.groupBy({
        by: ['productName'],
        where: { order: { createdAt: { gte: since }, ...SOLD } },
        _sum: { quantity: true, totalPrice: true },
        orderBy: { _sum: { totalPrice: 'desc' } },
        take: 8,
      }),
    null,
  )

  return (grouped ?? []).map((entry) => ({
    name: entry.productName,
    quantity: entry._sum?.quantity ?? 0,
    revenue: toNumber(entry._sum?.totalPrice),
  }))
}

async function loadAnalytics(): Promise<AnalyticsPayload> {
  const now = new Date()
  // Twelve whole months back, plus the same window a year earlier for comparison.
  const windowStart = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  const compareStart = new Date(windowStart.getFullYear() - 1, windowStart.getMonth(), 1)

  const [orders, items] = await Promise.all([
    safe(
      () =>
        prisma.order.findMany({
          where: { createdAt: { gte: compareStart }, ...SOLD },
          select: {
            createdAt: true,
            total: true,
            salesChannel: true,
            userId: true,
            guestEmail: true,
          },
        }),
      [],
    ),
    topProductsSince(windowStart),
  ])

  const current = orders.filter((order) => order.createdAt >= windowStart)
  const previous = orders.filter((order) => order.createdAt < windowStart)

  // Twelve buckets, oldest first, keyed by year-month.
  const buckets = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(windowStart.getFullYear(), windowStart.getMonth() + index, 1)
    return { date, key: `${date.getFullYear()}-${date.getMonth()}`, current: 0, previous: 0 }
  })
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]))

  for (const order of current) {
    const key = `${order.createdAt.getFullYear()}-${order.createdAt.getMonth()}`
    const bucket = byKey.get(key)
    if (bucket) bucket.current += toNumber(order.total)
  }
  for (const order of previous) {
    const key = `${order.createdAt.getFullYear() + 1}-${order.createdAt.getMonth()}`
    const bucket = byKey.get(key)
    if (bucket) bucket.previous += toNumber(order.total)
  }

  const revenue = current.reduce((sum, order) => sum + toNumber(order.total), 0)
  const priorRevenue = previous.reduce((sum, order) => sum + toNumber(order.total), 0)
  const growth = priorRevenue > 0 ? ((revenue - priorRevenue) / priorRevenue) * 100 : null

  // Channel mix over the trailing twelve months.
  const channelTotals = new Map<string, number>()
  for (const order of current) {
    channelTotals.set(order.salesChannel, (channelTotals.get(order.salesChannel) ?? 0) + toNumber(order.total))
  }
  const channels = [...channelTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([channel, amount]) => ({
      name: channelLabel(channel),
      amount: money(amount),
      pct: revenue > 0 ? percent((amount / revenue) * 100, 0) : '—',
      fraction: revenue > 0 ? amount / revenue : 0,
    }))

  // Retention by the quarter a buyer first ordered in — derived from orders, not
  // Customer.createdAt, which records when a record was imported rather than won.
  const identity = (order: { userId: string | null; guestEmail: string | null }) =>
    order.userId ?? order.guestEmail ?? null
  const firstOrder = new Map<string, Date>()
  const orderCount = new Map<string, number>()
  const spend = new Map<string, number>()
  for (const order of orders) {
    const key = identity(order)
    if (!key) continue
    const seen = firstOrder.get(key)
    if (!seen || order.createdAt < seen) firstOrder.set(key, order.createdAt)
    orderCount.set(key, (orderCount.get(key) ?? 0) + 1)
    spend.set(key, (spend.get(key) ?? 0) + toNumber(order.total))
  }

  const cohortMap = new Map<string, { people: number; returned: number; spend: number; sort: number }>()
  for (const [key, first] of firstOrder) {
    const quarter = Math.floor(first.getMonth() / 3) + 1
    const label = `Q${quarter} ${first.getFullYear()}`
    const entry = cohortMap.get(label) ?? { people: 0, returned: 0, spend: 0, sort: first.getFullYear() * 4 + quarter }
    entry.people += 1
    if ((orderCount.get(key) ?? 0) > 1) entry.returned += 1
    entry.spend += spend.get(key) ?? 0
    cohortMap.set(label, entry)
  }
  const cohorts = [...cohortMap.entries()]
    .sort((a, b) => a[1].sort - b[1].sort)
    .slice(-6)
    .map(([label, entry]) => ({
      quarter: label,
      customers: `${count(entry.people)} customer${entry.people === 1 ? '' : 's'}`,
      returned: entry.people ? `${percent((entry.returned / entry.people) * 100, 0)} returned` : '—',
      ltv: entry.people ? `${money(entry.spend / entry.people)} avg` : '—',
    }))

  const buyers = firstOrder.size
  const repeat = [...orderCount.values()].filter((value) => value > 1).length

  return {
    view: 'analytics',
    kpis: [
      { label: 'REVENUE · 12 MO', value: moneyShort(revenue), note: `${count(current.length)} paid orders` },
      {
        label: 'AVERAGE ORDER',
        value: current.length ? money(revenue / current.length) : '—',
        note: 'paid orders, exchanges excluded',
      },
      {
        label: 'VS PRIOR YEAR',
        value: growth === null ? '—' : `${growth >= 0 ? '+' : ''}${percent(growth)}`,
        note: `${moneyShort(priorRevenue)} in the prior twelve months`,
        tone: growth !== null && growth < 0 ? 'bad' : undefined,
      },
      {
        label: 'REPEAT RATE',
        value: buyers ? percent((repeat / buyers) * 100, 0) : '—',
        note: `${count(buyers)} distinct buyers`,
      },
      { label: 'CHANNELS ACTIVE', value: count(channels.length), note: 'with revenue in the window' },
      {
        label: 'TOP PRODUCT SHARE',
        value: items.length && revenue > 0 ? percent((items[0]!.revenue / revenue) * 100, 0) : '—',
        note: items.length ? items[0]!.name : 'no items sold in the window',
      },
    ],
    bars: buckets.map((bucket) => ({
      label: MONTH_LABEL.format(bucket.date),
      current: bucket.current,
      previous: bucket.previous,
      highlight: bucket.date.getMonth() === now.getMonth() && bucket.date.getFullYear() === now.getFullYear(),
    })),
    barMax: Math.max(1, ...buckets.flatMap((bucket) => [bucket.current, bucket.previous])),
    channels,
    topProducts: items.map((item) => ({
      name: item.name,
      jars: count(item.quantity),
      revenue: money(item.revenue),
    })),
    cohorts,
    inspector: {
      title: 'Trailing 12 months',
      tag: MONTH_LABEL.format(now),
      tagTone: 'accent',
      groups: [
        {
          label: 'PERIOD',
          fields: [
            { label: 'Revenue', value: money(revenue), mono: true },
            { label: 'Orders', value: count(current.length), mono: true },
            { label: 'Average order', value: current.length ? money(revenue / current.length) : '—', mono: true },
            { label: 'Distinct buyers', value: count(buyers), mono: true },
          ],
        },
        {
          label: 'SEGMENTS',
          lines: channels.map((channel) => ({ name: channel.name, qty: channel.pct, amount: channel.amount })),
        },
      ],
    
      actions: [
        { label: 'Report builder…', command: link('/admin/data'), shortcut: '⌘⏎' },
        { label: 'Retention', command: page('analytics.retention'), shortcut: '⌘E' },
        { label: 'Margin', command: page('analytics.margin'), shortcut: '⌘G' },
        { label: 'Attribution', command: page('analytics.attribution'), shortcut: '⌘T' },
      ],
    },
  }
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

async function loadSettings(): Promise<SettingsPayload> {
  const [seo, store, quickbooks, payments, carriers, integrations, subscribers] = await Promise.all([
    safe(() => prisma.seoConfiguration.findFirst(), null),
    safe(() => prisma.storeSettings.findUnique({ where: { singleton: 'singleton' } }), null),
    safe(() => prisma.quickBooksConnection.findFirst({ where: { isActive: true } }), null),
    safe(() => prisma.paymentProviderConfig.findMany({ orderBy: { provider: 'asc' } }), []),
    safe(() => prisma.shippingCarrier.findMany({ orderBy: { name: 'asc' } }), []),
    safe(() => prisma.thirdPartyIntegration.findMany({ orderBy: { name: 'asc' } }), []),
    safe(() => prisma.customer.count({ where: { emailStatus: 'subscribed' } }), 0),
  ])

  const connected = (on: boolean, onLabel = 'Connected', offLabel = 'Not connected') => ({
    value: on ? onLabel : offLabel,
    tone: (on ? 'good' : 'muted') as Tone,
  })

  return {
    view: 'settings',
    groups: [
      {
        label: 'STORE',
        rows: [
          { label: 'Business name', value: store?.businessName ?? seo?.siteName ?? '—' },
          { label: 'Support email', value: store?.supportEmail ?? '—', mono: true },
          { label: 'Support phone', value: store?.supportPhone ?? '—', mono: true },
          { label: 'Guest checkout', value: store?.allowGuestCheckout === false ? 'Off' : 'On' },
          {
            label: 'Minimum order',
            value: store?.minimumOrderCents ? centsToMoney(store.minimumOrderCents) : 'None',
            mono: true,
          },
          { label: 'Time zone', value: STORE_TIME_ZONE, mono: true },
          { label: 'Subscribed customers', value: count(subscribers), mono: true },
        ],
      edit: form('settings.store', {
          title: 'Store settings',
          values: {
            businessName: textValue(store?.businessName),
            supportEmail: textValue(store?.supportEmail),
            supportPhone: textValue(store?.supportPhone),
            businessAddress: textValue(store?.businessAddress),
            allowGuestCheckout: store?.allowGuestCheckout ?? true,
            minimumOrderCents: numberValue(store?.minimumOrderCents ?? 0),
            defaultLowStockThreshold: numberValue(store?.defaultLowStockThreshold ?? 5),
          },
        }),
      },
      {
        label: 'SEARCH',
        rows: [
          { label: 'Site name', value: seo?.siteName ?? '—' },
          { label: 'Site URL', value: seo?.siteUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? '—', mono: true },
          { label: 'Description', value: excerpt(seo?.siteDescription, 60) },
          { label: 'X / Twitter', value: seo?.twitterHandle ?? '—', mono: true },
          {
            label: 'robots.txt',
            value: seo?.robotsTxt ? 'Custom' : 'Default',
            tone: seo?.robotsTxt ? 'accent' : 'muted',
          },
        ],
        edit: form('settings.seo', {
          recordId: seo?.id,
          title: 'Search settings',
          values: {
            siteName: textValue(seo?.siteName),
            siteUrl: seo?.siteUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? '',
            siteDescription: textValue(seo?.siteDescription),
            twitterHandle: textValue(seo?.twitterHandle),
            defaultOgImage: textValue(seo?.defaultOgImage),
            robotsTxt: textValue(seo?.robotsTxt),
          },
        }),
      },
      {
        label: 'PAYMENTS',
        rows: payments.length
          ? payments.map((config) => ({
              label: humanise(config.provider),
              ...connected(config.isActive, config.testMode ? 'Active · test mode' : 'Active · live', 'Inactive'),
            }))
          : [{ label: 'Providers', value: 'None configured', tone: 'muted' as Tone }],
      },
      {
        label: 'SHIPPING',
        rows: [
          { label: 'Provider', value: process.env.SHIPPING_PROVIDER ?? 'Not set', mono: true },
          ...carriers.map((carrier) => ({ label: carrier.name, ...connected(carrier.isActive, 'Active', 'Inactive') })),
        ],
      },
      {
        label: 'ACCOUNTING',
        rows: [
          {
            label: 'QuickBooks Online',
            ...connected(Boolean(quickbooks), quickbooks?.companyName ?? 'Connected'),
          },
          { label: 'Environment', value: quickbooks?.environment ?? '—', mono: true },
          { label: 'Last synced', value: quickbooks?.lastSyncedAt ? stamp(quickbooks.lastSyncedAt) : 'Never', mono: true },
          ...(quickbooks?.connectionError
            ? [{ label: 'Last error', value: quickbooks.connectionError, tone: 'bad' as Tone }]
            : []),
        ],
      },
      {
        label: 'INTEGRATIONS',
        rows: integrations.length
          ? integrations.map((integration) => ({
              label: integration.name,
              ...connected(integration.isActive && integration.isConfigured, 'Connected'),
            }))
          : [{ label: 'Integrations', value: 'None configured', tone: 'muted' as Tone }],
      },
    ],
    inspector: {
      title: 'Store configuration',
      tag: 'Live',
      tagTone: 'good',
      groups: [
        {
          label: 'ABOUT THIS VIEW',
          fields: [
            { label: 'Source', value: 'Live database', wrap: true },
            {
              label: 'Editing',
              value: 'Store and search settings are edited here. Payment keys, carriers and integrations are edited where their secrets live.',
              wrap: true,
            },
          ],
        },
      ],
    
      actions: [
        {
          label: 'Store settings…',
          shortcut: '⌘⏎',
          command: form('settings.store', {
            title: 'Store settings',
            values: {
              businessName: textValue(store?.businessName),
              supportEmail: textValue(store?.supportEmail),
              supportPhone: textValue(store?.supportPhone),
              businessAddress: textValue(store?.businessAddress),
              allowGuestCheckout: store?.allowGuestCheckout ?? true,
              minimumOrderCents: numberValue(store?.minimumOrderCents ?? 0),
              defaultLowStockThreshold: numberValue(store?.defaultLowStockThreshold ?? 5),
            },
          }),
        },
        {
          label: 'Search settings…',
          shortcut: '⌘S',
          command: form('settings.seo', {
            recordId: seo?.id,
            title: 'Search settings',
            values: {
              siteName: textValue(seo?.siteName),
              siteUrl: seo?.siteUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? '',
              siteDescription: textValue(seo?.siteDescription),
              twitterHandle: textValue(seo?.twitterHandle),
              defaultOgImage: textValue(seo?.defaultOgImage),
              robotsTxt: textValue(seo?.robotsTxt),
            },
          }),
        },
        { label: 'Payments', command: page('settings.payments'), shortcut: '⌘Y' },
        { label: 'Shipping', command: page('settings.shipping'), shortcut: '⌘G' },
        { label: 'Integrations', command: page('settings.integrations'), shortcut: '⌘T' },
      ],
    },
  }
}

// ---------------------------------------------------------------------------
// Audit logs
// ---------------------------------------------------------------------------

async function loadAudit(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  // An audit row stores only the user's id, but the Who column shows a name, so
  // a searched word is first turned into the ids of the people it names.
  const peopleByWord = new Map(
    await Promise.all(
      searchWords(list.q).map(async (word) => {
        const people = await safe(
          () =>
            prisma.user.findMany({
              where: {
                OR: [
                  { name: { contains: word, mode: 'insensitive' } },
                  { email: { contains: word, mode: 'insensitive' } },
                ],
              },
              select: { id: true },
              take: 200,
            }),
          [],
        )
        return [word, people.map((person) => person.id)] as const
      }),
    ),
  )

  const logs = await safe(
    () =>
      prisma.auditLog.findMany({
        where: matching<Prisma.AuditLogWhereInput>(list.q, (word, raw) => [
          { action: word },
          { entityType: word },
          { entityId: word },
          { userId: { in: peopleByWord.get(raw) ?? [] } },
          // Rows with no user show as "system".
          ...('system'.includes(raw.toLowerCase()) ? [{ userId: null }] : []),
        ]),
        orderBy: { createdAt: 'desc' },
        take: list.limit,
      }),
    [],
  )

  const userIds = [...new Set(logs.map((log) => log.userId).filter((id): id is string => Boolean(id)))]
  const users = await safe(
    () => prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }),
    [],
  )
  const byId = new Map(users.map((user) => [user.id, personName(user)]))

  const columns: Column[] = [
    { label: 'When', width: '132px' },
    { label: 'Who', width: 'minmax(0,1fr)' },
    { label: 'Action', width: 'minmax(0,1fr)' },
    { label: 'Entity', width: 'minmax(0,1fr)' },
    { label: 'Origin', width: 'minmax(0,150px)' },
  ]

  const rows: Row[] = logs.map((log) => {
    const who = log.userId ? (byId.get(log.userId) ?? log.userId) : 'system'
    const entity = [log.entityType, log.entityId].filter(Boolean).join(' · ') || '—'

    return {
      id: log.id,
      open: undefined,
      search: `${who} ${log.action} ${entity}`,
      buckets: [0, ...(log.userId ? [1] : [2])],
      cells: [
        text(stamp(log.createdAt), { mono: true, dim: true }),
        text(who, { mono: true, tone: log.userId ? 'accent' : 'muted' }),
        text(log.action, { strong: true }),
        text(entity, { dim: true }),
        text(log.ipAddress ?? '—', { mono: true, dim: true }),
      ],
      inspector: {
        title: log.action,
        tag: log.userId ? 'user' : 'system',
        tagTone: log.userId ? 'accent' : 'muted',
        groups: [
          {
            label: 'EVENT',
            fields: [
              { label: 'When', value: stamp(log.createdAt), mono: true },
              { label: 'Who', value: who },
              { label: 'Action', value: log.action },
              { label: 'Entity type', value: log.entityType ?? '—' },
              { label: 'Entity id', value: log.entityId ?? '—', mono: true },
              { label: 'IP', value: log.ipAddress ?? '—', mono: true },
              { label: 'Agent', value: log.userAgent ?? '—', wrap: true },
            ],
          },
        ],
      
        actions: [
          { label: 'Users & roles', command: jump('users'), shortcut: '⌘U' },
          { label: 'Full audit log', command: jump('audit'), shortcut: '⌘⏎' },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} events`),
      text(''),
      text(''),
      text(''),
      text(rows.length === list.limit ? `latest ${list.limit}` : '', { dim: true }),
    ],
  }
}

// ---------------------------------------------------------------------------
// Purchase orders
// ---------------------------------------------------------------------------

const PURCHASE_FILTERS = ['All POs', 'Submitted', 'Partially received', 'Received']
const PURCHASE_FILTER_STATUSES = ['', 'SUBMITTED', 'PARTIALLY_RECEIVED', 'RECEIVED']

const PURCHASE_TONE: Record<string, Tone> = {
  DRAFT: 'muted',
  SUBMITTED: 'warn',
  PARTIALLY_RECEIVED: 'warn',
  RECEIVED: 'good',
  CANCELLED: 'muted',
}

async function loadPurchase(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const orders = await safe(
    () =>
      prisma.purchaseOrder.findMany({
        orderBy: { createdAt: 'desc' },
        take: list.limit,
        include: {
          supplier: { select: { name: true, city: true, state: true, email: true } },
          createdBy: { select: { name: true, email: true } },
          items: { include: { product: { select: { name: true, sku: true } } } },
        },
      }),
    [],
  )

  const columns: Column[] = [
    { label: 'PO', width: '108px' },
    { label: 'Supplier', width: 'minmax(0,1.2fr)' },
    { label: 'Items', width: 'minmax(0,1.6fr)' },
    { label: 'Jars', width: '64px', right: true },
    { label: 'Cost', width: '104px', right: true },
    { label: 'Expected', width: '96px' },
    { label: 'Status', width: '150px' },
  ]

  let jars = 0
  let value = 0

  const rows: Row[] = orders.map((order) => {
    const ordered = order.items.reduce((sum, item) => sum + item.quantityOrdered, 0)
    const lineTotal = order.items.reduce(
      (sum, item) => sum + toNumber(item.unitCost) * item.quantityOrdered,
      0,
    )
    const cost = lineTotal + toNumber(order.shippingCost)
    jars += ordered
    value += cost

    const first = order.items[0]
    const summary = first
      ? `${count(first.quantityOrdered)} × ${first.product.name}${
          order.items.length > 1 ? ` +${order.items.length - 1} more` : ''
        }`
      : 'No lines'
    const received = order.items.reduce((sum, item) => sum + item.quantityReceived, 0)

    return {
      id: order.id,
      open: form('purchase.edit', { recordId: order.id, title: order.poNumber, values: {
          supplierId: order.supplierId,
          expectedAt: dateValue(order.expectedAt),
          shippingCost: moneyValue(order.shippingCost),
          status: order.status,
          notes: textValue(order.notes),
        }, }),
      search: `${order.poNumber} ${order.supplier.name} ${summary}`,
      buckets: bucketsFor(PURCHASE_FILTER_STATUSES, order.status),
      cells: [
        text(order.poNumber, { mono: true, dim: true }),
        text(order.supplier.name, { strong: true }),
        text(summary, { dim: true }),
        text(count(ordered), { mono: true, right: true }),
        text(money(cost), { mono: true, right: true, strong: true }),
        text(shortDate(order.expectedAt), { mono: true, dim: true }),
        statusCell(humanise(order.status), PURCHASE_TONE[order.status] ?? 'muted'),
      ],
      inspector: {
        title: order.poNumber,
        tag: humanise(order.status),
        tagTone: PURCHASE_TONE[order.status] ?? 'muted',
        groups: [
          {
            label: 'ORDER',
            fields: [
              { label: 'Supplier', value: order.supplier.name },
              { label: 'From', value: place(order.supplier) },
              { label: 'Goods', value: money(lineTotal), mono: true },
              { label: 'Freight', value: money(order.shippingCost), mono: true },
              { label: 'Cost', value: money(cost), mono: true, strong: true },
              { label: 'Raised by', value: order.createdBy ? personName(order.createdBy) : '—' },
            ],
          },
          {
            label: 'RECEIVING',
            fields: [
              { label: 'Ordered', value: count(ordered), mono: true },
              { label: 'Received', value: count(received), mono: true },
              { label: 'Outstanding', value: count(Math.max(ordered - received, 0)), mono: true },
              { label: 'Expected', value: shortDate(order.expectedAt), mono: true },
              { label: 'Submitted', value: shortDate(order.submittedAt), mono: true },
              { label: 'Closed', value: shortDate(order.receivedAt ?? order.cancelledAt), mono: true },
            ],
          },
          {
            label: 'LINES',
            lines: order.items.map((item) => ({
              name: item.product.name,
              qty: count(item.quantityOrdered),
              amount: money(toNumber(item.unitCost) * item.quantityOrdered),
            })),
          },
        ],
        actions: [
          {
            label: 'Edit PO…',
            shortcut: '⌘⏎',
            command: form('purchase.edit', {
              recordId: order.id,
              title: order.poNumber,
              values: {
          supplierId: order.supplierId,
          expectedAt: dateValue(order.expectedAt),
          shippingCost: moneyValue(order.shippingCost),
          status: order.status,
          notes: textValue(order.notes),
        },
            }),
          },
          ...(order.status === 'DRAFT'
            ? [
                {
                  label: 'Submit to supplier',
                  shortcut: '⌘S',
                  command: write('purchase.submit', order.id, {
                    confirm: `Mark ${order.poNumber} as submitted? This records that it went out — it does not send anything.`,
                  }),
                },
              ]
            : []),
          ...(order.status === 'RECEIVED' || order.status === 'CANCELLED'
            ? []
            : [
                {
                  label: 'Receive everything outstanding',
                  shortcut: '⌘⇧B',
                  command: write('purchase.receive', order.id, {
                    confirm: `Receive everything still outstanding on ${order.poNumber} into stock?`,
                  }),
                },
              ]),
          { label: 'New PO…', shortcut: '⌘N', command: form('purchase.create') },
          { label: 'New supplier…', shortcut: '⌘U', command: form('supplier.create') },
          { label: 'Inventory', command: jump('inventory'), shortcut: '⌘I' },
          ...(order.status === 'CANCELLED' || order.status === 'RECEIVED'
            ? []
            : [
                {
                  label: 'Cancel PO',
                  danger: true,
                  command: write('purchase.cancel', order.id, {
                    confirm: `Cancel ${order.poNumber}? Anything already received stays in stock.`,
                    danger: true,
                  }),
                },
              ]),
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} purchase orders`),
      text(''),
      text(''),
      text(count(jars), { right: true }),
      text(money(value), { right: true, strong: true }),
      text(''),
      text(rows.length === list.limit ? `latest ${list.limit}` : '', { dim: true }),
    ],
  }
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

const INVOICE_FILTERS = ['All invoices', 'Sent', 'Overdue', 'Paid']
const INVOICE_FILTER_STATUSES = ['', 'SENT', 'OVERDUE', 'PAID']

const INVOICE_TONE: Record<string, Tone> = {
  DRAFT: 'muted',
  SENT: 'warn',
  PAID: 'good',
  OVERDUE: 'bad',
  CANCELLED: 'muted',
}

/**
 * The same JSON, shaped for the edit sheet's line repeater.
 *
 * The sheet needs a unit price, which older rows do not carry — they store the
 * line's `amount`. Dividing that by the quantity recovers what was charged per
 * unit, which is the number the operator would otherwise have to work out.
 */
function invoiceLineValues(value: Prisma.JsonValue | null | undefined): Record<string, string>[] {
  let parsed: unknown = value

  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed)
    } catch {
      return []
    }
  }

  if (!Array.isArray(parsed)) return []

  return parsed.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return []
    const line = entry as Record<string, unknown>
    const name = typeof line.description === 'string' ? line.description : line.name
    if (typeof name !== 'string' || !name.trim()) return []

    const rawQty = typeof line.quantity === 'number' ? line.quantity : line.qty
    const quantity = typeof rawQty === 'number' && rawQty > 0 ? rawQty : 1
    const amount = typeof line.amount === 'number' ? line.amount : line.total
    const unit =
      typeof line.unitPrice === 'number'
        ? line.unitPrice
        : typeof amount === 'number'
          ? amount / quantity
          : 0

    return [{ description: name.trim(), quantity: String(quantity), unitPrice: unit.toFixed(2) }]
  })
}

/**
 * An invoice's `lines` column is free-form JSON; read it defensively.
 *
 * Some rows store the array, others a JSON-encoded string of it. Both admin
 * invoice pages accept either (`parseLineCount`, `parseInvoiceLines`), so this
 * has to as well — treating a string as "no lines" would quietly show an
 * invoice with a total and nothing that adds up to it.
 */
function invoiceLines(value: Prisma.JsonValue | null | undefined): InspectorLine[] {
  let parsed: unknown = value

  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed)
    } catch {
      return []
    }
  }

  if (!Array.isArray(parsed)) return []

  return parsed.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return []
    const line = entry as Record<string, unknown>
    const name = typeof line.description === 'string' ? line.description : line.name
    if (typeof name !== 'string' || !name.trim()) return []

    const qty = typeof line.quantity === 'number' ? line.quantity : line.qty
    const amount = typeof line.amount === 'number' ? line.amount : line.total

    return [
      {
        name: name.trim(),
        qty: typeof qty === 'number' ? count(qty) : '—',
        amount: typeof amount === 'number' ? money(amount) : '—',
      },
    ]
  })
}

async function loadInvoices(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const invoices = await safe(
    () => prisma.invoice.findMany({ orderBy: { createdAt: 'desc' }, take: list.limit }),
    [],
  )

  // `Invoice.customerId` is an id without a relation, so the names come from a
  // second read rather than an include.
  const customerIds = [...new Set(invoices.map((invoice) => invoice.customerId).filter((id): id is string => Boolean(id)))]
  const customers = await safe(
    () =>
      prisma.customer.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, firstName: true, lastName: true, email: true },
      }),
    [],
  )
  const byId = new Map(customers.map((customer) => [customer.id, personName(customer)]))

  const columns: Column[] = [
    { label: 'Invoice', width: '112px' },
    { label: 'Customer', width: 'minmax(0,1.6fr)' },
    { label: 'Issued', width: '92px' },
    { label: 'Due', width: '92px' },
    { label: 'Amount', width: '104px', right: true },
    { label: 'Status', width: '116px' },
  ]

  const now = Date.now()
  let billed = 0
  let outstanding = 0

  const rows: Row[] = invoices.map((invoice) => {
    const total = toNumber(invoice.total)
    const settled = invoice.status === 'PAID' || invoice.status === 'CANCELLED'
    billed += total
    if (!settled) outstanding += total

    const customer = invoice.customerId ? (byId.get(invoice.customerId) ?? '—') : '—'
    // A sent invoice past its due date reads as overdue even if a nightly job
    // has not moved the stored status along yet. A DRAFT is not late: it was
    // never issued, and the invoice pages still show it as a draft.
    const lapsed =
      (invoice.status === 'SENT' || invoice.status === 'OVERDUE') && invoice.dueDate.getTime() < now
    const label = lapsed && invoice.status !== 'OVERDUE' ? 'Overdue' : humanise(invoice.status)
    const tone = lapsed ? 'bad' : (INVOICE_TONE[invoice.status] ?? 'muted')

    return {
      id: invoice.id,
      open: form('invoice.edit', { recordId: invoice.id, title: `Invoice ${invoice.number}`, values: {
          number: invoice.number,
          dueDate: dateValue(invoice.dueDate),
          customerId: textValue(invoice.customerId),
          status: invoice.status,
          notes: textValue(invoice.notes),
          lines: invoiceLineValues(invoice.lines),
        }, }),
      search: `${invoice.number} ${customer} ${invoice.status}`,
      buckets: bucketsFor(INVOICE_FILTER_STATUSES, lapsed ? 'OVERDUE' : invoice.status),
      cells: [
        text(invoice.number, { mono: true, dim: true }),
        text(customer, { strong: true }),
        text(shortDate(invoice.createdAt), { mono: true, dim: true }),
        text(shortDate(invoice.dueDate), { mono: true, dim: true, tone: lapsed ? 'bad' : undefined }),
        text(money(total), { mono: true, right: true, strong: true }),
        statusCell(label, tone),
      ],
      inspector: {
        title: invoice.number,
        tag: label,
        tagTone: tone,
        groups: [
          {
            label: 'INVOICE',
            fields: [
              { label: 'Customer', value: customer },
              { label: 'Issued', value: shortDate(invoice.createdAt), mono: true },
              { label: 'Due', value: shortDate(invoice.dueDate), mono: true },
              { label: 'Amount', value: money(total), mono: true, strong: true },
              { label: 'Sent', value: stamp(invoice.sentAt), mono: true },
              { label: 'Paid', value: stamp(invoice.paidAt), mono: true },
              { label: 'Order', value: invoice.orderId ?? '—', mono: true },
            ],
          },
          { label: 'LINES', lines: invoiceLines(invoice.lines) },
          ...(invoice.notes ? [{ label: 'NOTES', fields: [{ label: 'Note', value: invoice.notes, wrap: true }] }] : []),
        ],
        actions: [
          {
            label: 'Edit invoice…',
            shortcut: '⌘⏎',
            command: form('invoice.edit', {
              recordId: invoice.id,
              title: `Invoice ${invoice.number}`,
              values: {
          number: invoice.number,
          dueDate: dateValue(invoice.dueDate),
          customerId: textValue(invoice.customerId),
          status: invoice.status,
          notes: textValue(invoice.notes),
          lines: invoiceLineValues(invoice.lines),
        },
            }),
          },
          { label: 'New invoice…', shortcut: '⌘N', command: form('invoice.create') },
          ...(invoice.status === 'DRAFT'
            ? [{ label: 'Mark sent', shortcut: '⌘S', command: write('invoice.markSent', invoice.id) }]
            : []),
          ...(invoice.status === 'PAID' || invoice.status === 'CANCELLED'
            ? []
            : [
                {
                  label: 'Mark paid',
                  shortcut: '⌘⇧P',
                  command: write('invoice.markPaid', invoice.id, {
                    confirm: `Mark invoice ${invoice.number} paid? This records that the money arrived; it does not take it.`,
                  }),
                },
              ]),
          ...(invoice.orderId
            ? [{ label: 'Orders', command: jump('orders'), shortcut: '⌘O' }]
            : []),
          {
            label: 'Delete invoice',
            danger: true,
            command: write('invoice.delete', invoice.id, {
              confirm: `Delete invoice ${invoice.number}? Cancel it instead if it was ever sent.`,
              danger: true,
            }),
          },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} invoices`),
      text(''),
      text(''),
      text(outstanding > 0 ? `${money(outstanding)} open` : '', { tone: 'warn' }),
      text(money(billed), { right: true, strong: true }),
      text(''),
    ],
  }
}

// ---------------------------------------------------------------------------
// Wholesale
// ---------------------------------------------------------------------------

const WHOLESALE_FILTERS = ['All accounts', 'Approved', 'Pending', 'Suspended']
const WHOLESALE_FILTER_STATUSES = ['', 'APPROVED', 'PENDING', 'SUSPENDED']

const WHOLESALE_TONE: Record<string, Tone> = {
  PENDING: 'warn',
  APPROVED: 'good',
  REJECTED: 'bad',
  SUSPENDED: 'bad',
}

async function loadWholesale(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  // The design's price tier and year-to-date columns have no schema behind
  // them; the account's own discount, minimum and self-reported volume are the
  // nearest things that are actually true.
  const accounts = await safe(
    () =>
      prisma.wholesaleAccount.findMany({
        orderBy: { createdAt: 'desc' },
        take: list.limit,
        include: { user: { select: { name: true, email: true } } },
      }),
    [],
  )

  const columns: Column[] = [
    { label: 'Account', width: 'minmax(0,1.5fr)' },
    { label: 'Contact', width: 'minmax(0,1.2fr)' },
    { label: 'Type', width: '128px' },
    { label: 'Discount', width: '84px', right: true },
    { label: 'Minimum', width: '96px', right: true },
    { label: 'Status', width: '116px' },
    { label: 'Since', width: '88px' },
  ]

  let approved = 0

  const rows: Row[] = accounts.map((account) => {
    if (account.status === 'APPROVED') approved += 1
    const discount = toNumber(account.discountRate)

    return {
      id: account.id,
      open: form('wholesale.edit', { recordId: account.id, title: account.businessName, values: {
          businessName: account.businessName,
          contactName: account.contactName,
          businessType: account.businessType,
          status: account.status,
          discountRate: moneyValue(account.discountRate),
          minimumOrder: moneyValue(account.minimumOrder),
          resaleNumber: textValue(account.resaleNumber),
          taxId: textValue(account.taxId),
          website: textValue(account.website),
        }, }),
      search: `${account.businessName} ${account.contactName} ${account.user.email} ${account.businessType}`,
      buckets: bucketsFor(WHOLESALE_FILTER_STATUSES, account.status),
      cells: [
        text(account.businessName, { strong: true }),
        text(account.contactName, { dim: true }),
        text(humanise(account.businessType), { dim: true }),
        text(discount > 0 ? percent(discount, 0) : '—', { mono: true, right: true }),
        text(account.minimumOrder ? money(account.minimumOrder) : '—', { mono: true, right: true }),
        statusCell(humanise(account.status), WHOLESALE_TONE[account.status] ?? 'muted'),
        text(shortDate(account.createdAt), { mono: true, dim: true }),
      ],
      inspector: {
        title: account.businessName,
        tag: humanise(account.status),
        tagTone: WHOLESALE_TONE[account.status] ?? 'muted',
        groups: [
          {
            label: 'ACCOUNT',
            fields: [
              { label: 'Contact', value: account.contactName },
              { label: 'Email', value: account.user.email, mono: true },
              { label: 'Type', value: humanise(account.businessType) },
              { label: 'Website', value: account.website ?? '—', wrap: true },
              { label: 'Years trading', value: account.yearsInBusiness ? count(account.yearsInBusiness) : '—' },
              { label: 'Applied', value: shortDate(account.createdAt), mono: true },
              { label: 'Approved', value: shortDate(account.approvedAt), mono: true },
            ],
          },
          {
            label: 'TERMS',
            fields: [
              { label: 'Discount', value: discount > 0 ? percent(discount, 2) : '—', mono: true },
              { label: 'Minimum order', value: account.minimumOrder ? money(account.minimumOrder) : '—', mono: true },
              { label: 'Estimated volume', value: account.estimatedVolume ?? '—' },
              { label: 'Tax id', value: account.taxId ? 'On file' : '—' },
              { label: 'Resale number', value: account.resaleNumber ? 'On file' : '—' },
            ],
          },
        ],
        actions: [
          {
            label: 'Edit account…',
            shortcut: '⌘⏎',
            command: form('wholesale.edit', {
              recordId: account.id,
              title: account.businessName,
              values: {
          businessName: account.businessName,
          contactName: account.contactName,
          businessType: account.businessType,
          status: account.status,
          discountRate: moneyValue(account.discountRate),
          minimumOrder: moneyValue(account.minimumOrder),
          resaleNumber: textValue(account.resaleNumber),
          taxId: textValue(account.taxId),
          website: textValue(account.website),
        },
            }),
          },
          ...(account.status === 'APPROVED'
            ? []
            : [
                {
                  label: 'Approve account',
                  shortcut: '⌘⇧A',
                  command: write('wholesale.approve', account.id, {
                    confirm: `Approve ${account.businessName} for wholesale pricing?`,
                  }),
                },
              ]),
          ...(account.status === 'SUSPENDED'
            ? []
            : [
                {
                  label: 'Suspend account',
                  danger: true,
                  command: write('wholesale.suspend', account.id, {
                    confirm: `Suspend ${account.businessName}? They keep the account but lose wholesale pricing.`,
                    danger: true,
                  }),
                },
              ]),
          {
            label: 'New wholesale order…',
            shortcut: '⌘N',
            command: form('order.create', {
              title: `New order · ${account.businessName}`,
              values: { email: account.user.email, salesChannel: 'WHOLESALE' },
            }),
          },
          { label: 'Store locator', command: page('wholesale.locations'), shortcut: '⌘L' },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} accounts`),
      text(''),
      text(''),
      text(''),
      text(''),
      text(approved ? `${count(approved)} approved` : '', { tone: 'good' }),
      text(''),
    ],
  }
}

// ---------------------------------------------------------------------------
// Email marketing
// ---------------------------------------------------------------------------

const EMAIL_FILTERS = ['All', 'Sent', 'Scheduled', 'Drafts']
const EMAIL_FILTER_STATUSES = ['', 'SENT', 'SCHEDULED', 'DRAFT']

const EMAIL_TONE: Record<string, Tone> = {
  DRAFT: 'muted',
  SCHEDULED: 'warn',
  SENDING: 'warn',
  SENT: 'good',
  PAUSED: 'warn',
  CANCELLED: 'muted',
  FAILED: 'bad',
}

async function loadEmail(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const campaigns = await safe(
    () =>
      prisma.emailCampaign.findMany({
        orderBy: { createdAt: 'desc' },
        take: list.limit,
        include: {
          stats: true,
          list: { select: { name: true } },
          template: { select: { name: true } },
        },
      }),
    [],
  )

  const columns: Column[] = [
    { label: 'Campaign', width: 'minmax(0,1.7fr)' },
    { label: 'Audience', width: 'minmax(0,1fr)' },
    { label: 'Sent', width: '112px' },
    { label: 'Recipients', width: '86px', right: true },
    { label: 'Open', width: '70px', right: true },
    { label: 'Click', width: '70px', right: true },
    { label: 'Status', width: '110px' },
  ]

  let recipients = 0

  const rows: Row[] = campaigns.map((campaign) => {
    recipients += campaign.totalRecipients
    const audience = campaign.list?.name ?? 'All subscribers'
    const sentAt = campaign.completedAt ?? campaign.startedAt ?? campaign.scheduledAt
    const open = campaign.stats?.openRate ?? 0
    const click = campaign.stats?.clickRate ?? 0
    const measured = campaign.sentCount > 0

    return {
      id: campaign.id,
      // A campaign that has gone out is a record of what was sent, not a draft.
      open: campaign.status === 'SENT' || campaign.status === 'SENDING'
        ? link(`/admin/email-campaigns/${campaign.id}`)
        : form('campaign.edit', { recordId: campaign.id, title: campaign.name, values: {
          name: campaign.name,
          subject: campaign.subject,
          previewText: textValue(campaign.previewText),
          templateId: campaign.templateId,
          listId: textValue(campaign.listId),
          fromName: textValue(campaign.fromName),
          fromEmail: textValue(campaign.fromEmail),
          scheduledAt: instantValue(campaign.scheduledAt),
          trackOpens: campaign.trackOpens,
          trackClicks: campaign.trackClicks,
          notes: textValue(campaign.notes),
        }, }),
      search: `${campaign.name} ${campaign.subject} ${audience}`,
      buckets: bucketsFor(EMAIL_FILTER_STATUSES, campaign.status),
      cells: [
        text(campaign.name, { strong: true }),
        text(audience, { dim: true }),
        text(sentAt ? stamp(sentAt) : '—', { mono: true, dim: true }),
        text(count(campaign.totalRecipients), { mono: true, right: true }),
        text(measured ? percent(open) : '—', { mono: true, right: true, tone: open >= 40 ? 'good' : undefined }),
        text(measured ? percent(click) : '—', { mono: true, right: true, tone: click >= 10 ? 'good' : undefined }),
        statusCell(humanise(campaign.status), EMAIL_TONE[campaign.status] ?? 'muted'),
      ],
      inspector: {
        title: campaign.name,
        tag: humanise(campaign.status),
        tagTone: EMAIL_TONE[campaign.status] ?? 'muted',
        groups: [
          {
            label: 'CAMPAIGN',
            fields: [
              { label: 'Subject', value: campaign.subject, wrap: true },
              { label: 'Audience', value: audience },
              { label: 'Template', value: campaign.template.name },
              { label: 'From', value: campaign.fromEmail ?? '—', mono: true },
              { label: 'Scheduled', value: stamp(campaign.scheduledAt), mono: true },
              { label: 'Completed', value: stamp(campaign.completedAt), mono: true },
              { label: 'A/B test', value: campaign.isAbTest ? 'Yes' : 'No' },
            ],
          },
          {
            label: 'DELIVERY',
            fields: [
              { label: 'Recipients', value: count(campaign.totalRecipients), mono: true },
              { label: 'Sent', value: count(campaign.sentCount), mono: true },
              { label: 'Failed', value: count(campaign.failedCount), mono: true },
              { label: 'Bounced', value: count(campaign.bouncedCount), mono: true },
            ],
          },
          {
            label: 'PERFORMANCE',
            fields: [
              { label: 'Opens', value: measured ? percent(open) : '—', mono: true, strong: true },
              { label: 'Clicks', value: measured ? percent(click) : '—', mono: true },
              { label: 'Unsubscribes', value: measured ? percent(campaign.stats?.unsubscribeRate ?? 0) : '—', mono: true },
              { label: 'Bounces', value: measured ? percent(campaign.stats?.bounceRate ?? 0) : '—', mono: true },
              { label: 'Spam', value: measured ? percent(campaign.stats?.spamRate ?? 0) : '—', mono: true },
              { label: 'Measured', value: stamp(campaign.stats?.lastCalculatedAt), mono: true },
            ],
          },
        ],
        actions: [
          ...(campaign.status === 'SENT' || campaign.status === 'SENDING'
            ? []
            : [
                {
                  label: 'Edit campaign…',
                  shortcut: '⌘⏎',
                  command: form('campaign.edit', {
                    recordId: campaign.id,
                    title: campaign.name,
                    values: {
          name: campaign.name,
          subject: campaign.subject,
          previewText: textValue(campaign.previewText),
          templateId: campaign.templateId,
          listId: textValue(campaign.listId),
          fromName: textValue(campaign.fromName),
          fromEmail: textValue(campaign.fromEmail),
          scheduledAt: instantValue(campaign.scheduledAt),
          trackOpens: campaign.trackOpens,
          trackClicks: campaign.trackClicks,
          notes: textValue(campaign.notes),
        },
                  }),
                },
              ]),
          { label: 'New campaign…', shortcut: '⌘N', command: form('campaign.create') },
          ...(campaign.status === 'SCHEDULED' || campaign.status === 'SENDING'
            ? [
                {
                  label: 'Pause sending',
                  shortcut: '⌘⇧P',
                  command: write('campaign.pause', campaign.id, {
                    confirm: `Pause ${campaign.name}? Anything already sent has gone.`,
                  }),
                },
              ]
            : []),
          ...(campaign.status === 'PAUSED'
            ? [{ label: 'Resume', shortcut: '⌘⇧P', command: write('campaign.resume', campaign.id) }]
            : []),
          // Sending is done from the campaign page, where the audience is
          // previewed and a test send is offered first.
          { label: 'Review & send…', command: link(`/admin/email-campaigns/${campaign.id}`), shortcut: '⌘S' },
          { label: 'Send log', command: page('email.logs'), shortcut: '⌘L' },
          { label: 'Lists & subscribers', command: page('email.lists'), shortcut: '⌘U' },
          ...(campaign.status === 'SENT' || campaign.status === 'SENDING'
            ? []
            : [
                {
                  label: 'Delete campaign',
                  danger: true,
                  command: write('campaign.delete', campaign.id, {
                    confirm: `Delete ${campaign.name}? It has not gone out, so nothing is lost but the draft.`,
                    danger: true,
                  }),
                },
              ]),
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} campaigns`),
      text(''),
      text(''),
      text(count(recipients), { right: true, strong: true }),
      text(''),
      text(''),
      text(''),
    ],
  }
}

// ---------------------------------------------------------------------------
// Social
// ---------------------------------------------------------------------------

const SOCIAL_FILTERS = ['All posts', 'Scheduled', 'Published', 'Drafts']
const SOCIAL_FILTER_STATUSES = ['', 'SCHEDULED', 'PUBLISHED', 'DRAFT']

const SOCIAL_TONE: Record<string, Tone> = {
  DRAFT: 'muted',
  SCHEDULED: 'warn',
  PUBLISHED: 'good',
  FAILED: 'bad',
}

async function loadSocial(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const posts = await safe(
    () =>
      prisma.socialMediaPost.findMany({
        orderBy: { createdAt: 'desc' },
        take: list.limit,
        include: {
          media: { select: { id: true } },
          publishes: { include: { account: { select: { accountName: true, platform: true } } } },
        },
      }),
    [],
  )

  const columns: Column[] = [
    { label: 'Post', width: 'minmax(0,1.9fr)' },
    { label: 'Channel', width: 'minmax(0,1fr)' },
    { label: 'Scheduled', width: '124px' },
    { label: 'Reach', width: '80px', right: true },
    { label: 'Eng.', width: '68px', right: true },
    { label: 'Clicks', width: '68px', right: true },
    { label: 'Status', width: '108px' },
  ]

  let reachTotal = 0
  let clickTotal = 0

  const rows: Row[] = posts.map((post) => {
    const reach = post.publishes.reduce((sum, entry) => sum + entry.reach, 0)
    const clicks = post.publishes.reduce((sum, entry) => sum + entry.clicks, 0)
    const interactions = post.publishes.reduce(
      (sum, entry) => sum + entry.likes + entry.comments + entry.shares,
      0,
    )
    reachTotal += reach
    clickTotal += clicks

    const engagement = reach > 0 ? (interactions / reach) * 100 : 0
    const channels = post.platforms.map(humanise).join(', ') || '—'
    const when = post.publishedAt ?? post.scheduledAt
    const headline = excerpt(post.content, 70)

    return {
      id: post.id,
      open:
        post.status === 'PUBLISHED'
          ? undefined
          : form('social.edit', { recordId: post.id, title: headline, values: {
          content: post.content,
          platforms: [...post.platforms],
          linkUrl: textValue(post.linkUrl),
          hashtags: post.hashtags.join(', '),
          scheduledAt: instantValue(post.scheduledAt),
          status: post.status,
        }, }),
      search: `${post.content} ${channels} ${post.status}`,
      buckets: bucketsFor(SOCIAL_FILTER_STATUSES, post.status),
      cells: [
        text(headline, { strong: true }),
        text(channels, { dim: true }),
        text(when ? stamp(when) : '—', { mono: true, dim: true }),
        text(reach ? count(reach) : '—', { mono: true, right: true }),
        text(reach ? percent(engagement) : '—', { mono: true, right: true, tone: engagement >= 5 ? 'good' : undefined }),
        text(clicks ? count(clicks) : '—', { mono: true, right: true }),
        statusCell(humanise(post.status), SOCIAL_TONE[post.status] ?? 'muted'),
      ],
      inspector: {
        title: headline,
        tag: humanise(post.status),
        tagTone: SOCIAL_TONE[post.status] ?? 'muted',
        groups: [
          {
            label: 'POST',
            fields: [
              { label: 'Channels', value: channels },
              { label: 'Scheduled', value: stamp(post.scheduledAt), mono: true },
              { label: 'Published', value: stamp(post.publishedAt), mono: true },
              { label: 'Link', value: post.linkUrl ?? '—', wrap: true },
              { label: 'Media', value: post.media.length ? `${count(post.media.length)} attached` : 'None' },
              { label: 'Hashtags', value: post.hashtags.join(' ') || '—', wrap: true },
            ],
          },
          {
            label: 'PERFORMANCE',
            fields: [
              { label: 'Reach', value: reach ? count(reach) : '—', mono: true, strong: true },
              { label: 'Interactions', value: interactions ? count(interactions) : '—', mono: true },
              { label: 'Engagement', value: reach ? percent(engagement) : '—', mono: true },
              { label: 'Clicks', value: clicks ? count(clicks) : '—', mono: true },
            ],
          },
          {
            label: 'BODY',
            fields: [{ label: 'Text', value: excerpt(post.content, 400), wrap: true }],
          },
          ...(post.publishes.length
            ? [
                {
                  label: 'ACCOUNTS',
                  lines: post.publishes.map((entry) => ({
                    name: entry.account.accountName,
                    qty: humanise(entry.status),
                    amount: entry.reach ? count(entry.reach) : '—',
                  })),
                },
              ]
            : []),
        ],
        actions: [
          ...(post.status === 'PUBLISHED'
            ? []
            : [
                {
                  label: 'Edit post…',
                  shortcut: '⌘⏎',
                  command: form('social.edit', {
                    recordId: post.id,
                    title: headline,
                    values: {
          content: post.content,
          platforms: [...post.platforms],
          linkUrl: textValue(post.linkUrl),
          hashtags: post.hashtags.join(', '),
          scheduledAt: instantValue(post.scheduledAt),
          status: post.status,
        },
                  }),
                },
              ]),
          { label: 'New post…', shortcut: '⌘N', command: form('social.create') },
          // Publishing goes through the social page, which holds the connected
          // accounts and the per-platform previews.
          { label: 'Connected accounts', command: page('social.accounts'), shortcut: '⌘S' },
          { label: 'Reach', command: page('social.analytics'), shortcut: '⌘⇧A' },
          { label: 'Product feeds', command: page('social.feeds'), shortcut: '⌘F' },
          ...(post.status === 'PUBLISHED'
            ? []
            : [
                {
                  label: 'Delete post',
                  danger: true,
                  command: write('social.delete', post.id, {
                    confirm: 'Delete this post? It has not gone out.',
                    danger: true,
                  }),
                },
              ]),
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} posts`),
      text(''),
      text(''),
      text(reachTotal ? count(reachTotal) : '', { right: true, strong: true }),
      text(''),
      text(clickTotal ? count(clickTotal) : '', { right: true }),
      text(''),
    ],
  }
}

// ---------------------------------------------------------------------------
// Content & blog
// ---------------------------------------------------------------------------

const CONTENT_FILTERS = ['Everything', 'Published', 'Scheduled', 'Drafts']
const CONTENT_FILTER_STATUSES = ['', 'PUBLISHED', 'SCHEDULED', 'DRAFT']

const CONTENT_TONE: Record<string, Tone> = {
  DRAFT: 'muted',
  SCHEDULED: 'warn',
  PUBLISHED: 'good',
  ARCHIVED: 'muted',
}

/** The character budgets `lib/blog/schemas.ts` enforces, restated for the readout. */
const SEO_TITLE_MAX = 60
const SEO_DESCRIPTION_MAX = 160

async function loadContent(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  // Pages, banners and FAQs are edited through `/admin/content` but are not one
  // queryable list, so this table is the blog — the content the schema models as
  // rows. The other views stay one ⌘K away.
  const posts = await safe(
    () =>
      prisma.blogPost.findMany({
        orderBy: { updatedAt: 'desc' },
        take: list.limit,
        include: {
          author: { select: { name: true, email: true } },
          category: { select: { name: true } },
          series: { select: { name: true } },
          crosspost: { select: { id: true } },
        },
      }),
    [],
  )

  const columns: Column[] = [
    { label: 'Title', width: 'minmax(0,1.9fr)' },
    { label: 'Category', width: 'minmax(0,0.9fr)' },
    { label: 'URL', width: 'minmax(0,1.2fr)' },
    { label: 'Author', width: 'minmax(0,0.9fr)' },
    { label: 'Status', width: '108px' },
    { label: 'Updated', width: '92px' },
  ]

  let published = 0

  const rows: Row[] = posts.map((post) => {
    if (post.status === 'PUBLISHED') published += 1

    // The storefront's blog is the Heat Index; `/blog` is not a route.
    const url = `/heat-index/${post.slug}`
    const seoTitle = post.seoTitle ?? post.title
    const seoDescription = post.seoDescription ?? post.excerpt

    return {
      id: post.id,
      open: form('post.edit', { recordId: post.id, title: post.title, values: {
          title: post.title,
          slug: post.slug,
          categoryId: textValue(post.categoryId),
          subtitle: textValue(post.subtitle),
          excerpt: post.excerpt,
          content: post.content,
          status: post.status,
          layout: post.layout,
          publishedAt: instantValue(post.publishedAt),
          scheduledFor: instantValue(post.scheduledFor),
          featured: post.featured,
          readingMinutes: numberValue(post.readingMinutes),
          coverImage: textValue(post.coverImage),
          tags: post.tags.join(', '),
          seoTitle: textValue(post.seoTitle),
          seoDescription: textValue(post.seoDescription),
        }, }),
      search: `${post.title} ${post.slug} ${post.category?.name ?? ''} ${post.tags.join(' ')}`,
      buckets: bucketsFor(CONTENT_FILTER_STATUSES, post.status),
      cells: [
        text(post.title, { strong: true }),
        text(post.category?.name ?? '—', { dim: true }),
        text(url, { mono: true, dim: true }),
        text(post.author ? personName(post.author) : '—', { dim: true }),
        statusCell(humanise(post.status), CONTENT_TONE[post.status] ?? 'muted'),
        text(shortDate(post.updatedAt), { mono: true, dim: true }),
      ],
      inspector: {
        title: post.title,
        tag: humanise(post.status),
        tagTone: CONTENT_TONE[post.status] ?? 'muted',
        groups: [
          {
            label: 'CONTENT',
            fields: [
              { label: 'URL', value: url, mono: true, wrap: true },
              { label: 'Category', value: post.category?.name ?? '—' },
              { label: 'Series', value: post.series?.name ?? '—' },
              { label: 'Author', value: post.author ? personName(post.author) : '—' },
              { label: 'Reading time', value: `${count(post.readingMinutes)} min` },
              { label: 'Featured', value: post.featured ? 'Yes' : 'No' },
              { label: 'Published', value: stamp(post.publishedAt), mono: true },
              { label: 'Scheduled', value: stamp(post.scheduledFor), mono: true },
            ],
          },
          {
            // Length is what the blog schema rejects a save over, so it is the
            // number worth showing rather than the text itself.
            label: 'SEO',
            fields: [
              {
                label: 'Title tag',
                value: `${count(seoTitle.length)} / ${SEO_TITLE_MAX} chars`,
                mono: true,
              },
              {
                label: 'Meta description',
                value: `${count(seoDescription.length)} / ${SEO_DESCRIPTION_MAX} chars`,
                mono: true,
              },
              { label: 'Tags', value: post.tags.join(', ') || '—', wrap: true },
              { label: 'Cover image', value: post.coverImage ? 'Set' : '—' },
              { label: 'Cross-posted', value: post.crosspost ? 'Yes' : 'No' },
            ],
          },
          { label: 'EXCERPT', fields: [{ label: 'Text', value: excerpt(post.excerpt, 400), wrap: true }] },
        ],
        actions: [
          {
            label: 'Edit post…',
            shortcut: '⌘⏎',
            command: form('post.edit', {
              recordId: post.id,
              title: post.title,
              values: {
          title: post.title,
          slug: post.slug,
          categoryId: textValue(post.categoryId),
          subtitle: textValue(post.subtitle),
          excerpt: post.excerpt,
          content: post.content,
          status: post.status,
          layout: post.layout,
          publishedAt: instantValue(post.publishedAt),
          scheduledFor: instantValue(post.scheduledFor),
          featured: post.featured,
          readingMinutes: numberValue(post.readingMinutes),
          coverImage: textValue(post.coverImage),
          tags: post.tags.join(', '),
          seoTitle: textValue(post.seoTitle),
          seoDescription: textValue(post.seoDescription),
        },
            }),
          },
          { label: 'New post…', shortcut: '⌘N', command: form('post.create') },
          ...(post.status === 'PUBLISHED'
            ? []
            : [
                {
                  label: 'Publish now',
                  shortcut: '⌘⇧P',
                  command: write('post.publish', post.id, {
                    // The sitemap picks the URL up from the database; Search
                    // Console still has to be told by a person.
                    confirm: `Publish “${post.title}” to ${url}? Afterwards, run URL Inspection on it in Search Console.`,
                  }),
                },
              ]),
          { label: 'View on storefront…', command: link(url), shortcut: '⌘O' },
          { label: 'Pages', command: page('content.pages'), shortcut: '⌘⇧P' },
          { label: 'SEO', command: page('content.seo'), shortcut: '⌘S' },
          {
            label: 'Delete post',
            danger: true,
            command: write('post.delete', post.id, {
              confirm: `Delete “${post.title}”? ${url} will start returning a 404 — redirect it if it has been indexed.`,
              danger: true,
            }),
          },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} items`),
      text(''),
      text(''),
      text(''),
      text(published ? `${count(published)} published` : '', { tone: 'good' }),
      text(''),
    ],
  }
}

// ---------------------------------------------------------------------------
// Lead generation
// ---------------------------------------------------------------------------

const LEAD_FILTERS = ['All leads', 'Scraped', 'Contact found', 'Emailed']
const LEAD_FILTER_STATUSES = ['', 'SCRAPED', 'CONTACT_FOUND', 'EMAIL_SENT']

const LEAD_TONE: Record<string, Tone> = {
  SCRAPED: 'muted',
  CONTACT_FOUND: 'warn',
  EMAIL_SENT: 'good',
  EMAIL_FAILED: 'bad',
}

async function loadLeads(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const leads = await safe(
    () =>
      prisma.lead.findMany({
        orderBy: { createdAt: 'desc' },
        take: list.limit,
        include: { campaign: { select: { id: true, name: true, leadType: true } } },
      }),
    [],
  )

  const columns: Column[] = [
    { label: 'Business', width: 'minmax(0,1.6fr)' },
    { label: 'Location', width: 'minmax(0,1fr)' },
    { label: 'Category', width: 'minmax(0,1fr)' },
    { label: 'Rating', width: '84px', right: true },
    { label: 'Campaign', width: 'minmax(0,1fr)' },
    { label: 'Status', width: '126px' },
  ]

  let withEmail = 0

  const rows: Row[] = leads.map((lead) => {
    if (lead.email) withEmail += 1

    const business = lead.businessName ?? lead.schoolName
    const category = lead.businessCategory ?? lead.sport ?? humanise(lead.campaign.leadType)
    const location = place(lead)

    return {
      id: lead.id,
      open: form('lead.edit', { recordId: lead.id, title: lead.schoolName, values: {
          schoolName: lead.schoolName,
          contactName: textValue(lead.contactName),
          title: textValue(lead.title),
          email: textValue(lead.email),
          phone: textValue(lead.phone),
          city: textValue(lead.city),
          state: textValue(lead.state),
          website: textValue(lead.website),
          status: lead.status,
        }, }),
      search: `${business} ${location} ${category} ${lead.email ?? ''} ${lead.campaign.name}`,
      buckets: bucketsFor(LEAD_FILTER_STATUSES, lead.status),
      cells: [
        text(business, { strong: true }),
        text(location, { dim: true }),
        text(category, { dim: true }),
        text(lead.rating ? lead.rating.toFixed(1) : '—', { mono: true, right: true }),
        text(lead.campaign.name, { dim: true }),
        statusCell(humanise(lead.status), LEAD_TONE[lead.status] ?? 'muted'),
      ],
      inspector: {
        title: business,
        tag: humanise(lead.status),
        tagTone: LEAD_TONE[lead.status] ?? 'muted',
        groups: [
          {
            label: 'LEAD',
            fields: [
              { label: 'Location', value: location },
              { label: 'Category', value: category },
              { label: 'Contact', value: lead.contactName ?? '—' },
              { label: 'Title', value: lead.title ?? '—' },
              { label: 'Email', value: lead.email ?? '—', mono: true, wrap: true },
              { label: 'Phone', value: lead.phone ?? '—', mono: true },
              { label: 'Website', value: lead.website ?? lead.schoolUrl ?? '—', wrap: true },
              { label: 'Address', value: lead.address ?? '—', wrap: true },
            ],
          },
          {
            label: 'SIGNALS',
            fields: [
              { label: 'Google rating', value: lead.rating ? `${lead.rating.toFixed(1)} / 5` : '—', mono: true },
              { label: 'Reviews', value: lead.reviewCount ? count(lead.reviewCount) : '—', mono: true },
              { label: 'District', value: lead.district ?? '—' },
              { label: 'Found', value: shortDate(lead.createdAt), mono: true },
              { label: 'Emailed', value: stamp(lead.sentAt), mono: true },
              ...(lead.errorMessage ? [{ label: 'Error', value: lead.errorMessage, wrap: true }] : []),
            ],
          },
          {
            label: 'CAMPAIGN',
            fields: [
              { label: 'Name', value: lead.campaign.name },
              { label: 'Type', value: humanise(lead.campaign.leadType) },
            ],
          },
        ],
        actions: [
          {
            label: 'Edit lead…',
            shortcut: '⌘⏎',
            command: form('lead.edit', {
              recordId: lead.id,
              title: lead.schoolName,
              values: {
          schoolName: lead.schoolName,
          contactName: textValue(lead.contactName),
          title: textValue(lead.title),
          email: textValue(lead.email),
          phone: textValue(lead.phone),
          city: textValue(lead.city),
          state: textValue(lead.state),
          website: textValue(lead.website),
          status: lead.status,
        },
            }),
          },
          { label: 'New campaign…', shortcut: '⌘N', command: form('leadCampaign.create') },
          // Scraping and sending are run from the campaign page, which streams
          // progress and holds the throttles.
          { label: 'Run this campaign…', command: link(`/admin/lead-generation/${lead.campaign.id}`), shortcut: '⌘⇧B' },
          ...(lead.googleMapsUrl
            ? [{ label: 'Open in Google Maps…', command: link(lead.googleMapsUrl), shortcut: '⌘O' }]
            : []),
          {
            label: 'Delete lead',
            danger: true,
            command: write('lead.delete', lead.id, {
              confirm: `Delete ${lead.schoolName} from ${lead.campaign.name}?`,
              danger: true,
            }),
          },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} leads`),
      text(''),
      text(''),
      text(''),
      text(withEmail ? `${count(withEmail)} with an email` : '', { tone: 'good' }),
      text(''),
    ],
  }
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

const REVIEW_FILTERS = ['All reviews', 'Pending', 'Approved', 'Rejected']
const REVIEW_FILTER_STATUSES = ['', 'PENDING', 'APPROVED', 'REJECTED']

const REVIEW_TONE: Record<string, Tone> = {
  PENDING: 'warn',
  APPROVED: 'good',
  REJECTED: 'bad',
}

async function loadReviews(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const reviews = await safe(
    () =>
      prisma.review.findMany({
        orderBy: { createdAt: 'desc' },
        take: list.limit,
        include: {
          product: { select: { id: true, name: true } },
          user: { select: { name: true, email: true } },
        },
      }),
    [],
  )

  const columns: Column[] = [
    { label: 'Product', width: 'minmax(0,1.2fr)' },
    { label: 'Author', width: 'minmax(0,1fr)' },
    { label: 'Rating', width: '96px' },
    { label: 'Excerpt', width: 'minmax(0,1.9fr)' },
    { label: 'Date', width: '92px' },
    { label: 'Status', width: '108px' },
  ]

  let ratingSum = 0
  let pending = 0

  const rows: Row[] = reviews.map((review) => {
    ratingSum += review.rating
    if (review.status === 'PENDING') pending += 1

    const author = personName(review.user)
    const body = review.comment ?? review.title ?? ''

    return {
      id: review.id,
      open: form('review.edit', { recordId: review.id, title: `${review.product.name} · ${stars(review.rating)}`, values: {
          status: review.status,
          rating: numberValue(review.rating),
          title: textValue(review.title),
          comment: textValue(review.comment),
        }, }),
      search: `${review.product.name} ${author} ${body}`,
      buckets: bucketsFor(REVIEW_FILTER_STATUSES, review.status),
      cells: [
        text(review.product.name, { strong: true }),
        text(author, { dim: true }),
        text(stars(review.rating), { tone: review.rating >= 4 ? 'accent' : 'bad' }),
        text(excerpt(body, 80), { dim: true }),
        text(shortDate(review.createdAt), { mono: true, dim: true }),
        statusCell(humanise(review.status), REVIEW_TONE[review.status] ?? 'muted'),
      ],
      inspector: {
        title: `${review.product.name} — ${author}`,
        tag: `${review.rating} / 5`,
        tagTone: review.rating >= 4 ? 'good' : 'bad',
        groups: [
          {
            label: 'REVIEW',
            fields: [
              { label: 'Product', value: review.product.name },
              { label: 'Author', value: author },
              { label: 'Email', value: review.user.email, mono: true, wrap: true },
              { label: 'Rating', value: `${review.rating} / 5`, mono: true, strong: true },
              { label: 'Verified buyer', value: review.isVerified ? 'Yes' : 'No' },
              { label: 'Submitted', value: stamp(review.createdAt), mono: true },
              { label: 'Moderated', value: stamp(review.moderatedAt), mono: true },
            ],
          },
          {
            label: 'BODY',
            fields: [
              ...(review.title ? [{ label: 'Title', value: review.title, wrap: true }] : []),
              { label: 'Text', value: excerpt(review.comment, 500), wrap: true },
            ],
          },
        ],
        actions: [
          {
            label: 'Edit review…',
            shortcut: '⌘⏎',
            command: form('review.edit', {
              recordId: review.id,
              title: `${review.product.name} · ${stars(review.rating)}`,
              values: {
          status: review.status,
          rating: numberValue(review.rating),
          title: textValue(review.title),
          comment: textValue(review.comment),
        },
            }),
          },
          ...(review.status === 'APPROVED'
            ? []
            : [{ label: 'Approve', shortcut: '⌘⇧A', command: write('review.approve', review.id) }]),
          ...(review.status === 'REJECTED'
            ? []
            : [
                {
                  label: 'Reject',
                  shortcut: '⌘⇧B',
                  command: write('review.reject', review.id, {
                    confirm: 'Reject this review? It stops showing on the product page.',
                  }),
                },
              ]),
          { label: 'Products', command: jump('products'), shortcut: '⌘O' },
          { label: 'Review forms', command: page('reviews.forms'), shortcut: '⌘F' },
          {
            label: 'Delete review',
            danger: true,
            command: write('review.delete', review.id, {
              confirm: 'Delete this review outright? Rejecting it hides it without losing what was written.',
              danger: true,
            }),
          },
        ],
      },
    }
  })

  const average = rows.length ? ratingSum / rows.length : 0

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} reviews`),
      text(''),
      text(rows.length ? `${average.toFixed(2)} avg` : ''),
      text(''),
      text(''),
      text(pending ? `${count(pending)} pending` : '', { tone: 'warn' }),
    ],
  }
}

// ---------------------------------------------------------------------------
// Media & docs
// ---------------------------------------------------------------------------

const MEDIA_FILTERS = ['Everything', 'Photos', 'Documents', 'Other']

/** Which filter chip a file belongs to, from its MIME type. */
function mediaBucket(mimeType: string): { kind: string; bucket: number } {
  if (mimeType.startsWith('image/')) return { kind: 'Photo', bucket: 1 }
  if (mimeType === 'application/pdf') return { kind: 'PDF', bucket: 2 }
  if (mimeType.startsWith('text/') || mimeType.includes('spreadsheet') || mimeType.includes('document')) {
    return { kind: 'Document', bucket: 2 }
  }
  if (mimeType.startsWith('video/')) return { kind: 'Video', bucket: 3 }
  return { kind: humanise(mimeType.split('/').pop() ?? 'File'), bucket: 3 }
}

async function loadMedia(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const files = await safe(
    () =>
      prisma.media.findMany({
        orderBy: { createdAt: 'desc' },
        take: list.limit,
        include: { _count: { select: { socialMediaPosts: true, mediaTags: true } } },
      }),
    [],
  )

  const columns: Column[] = [
    { label: 'File', width: 'minmax(0,2fr)' },
    { label: 'Kind', width: '108px' },
    { label: 'Size', width: '88px', right: true },
    { label: 'Dimensions', width: '116px', right: true },
    { label: 'Alt text', width: '92px' },
    { label: 'Added', width: '92px' },
  ]

  let stored = 0
  let missingAlt = 0

  const rows: Row[] = files.map((file) => {
    stored += file.fileSize
    const { kind, bucket } = mediaBucket(file.mimeType)
    const isImage = file.mimeType.startsWith('image/')
    // Alt text only matters for images; a PDF has nothing to describe.
    if (isImage && !file.alt) missingAlt += 1

    const dimensions = file.width && file.height ? `${file.width}×${file.height}` : '—'

    return {
      id: file.id,
      open: form('media.edit', { recordId: file.id, title: file.filename, values: {
          filename: file.filename,
          alt: textValue(file.alt),
          caption: textValue(file.caption),
        }, }),
      search: `${file.filename} ${kind} ${file.alt ?? ''}`,
      buckets: [0, bucket],
      cells: [
        text(file.filename, { mono: true, strong: true }),
        text(kind, { dim: true }),
        text(bytes(file.fileSize), { mono: true, right: true }),
        text(dimensions, { mono: true, right: true, dim: true }),
        isImage
          ? statusCell(file.alt ? 'Set' : 'Missing', file.alt ? 'good' : 'warn')
          : text('—', { dim: true }),
        text(shortDate(file.createdAt), { mono: true, dim: true }),
      ],
      inspector: {
        title: file.filename,
        tag: kind,
        tagTone: 'accent',
        groups: [
          {
            label: 'FILE',
            fields: [
              { label: 'Kind', value: kind },
              { label: 'MIME type', value: file.mimeType, mono: true },
              { label: 'Size', value: bytes(file.fileSize), mono: true },
              { label: 'Dimensions', value: dimensions, mono: true },
              { label: 'Added', value: stamp(file.createdAt), mono: true },
            ],
          },
          {
            label: 'USAGE',
            fields: [
              { label: 'Social posts', value: count(file._count.socialMediaPosts), mono: true },
              { label: 'Tags', value: count(file._count.mediaTags), mono: true },
              { label: 'Alt text', value: file.alt ?? '—', wrap: true },
              { label: 'Caption', value: file.caption ?? '—', wrap: true },
              { label: 'URL', value: file.url, mono: true, wrap: true },
            ],
          },
        ],
        actions: [
          {
            label: 'Edit file…',
            shortcut: '⌘⏎',
            command: form('media.edit', {
              recordId: file.id,
              title: file.filename,
              values: {
          filename: file.filename,
          alt: textValue(file.alt),
          caption: textValue(file.caption),
        },
            }),
          },
          { label: 'Add by URL…', shortcut: '⌘N', command: form('media.upload') },
          // Drag-and-drop upload lives in the library, which owns the
          // UploadThing widget and its progress.
          { label: 'Upload files…', command: link('/admin/media'), shortcut: '⌘U' },
          { label: 'Open file…', command: link(file.url), shortcut: '⌘O' },
          { label: 'Documents archive', command: page('media.documents'), shortcut: '⌘D' },
          {
            label: 'Delete file',
            danger: true,
            command: write('media.delete', file.id, {
              confirm: `Delete ${file.filename} from the library? Anything still pointing at it will break.`,
              danger: true,
            }),
          },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} files`),
      text(''),
      text(bytes(stored), { right: true, strong: true }),
      text(''),
      text(missingAlt ? `${count(missingAlt)} need alt text` : '', { tone: 'warn' }),
      text(''),
    ],
  }
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

const MESSAGE_FILTERS = ['All', 'Conversations', 'Web form', 'Live chat', 'Open']

const CHAT_TONE: Record<string, Tone> = {
  WAITING: 'warn',
  ACTIVE: 'good',
  CLOSED: 'muted',
  OFFLINE: 'muted',
}

async function loadMessages(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  // Three tables feed one inbox. `Conversation` is the support inbox the web
  // panel at /admin/messages shows; `ContactSubmission` is the marketing site's
  // contact form; `ChatThread` is the live-chat handoff. They are separate
  // tables but one job, so they are merged and sorted together rather than
  // leaving the operator to switch between three lists.
  const [conversations, submissions, threads] = await Promise.all([
    safe(
      () =>
        prisma.conversation.findMany({
          orderBy: { updatedAt: 'desc' },
          take: list.limit,
          include: {
            user: { select: { name: true, email: true } },
            messages: { orderBy: { createdAt: 'desc' }, take: 1 },
            _count: { select: { messages: true } },
          },
        }),
      [],
    ),
    safe(
      () => prisma.contactSubmission.findMany({ orderBy: { createdAt: 'desc' }, take: list.limit }),
      [],
    ),
    safe(
      () =>
        prisma.chatThread.findMany({
          orderBy: { lastMessageAt: 'desc' },
          take: list.limit,
          include: { _count: { select: { messages: true } } },
        }),
      [],
    ),
  ])

  const columns: Column[] = [
    { label: 'From', width: 'minmax(0,1.2fr)' },
    { label: 'Subject', width: 'minmax(0,2fr)' },
    { label: 'Channel', width: '112px' },
    { label: 'Received', width: '132px' },
    { label: 'Status', width: '112px' },
  ]

  const conversationRows: (Row & { at: Date })[] = conversations.map((conversation) => {
    const who = personName({
      name: conversation.user?.name,
      email: conversation.user?.email ?? conversation.email,
    })
    const open = conversation.status === 'OPEN'
    const latest = conversation.messages[0]

    return {
      at: conversation.updatedAt,
      id: `conversation-${conversation.id}`,
      open: form('conversation.edit', {
        recordId: conversation.id,
        title: conversation.subject ?? `Conversation with ${who}`,
        values: { subject: textValue(conversation.subject), status: conversation.status },
      }),
      search: `${who} ${conversation.email ?? ''} ${conversation.subject ?? ''}`,
      buckets: [0, 1, ...(open ? [4] : [])],
      cells: [
        text(who, { strong: true }),
        text(excerpt(conversation.subject ?? latest?.body, 80), { dim: true }),
        text('Conversation', { dim: true, dot: true, tone: 'warn' }),
        text(stamp(conversation.updatedAt), { mono: true, dim: true }),
        statusCell(humanise(conversation.status), open ? 'warn' : 'muted'),
      ],
      inspector: {
        title: who,
        tag: humanise(conversation.status),
        tagTone: open ? 'warn' : 'muted',
        groups: [
          {
            label: 'CONVERSATION',
            fields: [
              { label: 'From', value: who },
              { label: 'Email', value: conversation.user?.email ?? conversation.email ?? '—', mono: true, wrap: true },
              { label: 'Subject', value: conversation.subject ?? '—', wrap: true },
              { label: 'Messages', value: count(conversation._count.messages), mono: true },
              { label: 'Opened', value: stamp(conversation.createdAt), mono: true },
              { label: 'Last activity', value: stamp(conversation.updatedAt), mono: true },
              { label: 'Account', value: conversation.userId ? 'Registered' : 'Guest' },
            ],
          },
          ...(latest
            ? [
                {
                  label: 'LATEST MESSAGE',
                  fields: [
                    { label: humanise(latest.senderType), value: excerpt(latest.body, 400), wrap: true },
                  ],
                },
              ]
            : []),
        ],
        actions: [
          // Replying needs the thread itself, which the inbox page draws.
          { label: 'Open & reply…', command: link(`/admin/messages/${conversation.id}`), shortcut: '⌘⏎' },
          {
            label: 'Edit conversation…',
            shortcut: '⌘E',
            command: form('conversation.edit', {
              recordId: conversation.id,
              title: conversation.subject ?? `Conversation with ${who}`,
              values: { subject: textValue(conversation.subject), status: conversation.status },
            }),
          },
          ...(conversation.status === 'CLOSED'
            ? [{ label: 'Reopen', shortcut: '⌘⇧B', command: write('conversation.reopen', conversation.id) }]
            : [{ label: 'Close', shortcut: '⌘⇧W', command: write('conversation.close', conversation.id) }]),
          { label: 'Notifications', command: page('messages.notifications'), shortcut: '⌘N' },
        ],
      },
    }
  })

  const formRows: (Row & { at: Date })[] = submissions.map((entry) => ({
    at: entry.createdAt,
    id: `contact-${entry.id}`,
    open: jump('messages'),
    search: `${entry.name} ${entry.email} ${entry.subject} ${entry.message}`,
    buckets: [0, 2],
    cells: [
      text(entry.name, { strong: true }),
      text(excerpt(entry.subject, 80), { dim: true }),
      text('Web form', { dim: true, dot: true, tone: 'accent' }),
      text(stamp(entry.createdAt), { mono: true, dim: true }),
      statusCell('Received', 'good'),
    ],
    inspector: {
      title: entry.name,
      tag: 'Web form',
      tagTone: 'accent',
      groups: [
        {
          label: 'MESSAGE',
          fields: [
            { label: 'From', value: entry.name },
            { label: 'Email', value: entry.email, mono: true, wrap: true },
            { label: 'Subject', value: entry.subject, wrap: true },
            { label: 'Received', value: stamp(entry.createdAt), mono: true },
          ],
        },
        { label: 'BODY', fields: [{ label: 'Text', value: excerpt(entry.message, 500), wrap: true }] },
      ],
      actions: [
        { label: 'Inbox', command: jump('messages'), shortcut: '⌘⏎' },
        { label: 'Notifications', command: page('messages.notifications'), shortcut: '⌘N' },
      ],
    },
  }))

  const chatRows: (Row & { at: Date })[] = threads.map((thread) => {
    const who = thread.customerName ?? thread.customerEmail ?? 'Anonymous'
    const open = thread.status === 'WAITING' || thread.status === 'ACTIVE'

    return {
      at: thread.lastMessageAt,
      id: `chat-${thread.id}`,
      open: form('chat.edit', {
        recordId: thread.id,
        title: `Live chat · ${who}`,
        values: {
          status: thread.status,
          assignedAdminId: textValue(thread.assignedAdminId),
          closedReason: textValue(thread.closedReason),
        },
      }),
      search: `${who} ${thread.customerEmail ?? ''} live chat`,
      buckets: [0, 3, ...(open ? [4] : [])],
      cells: [
        text(who, { strong: true }),
        text(`${count(thread._count.messages)} messages · ${thread.source ?? 'live chat'}`, { dim: true }),
        text('Live chat', { dim: true, dot: true, tone: 'good' }),
        text(stamp(thread.lastMessageAt), { mono: true, dim: true }),
        statusCell(humanise(thread.status), CHAT_TONE[thread.status] ?? 'muted'),
      ],
      inspector: {
        title: who,
        tag: humanise(thread.status),
        tagTone: CHAT_TONE[thread.status] ?? 'muted',
        groups: [
          {
            label: 'THREAD',
            fields: [
              { label: 'From', value: who },
              { label: 'Email', value: thread.customerEmail ?? '—', mono: true, wrap: true },
              { label: 'Source', value: thread.source ?? 'Live chat' },
              { label: 'Messages', value: count(thread._count.messages), mono: true },
              { label: 'Started', value: stamp(thread.startedAt), mono: true },
              { label: 'Last message', value: stamp(thread.lastMessageAt), mono: true },
              { label: 'Assigned', value: thread.assignedAdminId ? 'Yes' : 'Unassigned' },
              { label: 'Closed', value: stamp(thread.closedAt), mono: true },
            ],
          },
        ],
        actions: [
          // The live transcript is a stream, so it stays on its own page.
          { label: 'Open transcript…', command: link(`/admin/messages/live/${thread.id}`), shortcut: '⌘⏎' },
          {
            label: 'Edit thread…',
            shortcut: '⌘E',
            command: form('chat.edit', {
              recordId: thread.id,
              title: `Live chat · ${who}`,
              values: {
                status: thread.status,
                assignedAdminId: textValue(thread.assignedAdminId),
                closedReason: textValue(thread.closedReason),
              },
            }),
          },
          ...(thread.status === 'CLOSED'
            ? []
            : [
                {
                  label: 'Close thread',
                  shortcut: '⌘⇧W',
                  command: write('chat.close', thread.id, { confirm: 'Close this live chat thread?' }),
                },
              ]),
          { label: 'Live chat', command: page('messages.live'), shortcut: '⌘L' },
          { label: 'Notifications', command: page('messages.notifications'), shortcut: '⌘N' },
        ],
      },
    }
  })

  const merged = [...conversationRows, ...formRows, ...chatRows]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, list.limit)

  const open = merged.filter((row) => row.buckets.includes(4)).length
  const rows: Row[] = merged.map(({ at: _at, ...row }) => row)

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} messages`),
      text(''),
      text(''),
      text(''),
      text(open ? `${count(open)} open` : '', { tone: 'warn' }),
    ],
  }
}

// ---------------------------------------------------------------------------
// Users & roles
// ---------------------------------------------------------------------------

const USER_FILTERS = ['All users', 'Developers', 'Admins', 'Staff']
const USER_FILTER_ROLES = ['', 'DEVELOPER', 'ADMIN', 'STAFF']

/** The roles that can reach `/admin`. Portal roles are customers, not staff. */
const STAFF_ROLES = ['DEVELOPER', 'ADMIN', 'STAFF'] as const

const ROLE_TONE: Record<string, Tone> = {
  DEVELOPER: 'accent',
  ADMIN: 'warn',
  STAFF: 'muted',
}

async function loadUsers(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const users = await safe(
    () =>
      prisma.user.findMany({
        where: { role: { in: [...STAFF_ROLES] } },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        take: list.limit,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          phone: true,
          isEmailVerified: true,
          twoFactorEnabledAt: true,
          lastLoginAt: true,
          createdAt: true,
        },
      }),
    [],
  )

  const columns: Column[] = [
    { label: 'Name', width: 'minmax(0,1.2fr)' },
    { label: 'Email', width: 'minmax(0,1.6fr)' },
    { label: 'Role', width: '124px' },
    { label: 'Two-factor', width: '116px' },
    { label: 'Last sign-in', width: '132px' },
    { label: 'Created', width: '92px' },
  ]

  let withTwoFactor = 0

  const rows: Row[] = users.map((user) => {
    const secured = Boolean(user.twoFactorEnabledAt)
    if (secured) withTwoFactor += 1

    return {
      id: user.id,
      open: form('user.edit', { recordId: user.id, title: personName(user), values: {
          name: textValue(user.name),
          email: user.email,
          role: user.role,
          phone: textValue(user.phone),
          isEmailVerified: user.isEmailVerified,
          password: '',
        }, }),
      search: `${personName(user)} ${user.email} ${user.role}`,
      buckets: bucketsFor(USER_FILTER_ROLES, user.role),
      cells: [
        text(personName(user), { strong: true }),
        text(user.email, { mono: true, dim: true }),
        { text: humanise(user.role), dot: true, tone: ROLE_TONE[user.role] ?? 'muted' },
        text(secured ? 'Enabled' : 'Disabled', { tone: secured ? 'good' : 'bad' }),
        text(user.lastLoginAt ? stamp(user.lastLoginAt) : 'Never', {
          mono: true,
          dim: true,
          tone: user.lastLoginAt ? undefined : 'muted',
        }),
        text(shortDate(user.createdAt), { mono: true, dim: true }),
      ],
      inspector: {
        title: personName(user),
        tag: humanise(user.role),
        tagTone: ROLE_TONE[user.role] ?? 'muted',
        groups: [
          {
            label: 'ACCOUNT',
            fields: [
              { label: 'Email', value: user.email, mono: true, wrap: true },
              { label: 'Role', value: humanise(user.role) },
              { label: 'Email verified', value: user.isEmailVerified ? 'Yes' : 'No' },
              { label: 'Created', value: shortDate(user.createdAt), mono: true },
              { label: 'Last sign-in', value: user.lastLoginAt ? stamp(user.lastLoginAt) : 'Never', mono: true },
            ],
          },
          {
            label: 'SECURITY',
            fields: [
              { label: 'Two-factor', value: secured ? 'Enabled' : 'Disabled' },
              { label: 'Enrolled', value: stamp(user.twoFactorEnabledAt), mono: true },
              {
                label: 'Admin access',
                value: user.role === 'DEVELOPER' ? 'Full — developer' : 'Staff panel',
              },
            ],
          },
        ],
        actions: [
          {
            label: 'Edit user…',
            shortcut: '⌘⏎',
            command: form('user.edit', {
              recordId: user.id,
              title: personName(user),
              values: {
          name: textValue(user.name),
          email: user.email,
          role: user.role,
          phone: textValue(user.phone),
          isEmailVerified: user.isEmailVerified,
          password: '',
        },
            }),
          },
          { label: 'New user…', shortcut: '⌘N', command: form('user.create') },
          { label: 'Credential vault', command: page('users.credentials'), shortcut: '⌘⇧V' },
          { label: 'Audit log', command: jump('audit'), shortcut: '⌘L' },
          {
            label: 'Delete user',
            danger: true,
            command: write('user.delete', user.id, {
              confirm: `Delete ${user.email}? Anything they authored keeps their name on it.`,
              danger: true,
            }),
          },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} accounts`),
      text(''),
      text(''),
      text(rows.length ? `${count(withTwoFactor)} with 2FA` : '', {
        tone: withTwoFactor === rows.length ? 'good' : 'warn',
      }),
      text(''),
      text(''),
    ],
  }
}


// ---------------------------------------------------------------------------
// Orders · Returns & RMAs
// ---------------------------------------------------------------------------

const RETURN_FILTERS = ['All returns', 'Open', 'Received', 'Closed']

const RETURN_TONE: Record<string, Tone> = {
  REQUESTED: 'warn',
  APPROVED: 'accent',
  RECEIVED: 'accent',
  COMPLETED: 'good',
  REJECTED: 'bad',
  CANCELLED: 'muted',
}

/** Which chip a return belongs to: still ours to act on, in hand, or done with. */
function returnBuckets(status: string): number[] {
  if (status === 'REQUESTED' || status === 'APPROVED') return [0, 1]
  if (status === 'RECEIVED') return [0, 2]
  return [0, 3]
}

async function loadReturns(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const requests = await safe(
    () =>
      prisma.returnRequest.findMany({
        orderBy: { createdAt: 'desc' },
        take: list.limit,
        include: {
          items: { include: { orderItem: { select: { productName: true, unitPrice: true } } } },
          order: {
            select: {
              id: true,
              orderNumber: true,
              total: true,
              guestEmail: true,
              user: { select: { name: true, email: true } },
              shippingAddress: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
    [],
  )

  const columns: Column[] = [
    { label: 'RMA', width: '132px' },
    { label: 'Order', width: '116px' },
    { label: 'Customer', width: 'minmax(0,1.3fr)' },
    { label: 'Reason', width: 'minmax(0,1fr)' },
    { label: 'Resolution', width: '124px' },
    { label: 'Units', width: '68px', right: true },
    { label: 'Value', width: '92px', right: true },
    { label: 'Status', width: '116px' },
    { label: 'Raised', width: '96px' },
  ]

  let units = 0
  let value = 0

  const rows: Row[] = requests.map((request) => {
    const lineUnits = request.items.reduce((sum, item) => sum + item.quantity, 0)
    const lineValue = request.items.reduce(
      (sum, item) => sum + toNumber(item.orderItem.unitPrice) * item.quantity,
      0,
    )
    units += lineUnits
    value += lineValue

    const customer = personName({
      name: request.order.user?.name,
      firstName: request.order.shippingAddress?.firstName,
      lastName: request.order.shippingAddress?.lastName,
      email: request.order.user?.email ?? request.order.guestEmail,
    })

    const editValues: FormValues = {
      status: request.status,
      resolution: request.resolution,
      reason: request.reason,
      restockingFee: moneyValue(request.restockingFee),
      adminNote: textValue(request.adminNote),
    }

    return {
      id: request.id,
      open: form('return.edit', {
        recordId: request.id,
        title: `Return ${request.rmaNumber}`,
        values: editValues,
      }),
      search: `${request.rmaNumber} ${request.order.orderNumber} ${customer} ${humanise(request.reason)}`,
      buckets: returnBuckets(request.status),
      cells: [
        text(request.rmaNumber, { mono: true, strong: true }),
        text(request.order.orderNumber, { mono: true, dim: true }),
        text(customer),
        text(humanise(request.reason), { dim: true }),
        text(humanise(request.resolution)),
        text(count(lineUnits), { mono: true, right: true }),
        text(money(lineValue), { mono: true, right: true }),
        statusCell(humanise(request.status), RETURN_TONE[request.status] ?? 'neutral'),
        text(shortDate(request.createdAt), { mono: true, dim: true }),
      ],
      inspector: {
        title: request.rmaNumber,
        tag: humanise(request.status),
        tagTone: RETURN_TONE[request.status] ?? 'neutral',
        groups: [
          {
            label: 'RETURN',
            fields: [
              { label: 'Order', value: request.order.orderNumber, mono: true },
              { label: 'Order total', value: money(request.order.total), mono: true },
              { label: 'Customer', value: customer },
              { label: 'Reason', value: humanise(request.reason) },
              { label: 'Resolution', value: humanise(request.resolution) },
              {
                label: 'Restocking fee',
                value: request.restockingFee ? money(request.restockingFee) : '—',
                mono: true,
              },
            ],
          },
          {
            label: 'COMING BACK',
            lines: request.items.map((item) => ({
              name: item.orderItem.productName,
              qty: `×${item.quantity}`,
              amount: money(toNumber(item.orderItem.unitPrice) * item.quantity),
            })),
          },
          {
            label: 'PROGRESS',
            fields: [
              { label: 'Raised', value: stamp(request.createdAt), mono: true },
              { label: 'Approved', value: request.approvedAt ? stamp(request.approvedAt) : '—', mono: true },
              { label: 'Received', value: request.receivedAt ? stamp(request.receivedAt) : '—', mono: true },
              { label: 'Completed', value: request.completedAt ? stamp(request.completedAt) : '—', mono: true },
              { label: 'Note', value: request.adminNote ?? '—', wrap: true },
            ],
          },
        ],
        actions: [
          {
            label: 'Edit return…',
            shortcut: '⌘⏎',
            command: form('return.edit', {
              recordId: request.id,
              title: `Return ${request.rmaNumber}`,
              values: editValues,
            }),
          },
          ...(request.status === 'REQUESTED'
            ? [
                {
                  label: 'Approve',
                  shortcut: '⌘⇧P',
                  command: write('return.approve', request.id, {
                    confirm: `Approve ${request.rmaNumber}? The customer is told to send the jars back.`,
                  }),
                },
                {
                  label: 'Reject',
                  danger: true,
                  command: write('return.reject', request.id, {
                    confirm: `Reject ${request.rmaNumber}?`,
                    danger: true,
                  }),
                },
              ]
            : []),
          ...(request.status === 'APPROVED'
            ? [
                {
                  label: 'Mark received',
                  shortcut: '⌘⇧B',
                  command: write('return.receive', request.id, {
                    confirm: `Mark ${request.rmaNumber} as received? Stock is not put back automatically.`,
                  }),
                },
              ]
            : []),
          ...(request.status === 'RECEIVED'
            ? [
                {
                  // Completing a return is the moment money moves: the refund,
                  // store credit or exchange is issued, eligible jars go back on
                  // the shelf, and `order.returned` fires. COMPLETED is terminal
                  // and cannot be re-driven afterwards, so stamping it here
                  // would strand the customer's refund with no way back. The
                  // settlement lives on the return's own page; this hands over.
                  label: 'Settle & complete…',
                  shortcut: '⌘⇧K',
                  command: link(`/admin/returns/${request.id}`),
                },
              ]
            : []),
          { label: 'Orders', command: jump('orders'), shortcut: '⌘O' },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} returns`),
      text(''),
      text(''),
      text(''),
      text(''),
      text(count(units), { right: true }),
      text(money(value), { right: true, strong: true }),
      text(''),
      text(''),
    ],
  }
}

// ---------------------------------------------------------------------------
// Orders · Shipping labels
// ---------------------------------------------------------------------------

const LABEL_FILTERS = ['All labels', 'In transit', 'Delivered', 'No tracking']

/** EasyPost's `status` is free text, so the tone is decided from what it says. */
function labelTone(status: string | null): Tone {
  if (!status) return 'muted'
  const value = status.toLowerCase()
  if (value.includes('deliver')) return 'good'
  if (value.includes('return') || value.includes('fail') || value.includes('error')) return 'bad'
  if (value.includes('transit') || value.includes('out_for')) return 'accent'
  return 'warn'
}

async function loadShippingLabels(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const labels = await safe(
    () =>
      prisma.shippingLabel.findMany({
        orderBy: { createdAt: 'desc' },
        take: list.limit,
        include: {
          carrier: { select: { name: true } },
          order: {
            select: {
              id: true,
              orderNumber: true,
              guestEmail: true,
              user: { select: { name: true, email: true } },
              shippingAddress: { select: { firstName: true, lastName: true, city: true, state: true } },
            },
          },
        },
      }),
    [],
  )

  const columns: Column[] = [
    { label: 'Tracking', width: 'minmax(0,1.3fr)' },
    { label: 'Order', width: '116px' },
    { label: 'Ship to', width: 'minmax(0,1.2fr)' },
    { label: 'Carrier', width: '116px' },
    { label: 'Service', width: 'minmax(0,1fr)' },
    { label: 'Cost', width: '86px', right: true },
    { label: 'Status', width: '124px' },
    { label: 'Shipped', width: '96px' },
  ]

  let spend = 0

  const rows: Row[] = labels.map((label) => {
    const cost = toNumber(label.cost)
    spend += cost

    const tracking = label.trackingCode ?? label.trackingNumber
    const carrier = label.carrierName ?? label.carrier?.name ?? '—'
    const shipTo = label.order.shippingAddress ? place(label.order.shippingAddress) : '—'
    const customer = personName({
      name: label.order.user?.name,
      firstName: label.order.shippingAddress?.firstName,
      lastName: label.order.shippingAddress?.lastName,
      email: label.order.user?.email ?? label.order.guestEmail,
    })

    const buckets = [0]
    if (!tracking) buckets.push(3)
    else if ((label.status ?? '').toLowerCase().includes('deliver')) buckets.push(2)
    else buckets.push(1)

    return {
      id: label.id,
      open: label.labelUrl ? printLabel(label.labelUrl) : jump('orders'),
      search: `${tracking ?? ''} ${label.order.orderNumber} ${customer} ${carrier}`,
      buckets,
      cells: [
        text(tracking ?? 'No tracking yet', { mono: true, strong: Boolean(tracking), dim: !tracking }),
        text(label.order.orderNumber, { mono: true, dim: true }),
        text(shipTo),
        text(carrier, { dim: true }),
        text(label.serviceName ?? '—', { dim: !label.serviceName }),
        text(cost ? money(cost) : '—', { mono: true, right: true }),
        statusCell(label.status ? humanise(label.status) : 'Created', labelTone(label.status)),
        text(shortDate(label.shipDate ?? label.createdAt), { mono: true, dim: true }),
      ],
      inspector: {
        title: tracking ?? label.order.orderNumber,
        tag: label.status ? humanise(label.status) : 'Created',
        tagTone: labelTone(label.status),
        groups: [
          {
            label: 'SHIPMENT',
            fields: [
              { label: 'Order', value: label.order.orderNumber, mono: true },
              { label: 'Customer', value: customer },
              { label: 'Ship to', value: shipTo },
              { label: 'Carrier', value: carrier },
              { label: 'Service', value: label.serviceName ?? '—' },
              { label: 'Cost', value: cost ? money(cost) : '—', mono: true },
            ],
          },
          {
            label: 'DATES',
            fields: [
              { label: 'Created', value: stamp(label.createdAt), mono: true },
              { label: 'Ship date', value: label.shipDate ? shortDate(label.shipDate) : '—', mono: true },
              {
                label: 'Est. delivery',
                value: label.estimatedDelivery ? shortDate(label.estimatedDelivery) : '—',
                mono: true,
              },
              { label: 'EasyPost id', value: label.easypostShipmentId ?? '—', mono: true, wrap: true },
            ],
          },
        ],
        actions: [
          ...(label.labelUrl
            ? [{ label: 'Print label', shortcut: '⌘I', command: printLabel(label.labelUrl) }]
            : []),
          { label: 'Orders', command: jump('orders'), shortcut: '⌘O' },
          { label: 'Returns', command: page('orders.returns'), shortcut: '⌘⇧B' },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} labels`),
      text(''),
      text(''),
      text(''),
      text(''),
      text(money(spend), { right: true, strong: true }),
      text(''),
      text(''),
    ],
  }
}

// ---------------------------------------------------------------------------
// Purchase orders · Suppliers
// ---------------------------------------------------------------------------

const SUPPLIER_FILTERS = ['All suppliers', 'Active', 'Inactive']

async function loadSuppliers(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const suppliers = await safe(
    () =>
      prisma.supplier.findMany({
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        take: list.limit,
        include: {
          purchaseOrders: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { poNumber: true, createdAt: true, status: true, expectedAt: true },
          },
          _count: { select: { purchaseOrders: true } },
        },
      }),
    [],
  )

  const columns: Column[] = [
    { label: 'Supplier', width: 'minmax(0,1.6fr)' },
    { label: 'Contact', width: 'minmax(0,1.1fr)' },
    { label: 'Email', width: 'minmax(0,1.3fr)' },
    { label: 'Phone', width: '128px' },
    { label: 'Where', width: 'minmax(0,1fr)' },
    { label: 'POs', width: '68px', right: true },
    { label: 'Status', width: '104px' },
  ]

  const rows: Row[] = suppliers.map((supplier) => {
    const latest = supplier.purchaseOrders[0]
    const values: FormValues = {
      name: supplier.name,
      contactName: textValue(supplier.contactName),
      email: textValue(supplier.email),
      phone: textValue(supplier.phone),
      city: textValue(supplier.city),
      state: textValue(supplier.state),
      notes: textValue(supplier.notes),
      isActive: supplier.isActive,
    }

    return {
      id: supplier.id,
      open: form('supplier.edit', { recordId: supplier.id, title: supplier.name, values }),
      search: `${supplier.name} ${supplier.contactName ?? ''} ${supplier.email ?? ''} ${supplier.city ?? ''}`,
      buckets: [0, supplier.isActive ? 1 : 2],
      cells: [
        text(supplier.name, { strong: true }),
        text(supplier.contactName ?? '—', { dim: !supplier.contactName }),
        text(supplier.email ?? '—', { mono: true, dim: true }),
        text(supplier.phone ?? '—', { mono: true, dim: true }),
        text(place({ city: supplier.city, state: supplier.state })),
        text(count(supplier._count.purchaseOrders), { mono: true, right: true }),
        statusCell(supplier.isActive ? 'Active' : 'Inactive', supplier.isActive ? 'good' : 'muted'),
      ],
      inspector: {
        title: supplier.name,
        tag: supplier.isActive ? 'Active' : 'Inactive',
        tagTone: supplier.isActive ? 'good' : 'muted',
        groups: [
          {
            label: 'CONTACT',
            fields: [
              { label: 'Contact', value: supplier.contactName ?? '—' },
              { label: 'Email', value: supplier.email ?? '—', mono: true },
              { label: 'Phone', value: supplier.phone ?? '—', mono: true },
              { label: 'Address', value: supplier.address1 ?? '—', wrap: true },
              { label: 'Where', value: place({ city: supplier.city, state: supplier.state }) },
            ],
          },
          {
            label: 'BUYING',
            fields: [
              { label: 'Purchase orders', value: count(supplier._count.purchaseOrders), mono: true },
              { label: 'Latest PO', value: latest?.poNumber ?? '—', mono: true },
              { label: 'Latest status', value: latest ? humanise(latest.status) : '—' },
              { label: 'Latest PO raised', value: latest ? shortDate(latest.createdAt) : '—', mono: true },
              { label: 'Latest PO expected', value: latest?.expectedAt ? shortDate(latest.expectedAt) : '—', mono: true },
              { label: 'Notes', value: supplier.notes ?? '—', wrap: true },
            ],
          },
        ],
        actions: [
          {
            label: 'Edit supplier…',
            shortcut: '⌘⏎',
            command: form('supplier.edit', { recordId: supplier.id, title: supplier.name, values }),
          },
          {
            label: 'New purchase order…',
            shortcut: '⌘N',
            command: form('purchase.create', { values: { supplierId: supplier.id } }),
          },
          ...(supplier.isActive
            ? [
                {
                  label: 'Deactivate',
                  danger: true,
                  command: write('supplier.deactivate', supplier.id, {
                    confirm: `Stop using ${supplier.name}? Existing purchase orders are untouched.`,
                    danger: true,
                  }),
                },
              ]
            : []),
          { label: 'Purchase orders', command: jump('purchase'), shortcut: '⌘⇧P' },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} suppliers`),
      text(''),
      text(''),
      text(''),
      text(''),
      text(count(suppliers.reduce((sum, supplier) => sum + supplier._count.purchaseOrders, 0)), {
        right: true,
        strong: true,
      }),
      text(''),
    ],
  }
}

// ---------------------------------------------------------------------------
// Fundraisers · Battle arena
// ---------------------------------------------------------------------------

const ARENA_FILTERS = ['All teams', 'Active', 'Pending', 'Suspended']

const TEAM_TONE: Record<string, Tone> = {
  PENDING: 'warn',
  ACTIVE: 'good',
  SUSPENDED: 'bad',
  ENDED: 'muted',
}

async function loadArena(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const teams = await safe(
    () =>
      prisma.fundraiserTeam.findMany({
        orderBy: [{ status: 'asc' }, { salesCount: 'desc' }],
        take: list.limit,
        include: {
          saleEvents: { select: { amount: true, createdAt: true } },
          season: { select: { period: true } },
          _count: { select: { shields: true, shareEvents: true, characters: true } },
        },
      }),
    [],
  )

  const columns: Column[] = [
    { label: 'Team', width: 'minmax(0,1.5fr)' },
    { label: 'School', width: 'minmax(0,1.4fr)' },
    { label: 'Season', width: 'minmax(0,1fr)' },
    { label: 'Raised', width: '100px', right: true },
    { label: 'Goal', width: '92px', right: true },
    { label: 'Progress', width: '86px', right: true },
    { label: 'Sales', width: '68px', right: true },
    { label: 'HP', width: '68px', right: true },
    { label: 'Status', width: '108px' },
  ]

  let raisedTotal = 0
  let goalTotal = 0

  const rows: Row[] = teams.map((team) => {
    // Gross sales, not commission — a fundraiser goal is stated in what the
    // group sold, and the 50-50 split is applied afterwards.
    const raised = team.saleEvents.reduce((sum, event) => sum + toNumber(event.amount), 0)
    const goal = team.goalAmount
    raisedTotal += raised
    goalTotal += goal

    const progress = goal > 0 ? raised / goal : 0
    const latest = team.saleEvents.reduce<Date | null>(
      (newest, event) => (!newest || event.createdAt > newest ? event.createdAt : newest),
      null,
    )

    const values: FormValues = {
      name: team.name,
      school: team.school,
      status: team.status,
      goalAmount: team.goalAmount,
      contactName: team.contactName,
      contactEmail: team.contactEmail,
      tagline: textValue(team.tagline),
    }

    return {
      id: team.id,
      open: form('team.edit', { recordId: team.id, title: team.name, values }),
      search: `${team.name} ${team.school} ${team.activePeriod} ${team.contactEmail}`,
      buckets: [
        0,
        ...(team.status === 'ACTIVE' ? [1] : []),
        ...(team.status === 'PENDING' ? [2] : []),
        ...(team.status === 'SUSPENDED' ? [3] : []),
      ],
      cells: [
        text(team.name, { strong: true }),
        text(team.school),
        text(team.season?.period ?? team.activePeriod, { dim: true }),
        text(money(raised), { mono: true, right: true, strong: true }),
        text(money(goal), { mono: true, right: true, dim: true }),
        {
          text: goal > 0 ? percent(progress * 100, 0) : '—',
          mono: true,
          right: true,
          tone: progress >= 1 ? 'good' : progress >= 0.5 ? 'warn' : 'muted',
        },
        text(count(team.saleEvents.length), { mono: true, right: true }),
        text(count(team.hpCurrent), { mono: true, right: true, dim: true }),
        statusCell(humanise(team.status), TEAM_TONE[team.status] ?? 'neutral'),
      ],
      inspector: {
        title: team.name,
        tag: humanise(team.status),
        tagTone: TEAM_TONE[team.status] ?? 'neutral',
        groups: [
          {
            label: 'TEAM',
            fields: [
              { label: 'School', value: team.school },
              { label: 'Period', value: team.activePeriod },
              { label: 'Season', value: team.season?.period ?? '—' },
              { label: 'Contact', value: team.contactName },
              { label: 'Email', value: team.contactEmail, mono: true },
              { label: 'Storefront', value: `/f/${team.slug}`, mono: true },
            ],
          },
          {
            label: 'SCOREBOARD',
            fields: [
              { label: 'Gross sales', value: money(raised), mono: true, strong: true },
              { label: 'Goal', value: money(goal), mono: true },
              { label: 'To the group', value: money(raised / 2), mono: true },
              { label: 'Sale events', value: count(team.saleEvents.length), mono: true },
              { label: 'Last sale', value: latest ? stamp(latest) : '—', mono: true },
              { label: 'Shields held', value: count(team._count.shields), mono: true },
              { label: 'Shares', value: count(team._count.shareEvents), mono: true },
              { label: 'Characters', value: count(team._count.characters), mono: true },
              { label: 'HP', value: count(team.hpCurrent), mono: true },
            ],
          },
        ],
        actions: [
          {
            label: 'Edit team…',
            shortcut: '⌘⏎',
            command: form('team.edit', { recordId: team.id, title: team.name, values }),
          },
          ...(team.status === 'PENDING'
            ? [
                {
                  label: 'Approve into the arena',
                  shortcut: '⌘⇧P',
                  command: write('team.approve', team.id, {
                    confirm: `Let ${team.name} into the arena? Their page goes live immediately.`,
                  }),
                },
              ]
            : []),
          ...(team.status === 'ACTIVE'
            ? [
                {
                  label: 'Suspend',
                  danger: true,
                  command: write('team.suspend', team.id, {
                    confirm: `Suspend ${team.name}? Their arena page stops taking sales.`,
                    danger: true,
                  }),
                },
              ]
            : []),
          { label: 'Fundraisers', command: jump('fundraisers'), shortcut: '⌘F' },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} teams`),
      text(''),
      text(''),
      text(money(raisedTotal), { right: true, strong: true }),
      text(money(goalTotal), { right: true, dim: true }),
      text(goalTotal > 0 ? percent((raisedTotal / goalTotal) * 100, 0) : '', { right: true }),
      text(''),
      text(''),
      text(''),
    ],
  }
}

// ---------------------------------------------------------------------------
// Events · Packing manifests
// ---------------------------------------------------------------------------

const MANIFEST_FILTERS = ['All manifests', 'Draft', 'Packed', 'Returned']

const MANIFEST_TONE: Record<string, Tone> = {
  DRAFT: 'muted',
  PACKED: 'accent',
  RETURNED: 'good',
}

async function loadManifests(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const manifests = await safe(
    () =>
      prisma.eventManifest.findMany({
        orderBy: { updatedAt: 'desc' },
        take: list.limit,
        include: {
          event: { select: { id: true, title: true, startDate: true, city: true, state: true } },
          items: { include: { product: { select: { name: true, price: true } } } },
        },
      }),
    [],
  )

  const columns: Column[] = [
    { label: 'Event', width: 'minmax(0,1.8fr)' },
    { label: 'Where', width: 'minmax(0,1fr)' },
    { label: 'Date', width: '96px' },
    { label: 'Lines', width: '68px', right: true },
    { label: 'Jars out', width: '86px', right: true },
    { label: 'Back', width: '80px', right: true },
    { label: 'Sold', width: '80px', right: true },
    { label: 'Status', width: '108px' },
  ]

  let outTotal = 0
  let soldTotal = 0

  const rows: Row[] = manifests.map((manifest) => {
    // A case is twelve jars everywhere else in this schema, so the manifest is
    // read in jars and the cases folded in rather than shown as a second unit.
    const taken = manifest.items.reduce((sum, item) => sum + item.takenCases * 12 + item.takenJars, 0)
    const returned = manifest.items.reduce(
      (sum, item) => sum + item.returnedCases * 12 + item.returnedJars,
      0,
    )
    const sold = Math.max(taken - returned, 0)
    outTotal += taken
    soldTotal += sold

    const values: FormValues = { status: manifest.status, notes: textValue(manifest.notes) }

    return {
      id: manifest.id,
      open: form('manifest.edit', {
        recordId: manifest.id,
        title: `${manifest.event.title} manifest`,
        values,
      }),
      search: `${manifest.event.title} ${manifest.event.city ?? ''} ${humanise(manifest.status)}`,
      buckets: [
        0,
        ...(manifest.status === 'DRAFT' ? [1] : []),
        ...(manifest.status === 'PACKED' ? [2] : []),
        ...(manifest.status === 'RETURNED' ? [3] : []),
      ],
      cells: [
        text(manifest.event.title, { strong: true }),
        text(place({ city: manifest.event.city, state: manifest.event.state }), { dim: true }),
        text(shortDate(manifest.event.startDate), { mono: true, dim: true }),
        text(count(manifest.items.length), { mono: true, right: true }),
        text(count(taken), { mono: true, right: true }),
        text(count(returned), { mono: true, right: true, dim: true }),
        text(count(sold), { mono: true, right: true, strong: true }),
        statusCell(humanise(manifest.status), MANIFEST_TONE[manifest.status] ?? 'neutral'),
      ],
      inspector: {
        title: manifest.event.title,
        tag: humanise(manifest.status),
        tagTone: MANIFEST_TONE[manifest.status] ?? 'neutral',
        groups: [
          {
            label: 'SHOW',
            fields: [
              { label: 'Date', value: shortDate(manifest.event.startDate), mono: true },
              { label: 'Where', value: place({ city: manifest.event.city, state: manifest.event.state }) },
              { label: 'Packed', value: manifest.packedAt ? stamp(manifest.packedAt) : '—', mono: true },
              { label: 'Returned', value: manifest.returnedAt ? stamp(manifest.returnedAt) : '—', mono: true },
              { label: 'Notes', value: manifest.notes ?? '—', wrap: true },
            ],
          },
          {
            label: 'ON THE VAN',
            lines: manifest.items.map<InspectorLine>((item) => {
              const itemTaken = item.takenCases * 12 + item.takenJars
              const itemBack = item.returnedCases * 12 + item.returnedJars
              return {
                name: item.product.name,
                qty: `${count(itemTaken)} out`,
                amount: `${count(Math.max(itemTaken - itemBack, 0))} sold`,
              }
            }),
          },
        ],
        actions: [
          {
            label: 'Edit manifest…',
            shortcut: '⌘⏎',
            command: form('manifest.edit', {
              recordId: manifest.id,
              title: `${manifest.event.title} manifest`,
              values,
            }),
          },
          { label: 'Calendar', command: jump('events'), shortcut: '⌘E' },
          { label: 'Inventory', command: jump('inventory'), shortcut: '⌘I' },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} manifests`),
      text(''),
      text(''),
      text(''),
      text(count(outTotal), { right: true }),
      text(''),
      text(count(soldTotal), { right: true, strong: true }),
      text(''),
    ],
  }
}

// ---------------------------------------------------------------------------
// Wholesale · Store locator
// ---------------------------------------------------------------------------

const LOCATION_FILTERS = ['All stockists', 'Listed', 'Hidden', 'No photo']

async function loadLocations(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const locations = await safe(
    () =>
      prisma.retailLocation.findMany({
        orderBy: [{ isActive: 'desc' }, { state: 'asc' }, { city: 'asc' }, { businessName: 'asc' }],
        take: list.limit,
        include: { _count: { select: { photos: true } } },
      }),
    [],
  )

  const columns: Column[] = [
    { label: 'Business', width: 'minmax(0,1.7fr)' },
    { label: 'Address', width: 'minmax(0,1.6fr)' },
    { label: 'City', width: 'minmax(0,1fr)' },
    { label: 'State', width: '70px' },
    { label: 'Phone', width: '128px' },
    { label: 'Photos', width: '78px', right: true },
    { label: 'Listed', width: '96px' },
  ]

  const states = new Set<string>()

  const rows: Row[] = locations.map((location) => {
    states.add(location.state)

    const values: FormValues = {
      businessName: location.businessName,
      address: location.address,
      city: location.city,
      state: location.state,
      zipCode: textValue(location.zipCode),
      phone: textValue(location.phone),
      website: textValue(location.website),
      isActive: location.isActive,
    }

    const buckets = [0, location.isActive ? 1 : 2]
    if (!location.photoUrl && location._count.photos === 0) buckets.push(3)

    return {
      id: location.id,
      open: form('location.edit', { recordId: location.id, title: location.businessName, values }),
      search: `${location.businessName} ${location.address} ${location.city} ${location.state}`,
      buckets,
      cells: [
        text(location.businessName, { strong: true }),
        text(location.address, { dim: true }),
        text(location.city),
        text(location.state, { mono: true }),
        text(location.phone ?? '—', { mono: true, dim: true }),
        text(count(location._count.photos), { mono: true, right: true }),
        statusCell(location.isActive ? 'Listed' : 'Hidden', location.isActive ? 'good' : 'muted'),
      ],
      inspector: {
        title: location.businessName,
        tag: location.isActive ? 'Listed' : 'Hidden',
        tagTone: location.isActive ? 'good' : 'muted',
        groups: [
          {
            label: 'STOCKIST',
            fields: [
              { label: 'Address', value: location.address, wrap: true },
              { label: 'City', value: location.city },
              { label: 'State', value: location.state, mono: true },
              { label: 'ZIP', value: location.zipCode ?? '—', mono: true },
              { label: 'County', value: location.county ?? '—' },
              { label: 'Phone', value: location.phone ?? '—', mono: true },
              { label: 'Website', value: location.website ?? '—', wrap: true },
            ],
          },
          {
            label: 'MAP',
            fields: [
              { label: 'Places id', value: location.googlePlacesId ?? '—', mono: true, wrap: true },
              {
                label: 'Coordinates',
                value:
                  location.latitude && location.longitude
                    ? `${toNumber(location.latitude).toFixed(5)}, ${toNumber(location.longitude).toFixed(5)}`
                    : 'Not geocoded',
                mono: true,
              },
              { label: 'Photos', value: count(location._count.photos), mono: true },
            ],
          },
        ],
        actions: [
          {
            label: 'Edit stockist…',
            shortcut: '⌘⏎',
            command: form('location.edit', { recordId: location.id, title: location.businessName, values }),
          },
          ...(location.website ? [{ label: 'Open website…', shortcut: '⌘O', command: link(location.website) }] : []),
          {
            label: 'Remove from locator',
            danger: true,
            command: write('location.delete', location.id, {
              confirm: `Remove ${location.businessName} from the store locator?`,
              danger: true,
            }),
          },
          { label: 'Wholesale accounts', command: jump('wholesale'), shortcut: '⌘⇧W' },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} stockists`),
      text(''),
      text(''),
      text(`${count(states.size)} states`, { dim: true }),
      text(''),
      text(''),
      text(''),
    ],
  }
}

// ---------------------------------------------------------------------------
// Financials · Reconciliation
// ---------------------------------------------------------------------------

const RECONCILIATION_FILTERS = ['All years', 'Short', 'Reconciled', 'No document']

const RECONCILIATION_TONE: Record<ReconciliationStatus, Tone> = {
  RECONCILED: 'good',
  ABOVE_FLOOR: 'good',
  OVER_CAPTURED: 'warn',
  UNDER_CAPTURED: 'bad',
  NO_ANCHOR: 'muted',
  NO_LEDGER_DATA: 'bad',
}

const RECONCILIATION_LABEL: Record<ReconciliationStatus, string> = {
  RECONCILED: 'Reconciled',
  ABOVE_FLOOR: 'Above floor',
  OVER_CAPTURED: 'Over anchor',
  UNDER_CAPTURED: 'Under-captured',
  NO_ANCHOR: 'No document',
  NO_LEDGER_DATA: 'Nothing in ledger',
}

/** The year an instant falls in, in Zanesville rather than UTC. */
const YEAR_IN_STORE_TIME = new Intl.DateTimeFormat('en-US', {
  timeZone: STORE_TIME_ZONE,
  year: 'numeric',
})

async function loadReconciliation(): Promise<TablePayload> {
  // Bucketed here rather than in SQL: the ledger is small, and the year has to
  // be taken in store time or a late-December evening sale files itself into
  // the following tax year on a UTC runtime.
  const entries = await safe(
    () =>
      prisma.ledgerEntry.findMany({
        where: { direction: 'INCOME' },
        select: { date: true, amountCents: true },
      }),
    [],
  )

  const byYear = new Map<number, number>()
  for (const entry of entries) {
    const year = Number(YEAR_IN_STORE_TIME.format(entry.date))
    byYear.set(year, (byYear.get(year) ?? 0) + entry.amountCents)
  }

  const totals = [...byYear.entries()]
    .map(([year, incomeCents]) => ({ year, incomeCents }))
    .sort((a, b) => a.year - b.year)

  const years = reconcileYears(totals)
  const summary = summariseReconciliation(years)

  const columns: Column[] = [
    { label: 'Year', width: '84px' },
    { label: 'In the ledger', width: '132px', right: true },
    { label: 'On the documents', width: '148px', right: true },
    { label: 'Source', width: '110px' },
    { label: 'Missing', width: '132px', right: true },
    { label: 'Captured', width: '104px', right: true },
    { label: 'Status', width: '150px' },
  ]

  const rows: Row[] = [...years].reverse().map((year) => {
    const buckets = [0]
    if (year.status === 'UNDER_CAPTURED' || year.status === 'NO_LEDGER_DATA') buckets.push(1)
    if (year.status === 'RECONCILED' || year.status === 'ABOVE_FLOOR') buckets.push(2)
    if (year.status === 'NO_ANCHOR') buckets.push(3)

    const missing = year.varianceCents !== null && year.varianceCents < 0 ? -year.varianceCents : 0

    return {
      id: String(year.year),
      open: jump('ledger'),
      search: `${year.year} ${RECONCILIATION_LABEL[year.status]}`,
      buckets,
      cells: [
        text(String(year.year), { mono: true, strong: true }),
        text(centsToMoney(year.ledgerIncomeCents), { mono: true, right: true }),
        text(year.anchorCents === null ? '—' : centsToMoney(year.anchorCents), {
          mono: true,
          right: true,
          dim: year.anchorCents === null,
        }),
        text(year.grade ? humanise(year.grade) : '—', { dim: true }),
        {
          text: missing > 0 ? centsToMoney(missing) : '—',
          mono: true,
          right: true,
          tone: missing > 0 ? 'bad' : 'muted',
        },
        text(year.capturedRatio === null ? '—' : percent(year.capturedRatio * 100, 1), {
          mono: true,
          right: true,
        }),
        statusCell(RECONCILIATION_LABEL[year.status], RECONCILIATION_TONE[year.status]),
      ],
      inspector: {
        title: `${year.year}`,
        tag: RECONCILIATION_LABEL[year.status],
        tagTone: RECONCILIATION_TONE[year.status],
        groups: [
          {
            label: 'THE YEAR',
            fields: [
              { label: 'Ledger income', value: centsToMoney(year.ledgerIncomeCents), mono: true },
              {
                label: 'Document figure',
                value: year.anchorCents === null ? 'No filed figure' : centsToMoney(year.anchorCents),
                mono: true,
              },
              { label: 'Document grade', value: year.grade ? humanise(year.grade) : '—' },
              {
                label: 'Variance',
                value: year.varianceCents === null ? '—' : centsToMoney(year.varianceCents),
                mono: true,
              },
              {
                label: 'Captured',
                value: year.capturedRatio === null ? '—' : percent(year.capturedRatio * 100, 1),
                mono: true,
                strong: true,
              },
            ],
          },
          {
            label: 'WHOLE PICTURE',
            fields: [
              { label: 'Years with a document', value: count(summary.completeYears), mono: true },
              { label: 'Years reconciled', value: count(summary.reconciledYears), mono: true },
              { label: 'Ledger, all years', value: centsToMoney(summary.ledgerIncomeCents), mono: true },
              { label: 'Documents, all years', value: centsToMoney(summary.anchorCents), mono: true },
              { label: 'Never told about', value: centsToMoney(summary.missingCents), mono: true, strong: true },
              {
                label: 'Captured overall',
                value: summary.capturedRatio === null ? '—' : percent(summary.capturedRatio * 100, 1),
                mono: true,
              },
            ],
          },
        ],
        actions: [
          { label: 'Ledger', command: jump('ledger'), shortcut: '⌘⏎' },
          { label: 'Import a statement…', command: link('/admin/financials/ledger/import'), shortcut: '⌘I' },
          { label: 'Show archive', command: page('media.shows'), shortcut: '⌘S' },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} years`),
      text(centsToMoney(summary.ledgerIncomeCents), { right: true }),
      text(centsToMoney(summary.anchorCents), { right: true }),
      text(''),
      text(centsToMoney(summary.missingCents), { right: true, strong: true, tone: 'bad' }),
      text(summary.capturedRatio === null ? '' : percent(summary.capturedRatio * 100, 1), { right: true }),
      text(''),
    ],
  }
}


// ---------------------------------------------------------------------------
// Email · Templates
// ---------------------------------------------------------------------------

const EMAIL_TEMPLATE_FILTERS = ['All templates', 'Marketing', 'Transactional', 'Retired']

async function loadEmailTemplates(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const templates = await safe(
    () =>
      prisma.emailTemplate.findMany({
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        take: list.limit,
        include: { _count: { select: { campaigns: true, versions: true } } },
      }),
    [],
  )

  const columns: Column[] = [
    { label: 'Template', width: 'minmax(0,1.7fr)' },
    { label: 'Key', width: 'minmax(0,1.2fr)' },
    { label: 'Subject', width: 'minmax(0,1.9fr)' },
    { label: 'Category', width: '132px' },
    { label: 'Campaigns', width: '98px', right: true },
    { label: 'Sent', width: '86px', right: true },
    { label: 'Last used', width: '104px' },
    { label: 'Status', width: '96px' },
  ]

  let sent = 0

  const rows: Row[] = templates.map((template) => {
    sent += template.sentCount

    const buckets = [0]
    if (template.category === 'MARKETING') buckets.push(1)
    if (template.category === 'TRANSACTIONAL') buckets.push(2)
    if (!template.isActive) buckets.push(3)

    return {
      id: template.id,
      // A template body is HTML edited in the composer; the window lists what
      // exists, what uses it and how often it has gone out.
      open: form('campaign.create', { values: { templateId: template.id, subject: template.subject } }),
      search: `${template.name} ${template.key} ${template.subject} ${template.tags.join(' ')}`,
      buckets,
      cells: [
        text(template.name, { strong: true }),
        text(template.key, { mono: true, dim: true }),
        text(excerpt(template.subject, 64), { dim: true }),
        text(humanise(template.category), { dim: true }),
        text(count(template._count.campaigns), { mono: true, right: true }),
        text(count(template.sentCount), { mono: true, right: true }),
        text(template.lastSentAt ? shortDate(template.lastSentAt) : 'Never', {
          mono: true,
          dim: !template.lastSentAt,
        }),
        statusCell(template.isActive ? 'Active' : 'Retired', template.isActive ? 'good' : 'muted'),
      ],
      inspector: {
        title: template.name,
        tag: humanise(template.category),
        tagTone: template.isActive ? 'good' : 'muted',
        groups: [
          {
            label: 'TEMPLATE',
            fields: [
              { label: 'Key', value: template.key, mono: true },
              { label: 'Subject', value: template.subject, wrap: true },
              { label: 'Category', value: humanise(template.category) },
              { label: 'Tags', value: template.tags.join(', ') || '—', wrap: true },
              { label: 'Revisions kept', value: count(template._count.versions), mono: true },
              { label: 'Updated', value: stamp(template.updatedAt), mono: true },
            ],
          },
          {
            label: 'USE',
            fields: [
              { label: 'Campaigns using it', value: count(template._count.campaigns), mono: true },
              { label: 'Emails sent', value: count(template.sentCount), mono: true, strong: true },
              {
                label: 'Last sent',
                value: template.lastSentAt ? stamp(template.lastSentAt) : 'Never',
                mono: true,
              },
            ],
          },
        ],
        actions: [
          {
            label: 'New campaign from this…',
            shortcut: '⌘⏎',
            command: form('campaign.create', {
              values: { templateId: template.id, subject: template.subject },
            }),
          },
          { label: 'Campaigns', command: jump('email'), shortcut: '⌘⇧C' },
          { label: 'Brand kit', command: page('email.brand'), shortcut: '⌘B' },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} templates`),
      text(''),
      text(''),
      text(''),
      text(count(templates.reduce((sum, template) => sum + template._count.campaigns, 0)), { right: true }),
      text(count(sent), { right: true, strong: true }),
      text(''),
      text(''),
    ],
  }
}

// ---------------------------------------------------------------------------
// Email · Automations
// ---------------------------------------------------------------------------

const AUTOMATION_FILTERS = ['All automations', 'Running', 'Paused']

async function loadAutomations(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const automations = await safe(
    () =>
      prisma.emailAutomation.findMany({
        orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
        take: list.limit,
        include: {
          steps: { orderBy: { order: 'asc' }, select: { order: true, subject: true, delayHours: true } },
          _count: { select: { enrollments: true, logs: true } },
        },
      }),
    [],
  )

  const columns: Column[] = [
    { label: 'Automation', width: 'minmax(0,1.8fr)' },
    { label: 'Trigger', width: 'minmax(0,1.3fr)' },
    { label: 'Steps', width: '72px', right: true },
    { label: 'Span', width: '96px', right: true },
    { label: 'Enrolled', width: '90px', right: true },
    { label: 'Sends', width: '82px', right: true },
    { label: 'Status', width: '104px' },
    { label: 'Updated', width: '104px' },
  ]

  let enrolled = 0

  const rows: Row[] = automations.map((automation) => {
    enrolled += automation._count.enrollments

    // How long a person stays in the sequence, which is what "3 steps" leaves out.
    const span = automation.steps.reduce((sum, step) => sum + step.delayHours, 0)
    const values: FormValues = {
      name: automation.name,
      description: textValue(automation.description),
      isActive: automation.isActive,
    }

    return {
      id: automation.id,
      open: form('automation.edit', { recordId: automation.id, title: automation.name, values }),
      search: `${automation.name} ${humanise(automation.trigger)} ${automation.description ?? ''}`,
      buckets: [0, automation.isActive ? 1 : 2],
      cells: [
        text(automation.name, { strong: true }),
        text(humanise(automation.trigger), { dim: true }),
        text(count(automation.steps.length), { mono: true, right: true }),
        text(span > 0 ? `${count(Math.round(span / 24))} d` : 'same day', { mono: true, right: true, dim: true }),
        text(count(automation._count.enrollments), { mono: true, right: true }),
        text(count(automation._count.logs), { mono: true, right: true, dim: true }),
        statusCell(automation.isActive ? 'Running' : 'Paused', automation.isActive ? 'good' : 'muted'),
        text(shortDate(automation.updatedAt), { mono: true, dim: true }),
      ],
      inspector: {
        title: automation.name,
        tag: automation.isActive ? 'Running' : 'Paused',
        tagTone: automation.isActive ? 'good' : 'muted',
        groups: [
          {
            label: 'AUTOMATION',
            fields: [
              { label: 'Trigger', value: humanise(automation.trigger) },
              { label: 'Description', value: automation.description ?? '—', wrap: true },
              { label: 'Enrolled', value: count(automation._count.enrollments), mono: true },
              { label: 'Emails sent', value: count(automation._count.logs), mono: true },
              { label: 'Updated', value: stamp(automation.updatedAt), mono: true },
            ],
          },
          {
            label: 'SEQUENCE',
            lines: automation.steps.map<InspectorLine>((step) => ({
              name: step.subject ?? `Step ${step.order + 1}`,
              qty: `#${step.order + 1}`,
              amount: step.delayHours === 0 ? 'at once' : `+${count(step.delayHours)}h`,
            })),
          },
        ],
        actions: [
          {
            label: 'Edit automation…',
            shortcut: '⌘⏎',
            command: form('automation.edit', { recordId: automation.id, title: automation.name, values }),
          },
          automation.isActive
            ? {
                label: 'Pause',
                shortcut: '⌘⇧P',
                command: write('automation.pause', automation.id, {
                  confirm: `Pause ${automation.name}? Nobody new is enrolled while it is paused.`,
                }),
              }
            : {
                label: 'Start running',
                shortcut: '⌘⇧P',
                command: write('automation.activate', automation.id, {
                  confirm: `Start ${automation.name}? It begins enrolling on the next trigger.`,
                }),
              },
          { label: 'Campaigns', command: jump('email'), shortcut: '⌘⇧C' },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} automations`),
      text(''),
      text(''),
      text(''),
      text(count(enrolled), { right: true, strong: true }),
      text(''),
      text(''),
      text(''),
    ],
  }
}

// ---------------------------------------------------------------------------
// Email · Lists & subscribers
// ---------------------------------------------------------------------------

const SUBSCRIBER_FILTERS = ['Everyone', 'Subscribed', 'Unsubscribed', 'Bounced']

const SUBSCRIBER_TONE: Record<string, Tone> = {
  SUBSCRIBED: 'good',
  UNSUBSCRIBED: 'muted',
  BOUNCED: 'bad',
  COMPLAINED: 'bad',
}

async function loadSubscribers(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const [subscribers, lists] = await Promise.all([
    safe(
      () =>
        prisma.mailingListSubscriber.findMany({
          where: matching<Prisma.MailingListSubscriberWhereInput>(list.q, (word, raw) => [
            { email: word },
            { firstName: word },
            { lastName: word },
            { source: word },
            { list: { is: { name: word } } },
            { tags: { has: raw } },
          ]),
          orderBy: { createdAt: 'desc' },
          take: list.limit,
          include: { list: { select: { id: true, name: true, description: true, isDefault: true } } },
        }),
      [],
    ),
    safe(
      () =>
        prisma.mailingList.findMany({
          orderBy: { name: 'asc' },
          include: { _count: { select: { subscribers: true, campaigns: true } } },
        }),
      [],
    ),
  ])

  const columns: Column[] = [
    { label: 'Email', width: 'minmax(0,1.9fr)' },
    { label: 'Name', width: 'minmax(0,1.2fr)' },
    { label: 'List', width: 'minmax(0,1.2fr)' },
    { label: 'Source', width: '112px' },
    { label: 'Score', width: '72px', right: true },
    { label: 'Status', width: '124px' },
    { label: 'Joined', width: '100px' },
  ]

  const listSummary = lists
    .map((list) => `${list.name} ${count(list._count.subscribers)}`)
    .join(' · ')

  const rows: Row[] = subscribers.map((subscriber) => {
    const name = personName({
      firstName: subscriber.firstName,
      lastName: subscriber.lastName,
      email: subscriber.email,
    })

    const values: FormValues = {
      email: subscriber.email,
      firstName: textValue(subscriber.firstName),
      lastName: textValue(subscriber.lastName),
      status: subscriber.status,
      tags: subscriber.tags,
    }

    const buckets = [0]
    if (subscriber.status === 'SUBSCRIBED') buckets.push(1)
    if (subscriber.status === 'UNSUBSCRIBED') buckets.push(2)
    if (subscriber.status === 'BOUNCED' || subscriber.status === 'COMPLAINED') buckets.push(3)

    return {
      id: subscriber.id,
      open: form('subscriber.edit', { recordId: subscriber.id, title: subscriber.email, values }),
      search: `${subscriber.email} ${name} ${subscriber.list.name} ${subscriber.tags.join(' ')}`,
      buckets,
      cells: [
        text(subscriber.email, { mono: true, strong: true }),
        text(name === subscriber.email ? '—' : name, { dim: name === subscriber.email }),
        text(subscriber.list.name),
        text(subscriber.source ?? '—', { dim: true }),
        text(count(subscriber.engagementScore), { mono: true, right: true, dim: true }),
        statusCell(humanise(subscriber.status), SUBSCRIBER_TONE[subscriber.status] ?? 'neutral'),
        text(shortDate(subscriber.createdAt), { mono: true, dim: true }),
      ],
      inspector: {
        title: subscriber.email,
        tag: humanise(subscriber.status),
        tagTone: SUBSCRIBER_TONE[subscriber.status] ?? 'neutral',
        groups: [
          {
            label: 'SUBSCRIBER',
            fields: [
              { label: 'Name', value: name === subscriber.email ? '—' : name },
              { label: 'Phone', value: subscriber.phone ?? '—', mono: true },
              { label: 'Source', value: subscriber.source ?? '—' },
              { label: 'Tags', value: subscriber.tags.length ? subscriber.tags.join(', ') : '—', wrap: true },
              { label: 'Engagement', value: count(subscriber.engagementScore), mono: true },
              {
                label: 'Last engaged',
                value: subscriber.lastEngagedAt ? stamp(subscriber.lastEngagedAt) : '—',
                mono: true,
              },
              { label: 'Joined', value: stamp(subscriber.createdAt), mono: true },
              {
                label: 'Unsubscribed',
                value: subscriber.unsubscribedAt ? stamp(subscriber.unsubscribedAt) : '—',
                mono: true,
              },
            ],
          },
          {
            label: 'LIST',
            fields: [
              { label: 'Name', value: subscriber.list.name },
              { label: 'Description', value: subscriber.list.description ?? '—', wrap: true },
              { label: 'Default list', value: subscriber.list.isDefault ? 'Yes' : 'No' },
            ],
          },
        ],
        actions: [
          {
            label: 'Edit subscriber…',
            shortcut: '⌘⏎',
            command: form('subscriber.edit', { recordId: subscriber.id, title: subscriber.email, values }),
          },
          {
            label: 'Edit list…',
            shortcut: '⌘E',
            command: form('list.edit', {
              recordId: subscriber.list.id,
              title: subscriber.list.name,
              values: {
                name: subscriber.list.name,
                description: textValue(subscriber.list.description),
                isDefault: subscriber.list.isDefault,
              },
            }),
          },
          ...(subscriber.status === 'SUBSCRIBED'
            ? [
                {
                  label: 'Unsubscribe',
                  shortcut: '⌘U',
                  command: write('subscriber.unsubscribe', subscriber.id, {
                    confirm: `Unsubscribe ${subscriber.email}? They stop receiving every campaign on this list.`,
                  }),
                },
              ]
            : []),
          {
            label: 'Remove',
            danger: true,
            command: write('subscriber.delete', subscriber.id, {
              confirm: `Delete ${subscriber.email} from ${subscriber.list.name}? Unsubscribing keeps the record; deleting does not.`,
              danger: true,
            }),
          },
          { label: 'Suppressions', command: page('email.suppressions'), shortcut: '⌘S' },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} subscribers`),
      text(''),
      text(listSummary || `${count(lists.length)} lists`, { dim: true }),
      text(''),
      text(''),
      text(''),
      text(rows.length === list.limit ? `latest ${list.limit}` : '', { dim: true }),
    ],
  }
}

// ---------------------------------------------------------------------------
// Email · Suppressions
// ---------------------------------------------------------------------------

const SUPPRESSION_FILTERS = ['All suppressions', 'Bounced', 'Complained', 'By hand']

const SUPPRESSION_TONE: Record<string, Tone> = {
  HARD_BOUNCE: 'bad',
  SOFT_BOUNCE: 'warn',
  SPAM_COMPLAINT: 'bad',
  MANUAL: 'muted',
  UNSUBSCRIBE: 'muted',
  ADMIN: 'muted',
}

async function loadSuppressions(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const [suppressions, bounces] = await Promise.all([
    safe(
      () => prisma.emailSuppression.findMany({ orderBy: { createdAt: 'desc' }, take: list.limit }),
      [],
    ),
    safe(
      () =>
        prisma.emailBounce.findMany({
          orderBy: { recordedAt: 'desc' },
          take: 500,
          select: { email: true, bounceType: true, reason: true, recordedAt: true },
        }),
      [],
    ),
  ])

  // Every bounce this address has recorded, so the row says why it is here
  // rather than only that it is.
  const bounceHistory = new Map<string, { hard: number; soft: number; last: Date; reason: string | null }>()
  for (const bounce of bounces) {
    const key = bounce.email.toLowerCase()
    const entry = bounceHistory.get(key) ?? { hard: 0, soft: 0, last: bounce.recordedAt, reason: bounce.reason }
    if (bounce.bounceType === 'HARD') entry.hard += 1
    else entry.soft += 1
    if (bounce.recordedAt > entry.last) entry.last = bounce.recordedAt
    bounceHistory.set(key, entry)
  }

  const columns: Column[] = [
    { label: 'Email', width: 'minmax(0,2fr)' },
    { label: 'Reason', width: '150px' },
    { label: 'Source', width: '128px' },
    { label: 'Bounces', width: '90px', right: true },
    { label: 'Note', width: 'minmax(0,1.4fr)' },
    { label: 'Since', width: '104px' },
  ]

  const rows: Row[] = suppressions.map((suppression) => {
    const history = bounceHistory.get(suppression.email.toLowerCase())
    const bounceCount = history ? history.hard + history.soft : 0

    const buckets = [0]
    if (suppression.reason === 'HARD_BOUNCE' || suppression.reason === 'SOFT_BOUNCE') buckets.push(1)
    if (suppression.reason === 'SPAM_COMPLAINT') buckets.push(2)
    if (suppression.reason === 'MANUAL' || suppression.reason === 'ADMIN') buckets.push(3)

    return {
      id: suppression.id,
      open: write('suppression.delete', suppression.id, {
        confirm: `Lift the block on ${suppression.email}? Campaigns will email it again.`,
        danger: true,
      }),
      search: `${suppression.email} ${humanise(suppression.reason)} ${suppression.notes ?? ''}`,
      buckets,
      cells: [
        text(suppression.email, { mono: true, strong: true }),
        statusCell(humanise(suppression.reason), SUPPRESSION_TONE[suppression.reason] ?? 'neutral'),
        text(suppression.source ?? '—', { dim: true }),
        text(bounceCount ? count(bounceCount) : '—', { mono: true, right: true, dim: !bounceCount }),
        text(excerpt(suppression.notes, 70) || '—', { dim: true }),
        text(shortDate(suppression.createdAt), { mono: true, dim: true }),
      ],
      inspector: {
        title: suppression.email,
        tag: humanise(suppression.reason),
        tagTone: SUPPRESSION_TONE[suppression.reason] ?? 'neutral',
        groups: [
          {
            label: 'SUPPRESSION',
            fields: [
              { label: 'Reason', value: humanise(suppression.reason) },
              { label: 'Source', value: suppression.source ?? '—' },
              { label: 'Since', value: stamp(suppression.createdAt), mono: true },
              { label: 'Note', value: suppression.notes ?? '—', wrap: true },
            ],
          },
          {
            label: 'BOUNCE HISTORY',
            fields: [
              { label: 'Hard bounces', value: count(history?.hard ?? 0), mono: true },
              { label: 'Soft bounces', value: count(history?.soft ?? 0), mono: true },
              { label: 'Last bounce', value: history ? stamp(history.last) : '—', mono: true },
              { label: 'Last reason', value: history?.reason ?? '—', wrap: true },
            ],
          },
        ],
        actions: [
          {
            label: 'Lift the block',
            shortcut: '⌘⏎',
            danger: true,
            command: write('suppression.delete', suppression.id, {
              confirm: `Lift the block on ${suppression.email}? Nothing has been sent to it since ${shortDate(
                suppression.createdAt,
              )}.`,
              danger: true,
            }),
          },
          { label: 'Subscribers', command: page('email.lists'), shortcut: '⌘U' },
          { label: 'Send log', command: page('email.logs'), shortcut: '⌘L' },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} suppressed`),
      text(''),
      text(''),
      text(count(bounces.length), { right: true, dim: true }),
      text('bounce records seen', { dim: true }),
      text(''),
    ],
  }
}

// ---------------------------------------------------------------------------
// Email · Send log
// ---------------------------------------------------------------------------

const EMAIL_LOG_FILTERS = ['Everything', 'Delivered', 'Opened', 'Trouble']

const EMAIL_LOG_TONE: Record<string, Tone> = {
  PENDING: 'muted',
  SENDING: 'warn',
  SENT: 'good',
  OPENED: 'accent',
  CLICKED: 'accent',
  FAILED: 'bad',
  BOUNCED: 'bad',
}

async function loadEmailLogs(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const logs = await safe(
    () =>
      prisma.emailLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: list.limit,
        include: { user: { select: { name: true, email: true } } },
      }),
    [],
  )

  const columns: Column[] = [
    { label: 'To', width: 'minmax(0,1.7fr)' },
    { label: 'Subject', width: 'minmax(0,2fr)' },
    { label: 'From', width: 'minmax(0,1.1fr)' },
    { label: 'Opened', width: '104px' },
    { label: 'Clicked', width: '104px' },
    { label: 'Status', width: '110px' },
    { label: 'Sent', width: '116px' },
  ]

  let opened = 0
  let clicked = 0
  let failed = 0

  const rows: Row[] = logs.map((log) => {
    if (log.openedAt) opened += 1
    if (log.clickedAt) clicked += 1
    if (log.failedAt || log.bouncedAt) failed += 1

    const buckets = [0]
    if (log.status === 'SENT' || log.status === 'OPENED' || log.status === 'CLICKED') buckets.push(1)
    if (log.openedAt) buckets.push(2)
    if (log.status === 'FAILED' || log.status === 'BOUNCED') buckets.push(3)

    return {
      id: log.id,
      search: `${log.recipientEmail} ${log.subject} ${log.recipientName ?? ''}`,
      buckets,
      cells: [
        text(log.recipientEmail, { mono: true, strong: true }),
        text(excerpt(log.subject, 64), { dim: true }),
        text(log.from ?? '—', { mono: true, dim: true }),
        text(log.openedAt ? shortDate(log.openedAt) : '—', { mono: true, dim: !log.openedAt }),
        text(log.clickedAt ? shortDate(log.clickedAt) : '—', { mono: true, dim: !log.clickedAt }),
        statusCell(humanise(log.status), EMAIL_LOG_TONE[log.status] ?? 'neutral'),
        text(stamp(log.sentAt ?? log.createdAt), { mono: true, dim: true }),
      ],
      inspector: {
        title: log.recipientEmail,
        tag: humanise(log.status),
        tagTone: EMAIL_LOG_TONE[log.status] ?? 'neutral',
        groups: [
          {
            label: 'MESSAGE',
            fields: [
              { label: 'Subject', value: log.subject, wrap: true },
              { label: 'To', value: log.recipientName ?? log.recipientEmail },
              { label: 'From', value: log.from ?? '—', mono: true },
              { label: 'Account', value: log.user?.email ?? 'Not a registered customer', mono: true },
              { label: 'Template', value: log.templateId ?? '—', mono: true, wrap: true },
            ],
          },
          {
            label: 'WHAT HAPPENED',
            fields: [
              { label: 'Queued', value: stamp(log.createdAt), mono: true },
              { label: 'Sent', value: log.sentAt ? stamp(log.sentAt) : '—', mono: true },
              { label: 'Opened', value: log.openedAt ? stamp(log.openedAt) : '—', mono: true },
              { label: 'Clicked', value: log.clickedAt ? stamp(log.clickedAt) : '—', mono: true },
              { label: 'Bounced', value: log.bouncedAt ? stamp(log.bouncedAt) : '—', mono: true },
              { label: 'Failed', value: log.failedAt ? stamp(log.failedAt) : '—', mono: true },
              { label: 'Error', value: log.errorMessage ?? '—', wrap: true },
            ],
          },
        ],
        actions: [
          ...(log.status === 'BOUNCED' || log.status === 'FAILED'
            ? [
                {
                  label: 'Suppress this address…',
                  shortcut: '⌘⏎',
                  command: form('suppression.create', {
                    title: `Suppress ${log.recipientEmail}`,
                    values: { email: log.recipientEmail, reason: 'HARD_BOUNCE', notes: textValue(log.errorMessage) },
                  }),
                },
              ]
            : []),
          { label: 'Campaigns', command: jump('email'), shortcut: '⌘⇧C' },
          { label: 'Suppressions', command: page('email.suppressions'), shortcut: '⌘S' },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} emails`),
      text(''),
      text(''),
      text(count(opened), { right: true }),
      text(count(clicked), { right: true }),
      text(failed ? `${count(failed)} failed` : '', { tone: failed ? 'bad' : 'muted' }),
      text(rows.length === list.limit ? `latest ${list.limit}` : '', { dim: true }),
    ],
  }
}

// ---------------------------------------------------------------------------
// Email · Brand kit
// ---------------------------------------------------------------------------

async function loadBrandKit(): Promise<SettingsPayload> {
  const [kit, templates, config] = await Promise.all([
    safe(() => prisma.brandKit.findFirst({ orderBy: { createdAt: 'asc' } }), null),
    safe(() => prisma.emailTemplate.count(), 0),
    safe(() => prisma.emailConfiguration.findFirst({ orderBy: { createdAt: 'asc' } }), null),
  ])

  const values: FormValues = {
    logoUrl: textValue(kit?.logoUrl),
    primaryColor: textValue(kit?.primaryColor),
    secondaryColor: textValue(kit?.secondaryColor),
    accentColor: textValue(kit?.accentColor),
    fontFamily: textValue(kit?.fontFamily),
    websiteUrl: textValue(kit?.websiteUrl),
    physicalAddress: textValue(kit?.physicalAddress),
  }

  const edit = form('settings.brand', { recordId: kit?.id, values })

  return {
    view: 'settings',
    groups: [
      {
        label: 'IDENTITY',
        rows: [
          { label: 'Logo', value: kit?.logoUrl ?? 'Not set', mono: Boolean(kit?.logoUrl), tone: kit?.logoUrl ? 'neutral' : 'warn' },
          { label: 'Website', value: kit?.websiteUrl ?? 'Not set', mono: true },
          { label: 'Font stack', value: kit?.fontFamily ?? 'Not set' },
        ],
        edit,
      },
      {
        label: 'PALETTE',
        rows: [
          { label: 'Primary', value: kit?.primaryColor ?? 'Not set', mono: true },
          { label: 'Secondary', value: kit?.secondaryColor ?? 'Not set', mono: true },
          { label: 'Accent', value: kit?.accentColor ?? 'Not set', mono: true },
        ],
        edit,
      },
      {
        label: 'COMPLIANCE',
        rows: [
          {
            label: 'Postal address',
            value: kit?.physicalAddress ?? 'Missing — CAN-SPAM requires one',
            tone: kit?.physicalAddress ? 'good' : 'bad',
          },
          { label: 'Templates using it', value: count(templates), mono: true },
          { label: 'Sending domain', value: config?.fromEmail ?? 'Not configured', mono: true },
        ],
        edit,
      },
    ],
    inspector: {
      title: 'Brand kit',
      tag: kit ? 'Saved' : 'Never set',
      tagTone: kit ? 'good' : 'warn',
      groups: [
        {
          label: 'WHAT THIS IS',
          fields: [
            {
              label: 'Purpose',
              value: 'The defaults every marketing email inherits when its template says nothing.',
              wrap: true,
            },
            { label: 'Last saved', value: kit ? stamp(kit.updatedAt) : '—', mono: true },
            { label: 'Email templates', value: count(templates), mono: true },
          ],
        },
      ],
      actions: [
        { label: 'Edit brand kit…', shortcut: '⌘⏎', command: edit },
        { label: 'Campaigns', command: jump('email'), shortcut: '⌘⇧C' },
      ],
    },
  }
}

// ---------------------------------------------------------------------------
// Social · Connected accounts
// ---------------------------------------------------------------------------

const SOCIAL_ACCOUNT_FILTERS = ['All accounts', 'Connected', 'Needs attention']

async function loadSocialAccounts(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const accounts = await safe(
    () =>
      prisma.socialAccount.findMany({
        orderBy: [{ isActive: 'desc' }, { platform: 'asc' }],
        take: list.limit,
        include: {
          _count: { select: { publishedPosts: true, shopListings: true } },
          publishedPosts: {
            orderBy: { publishedAt: 'desc' },
            take: 1,
            select: { publishedAt: true, reach: true, impressions: true },
          },
        },
      }),
    [],
  )

  const columns: Column[] = [
    { label: 'Account', width: 'minmax(0,1.7fr)' },
    { label: 'Platform', width: '150px' },
    { label: 'Handle', width: 'minmax(0,1.2fr)' },
    { label: 'Posts', width: '76px', right: true },
    { label: 'Listings', width: '84px', right: true },
    { label: 'Token', width: '124px' },
    { label: 'Status', width: '132px' },
  ]

  const now = Date.now()

  const rows: Row[] = accounts.map((account) => {
    const expired = account.tokenExpiresAt ? account.tokenExpiresAt.getTime() < now : false
    const healthy = account.isActive && !expired && !account.connectionError
    const latest = account.publishedPosts[0]

    return {
      id: account.id,
      open: page('social'),
      search: `${account.accountName} ${account.accountHandle ?? ''} ${humanise(account.platform)}`,
      buckets: [0, healthy ? 1 : 2],
      cells: [
        text(account.accountName, { strong: true }),
        text(humanise(account.platform), { dim: true }),
        text(account.accountHandle ? `@${account.accountHandle}` : '—', { mono: true, dim: true }),
        text(count(account._count.publishedPosts), { mono: true, right: true }),
        text(count(account._count.shopListings), { mono: true, right: true }),
        {
          text: account.tokenExpiresAt ? shortDate(account.tokenExpiresAt) : 'No expiry',
          mono: true,
          tone: expired ? 'bad' : 'muted',
        },
        statusCell(
          account.connectionError ? 'Error' : expired ? 'Token expired' : account.isActive ? 'Connected' : 'Disabled',
          account.connectionError || expired ? 'bad' : account.isActive ? 'good' : 'muted',
        ),
      ],
      inspector: {
        title: account.accountName,
        tag: humanise(account.platform),
        tagTone: healthy ? 'good' : 'bad',
        groups: [
          {
            label: 'ACCOUNT',
            fields: [
              { label: 'Platform', value: humanise(account.platform) },
              { label: 'Handle', value: account.accountHandle ? `@${account.accountHandle}` : '—', mono: true },
              { label: 'Account id', value: account.accountId, mono: true, wrap: true },
              { label: 'Connected', value: stamp(account.createdAt), mono: true },
              {
                label: 'Last verified',
                value: account.lastVerifiedAt ? stamp(account.lastVerifiedAt) : 'Never',
                mono: true,
              },
              { label: 'Scopes', value: account.scopes.join(', ') || '—', wrap: true },
            ],
          },
          {
            label: 'HEALTH',
            fields: [
              {
                label: 'Token expires',
                value: account.tokenExpiresAt ? stamp(account.tokenExpiresAt) : 'No expiry recorded',
                mono: true,
              },
              { label: 'Error', value: account.connectionError ?? 'None', wrap: true },
              { label: 'Posts published', value: count(account._count.publishedPosts), mono: true },
              { label: 'Shop listings', value: count(account._count.shopListings), mono: true },
              { label: 'Last post', value: latest?.publishedAt ? stamp(latest.publishedAt) : '—', mono: true },
              { label: 'Last reach', value: latest ? count(latest.reach) : '—', mono: true },
            ],
          },
        ],
        actions: [
          { label: 'Scheduled posts', command: jump('social'), shortcut: '⌘⏎' },
          { label: 'Reach', command: page('social.analytics'), shortcut: '⌘⇧A' },
          { label: 'Product feeds', command: page('social.feeds'), shortcut: '⌘F' },
          // Connecting an account is an OAuth round trip through the browser,
          // which a frameless window cannot complete on its own.
          { label: 'Connect an account…', command: link('/admin/social'), shortcut: '⌘N' },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} accounts`),
      text(''),
      text(''),
      text(count(accounts.reduce((sum, account) => sum + account._count.publishedPosts, 0)), { right: true }),
      text(count(accounts.reduce((sum, account) => sum + account._count.shopListings, 0)), { right: true }),
      text(''),
      text(''),
    ],
  }
}

// ---------------------------------------------------------------------------
// Social · Product feeds
// ---------------------------------------------------------------------------

const FEED_FILTERS = ['All listings', 'Live', 'Pending', 'Errors']

const LISTING_TONE: Record<string, Tone> = {
  PENDING: 'muted',
  SYNCING: 'warn',
  ACTIVE: 'good',
  PAUSED: 'muted',
  REJECTED: 'bad',
  ERROR: 'bad',
}

async function loadFeeds(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const listings = await safe(
    () =>
      prisma.shopListing.findMany({
        orderBy: [{ shopPlatform: 'asc' }, { updatedAt: 'desc' }],
        take: list.limit,
        include: {
          product: { select: { name: true, sku: true, price: true, isActive: true } },
          socialAccount: { select: { accountName: true } },
        },
      }),
    [],
  )

  const columns: Column[] = [
    { label: 'Product', width: 'minmax(0,1.8fr)' },
    { label: 'Platform', width: '166px' },
    { label: 'Account', width: 'minmax(0,1.1fr)' },
    { label: 'Price', width: '88px', right: true },
    { label: 'Synced', width: '104px' },
    { label: 'Status', width: '118px' },
    { label: 'Problem', width: 'minmax(0,1.3fr)' },
  ]

  const platforms = new Set<string>()
  let live = 0

  const rows: Row[] = listings.map((listing) => {
    platforms.add(listing.shopPlatform)
    if (listing.status === 'ACTIVE') live += 1

    const price = listing.priceOverride ?? listing.product.price

    const buckets = [0]
    if (listing.status === 'ACTIVE') buckets.push(1)
    if (listing.status === 'PENDING' || listing.status === 'SYNCING') buckets.push(2)
    if (listing.status === 'ERROR' || listing.status === 'REJECTED') buckets.push(3)

    return {
      id: listing.id,
      open: listing.externalUrl ? link(listing.externalUrl) : jump('products'),
      search: `${listing.product.name} ${listing.product.sku} ${humanise(listing.shopPlatform)}`,
      buckets,
      cells: [
        text(listing.titleOverride ?? listing.product.name, { strong: true }),
        text(humanise(listing.shopPlatform), { dim: true }),
        text(listing.socialAccount?.accountName ?? '—', { dim: true }),
        text(money(price), { mono: true, right: true }),
        text(listing.lastSyncedAt ? shortDate(listing.lastSyncedAt) : 'Never', {
          mono: true,
          dim: !listing.lastSyncedAt,
        }),
        statusCell(humanise(listing.status), LISTING_TONE[listing.status] ?? 'neutral'),
        text(excerpt(listing.syncError, 70) || '—', { dim: true, tone: listing.syncError ? 'bad' : undefined }),
      ],
      inspector: {
        title: listing.titleOverride ?? listing.product.name,
        tag: humanise(listing.shopPlatform),
        tagTone: LISTING_TONE[listing.status] ?? 'neutral',
        groups: [
          {
            label: 'LISTING',
            fields: [
              { label: 'SKU', value: listing.product.sku, mono: true },
              { label: 'Catalogue price', value: money(listing.product.price), mono: true },
              {
                label: 'Listed price',
                value: listing.priceOverride ? money(listing.priceOverride) : 'Same as catalogue',
                mono: true,
              },
              { label: 'Condition', value: listing.condition ?? '—' },
              { label: 'Availability', value: listing.availability ?? '—' },
              { label: 'Category', value: listing.marketplaceCategory ?? '—' },
              { label: 'Product active', value: listing.product.isActive ? 'Yes' : 'No' },
            ],
          },
          {
            label: 'SYNC',
            fields: [
              { label: 'Status', value: humanise(listing.status) },
              { label: 'External id', value: listing.externalId ?? '—', mono: true, wrap: true },
              { label: 'Catalogue id', value: listing.catalogId ?? '—', mono: true, wrap: true },
              {
                label: 'Last synced',
                value: listing.lastSyncedAt ? stamp(listing.lastSyncedAt) : 'Never',
                mono: true,
              },
              { label: 'Published', value: listing.publishedAt ? stamp(listing.publishedAt) : '—', mono: true },
              { label: 'Error', value: listing.syncError ?? 'None', wrap: true },
            ],
          },
        ],
        actions: [
          ...(listing.externalUrl
            ? [{ label: 'View the listing…', shortcut: '⌘O', command: link(listing.externalUrl) }]
            : []),
          { label: 'Products', command: jump('products'), shortcut: '⌘⇧P' },
          { label: 'Connected accounts', command: page('social.accounts'), shortcut: '⌘⇧A' },
          // The feed run is a long streaming job with its own progress UI.
          { label: 'Run a feed sync…', command: link('/admin/feeds'), shortcut: '⌘⇧B' },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} listings`),
      text(`${count(platforms.size)} platforms`, { dim: true }),
      text(''),
      text(''),
      text(''),
      text(`${count(live)} live`, { tone: 'good' }),
      text(''),
    ],
  }
}

// ---------------------------------------------------------------------------
// Social · Reach
// ---------------------------------------------------------------------------

const REACH_FILTERS = ['All published', 'Facebook', 'Instagram', 'Other']

async function loadSocialReach(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const publishes = await safe(
    () =>
      prisma.socialPostPublish.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { publishedAt: 'desc' },
        take: list.limit,
        include: {
          account: { select: { accountName: true } },
          post: { select: { content: true, hashtags: true, linkUrl: true } },
        },
      }),
    [],
  )

  const columns: Column[] = [
    { label: 'Post', width: 'minmax(0,2.2fr)' },
    { label: 'Account', width: 'minmax(0,1.1fr)' },
    { label: 'Platform', width: '140px' },
    { label: 'Reach', width: '88px', right: true },
    { label: 'Impressions', width: '104px', right: true },
    { label: 'Engagement', width: '104px', right: true },
    { label: 'Clicks', width: '80px', right: true },
    { label: 'Published', width: '110px' },
  ]

  let reach = 0
  let impressions = 0
  let engagement = 0
  let clicks = 0

  const rows: Row[] = publishes.map((publish) => {
    const interactions = publish.likes + publish.comments + publish.shares
    reach += publish.reach
    impressions += publish.impressions
    engagement += interactions
    clicks += publish.clicks

    // Engagement rate is against reach, not impressions: a person who saw the
    // post three times is still one person who could have liked it.
    const rate = publish.reach > 0 ? interactions / publish.reach : 0

    const buckets = [0]
    if (publish.platform === 'FACEBOOK') buckets.push(1)
    else if (publish.platform === 'INSTAGRAM') buckets.push(2)
    else buckets.push(3)

    return {
      id: publish.id,
      open: publish.externalUrl ? link(publish.externalUrl) : jump('social'),
      search: `${publish.post.content} ${publish.account.accountName} ${humanise(publish.platform)}`,
      buckets,
      cells: [
        text(excerpt(publish.post.content, 78), { strong: true }),
        text(publish.account.accountName, { dim: true }),
        text(humanise(publish.platform), { dim: true }),
        text(count(publish.reach), { mono: true, right: true, strong: true }),
        text(count(publish.impressions), { mono: true, right: true, dim: true }),
        {
          text: `${count(interactions)} · ${percent(rate * 100, 1)}`,
          mono: true,
          right: true,
          tone: rate >= 0.05 ? 'good' : rate >= 0.02 ? 'warn' : 'muted',
        },
        text(count(publish.clicks), { mono: true, right: true }),
        text(publish.publishedAt ? stamp(publish.publishedAt) : '—', { mono: true, dim: true }),
      ],
      inspector: {
        title: excerpt(publish.post.content, 60),
        tag: humanise(publish.platform),
        tagTone: 'accent',
        groups: [
          {
            label: 'POST',
            fields: [
              { label: 'Account', value: publish.account.accountName },
              { label: 'Published', value: publish.publishedAt ? stamp(publish.publishedAt) : '—', mono: true },
              { label: 'Link', value: publish.post.linkUrl ?? '—', wrap: true },
              {
                label: 'Hashtags',
                value: publish.post.hashtags.length ? publish.post.hashtags.join(' ') : '—',
                wrap: true,
              },
              { label: 'Copy', value: publish.post.content, wrap: true },
            ],
          },
          {
            label: 'PERFORMANCE',
            fields: [
              { label: 'Reach', value: count(publish.reach), mono: true, strong: true },
              { label: 'Impressions', value: count(publish.impressions), mono: true },
              { label: 'Likes', value: count(publish.likes), mono: true },
              { label: 'Comments', value: count(publish.comments), mono: true },
              { label: 'Shares', value: count(publish.shares), mono: true },
              { label: 'Clicks', value: count(publish.clicks), mono: true },
              { label: 'Engagement rate', value: percent(rate * 100, 2), mono: true },
              {
                label: 'Metrics updated',
                value: publish.metricsUpdatedAt ? stamp(publish.metricsUpdatedAt) : 'Never',
                mono: true,
              },
            ],
          },
        ],
        actions: [
          ...(publish.externalUrl
            ? [{ label: 'Open the post…', shortcut: '⌘O', command: link(publish.externalUrl) }]
            : []),
          { label: 'Scheduled posts', command: jump('social'), shortcut: '⌘⏎' },
          { label: 'Connected accounts', command: page('social.accounts'), shortcut: '⌘⇧A' },
        ],
      },
    }
  })

  const rate = reach > 0 ? engagement / reach : 0

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} published`),
      text(''),
      text(''),
      text(count(reach), { right: true, strong: true }),
      text(count(impressions), { right: true }),
      text(`${count(engagement)} · ${percent(rate * 100, 1)}`, { right: true }),
      text(count(clicks), { right: true }),
      text(''),
    ],
  }
}


// ---------------------------------------------------------------------------
// Content · Pages
// ---------------------------------------------------------------------------

const CMS_PAGE_FILTERS = ['All pages', 'Published', 'Scheduled', 'Drafts']

/** The values a page's edit sheet opens with, shared by the row and the button. */
function cmsPageValues(record: {
  title: string
  slug: string
  kind: string
  status: string
  scheduledFor: Date | null
  canonicalUrl: string | null
  seoTitle: string | null
  seoDescription: string | null
  noIndex: boolean
}): FormValues {
  return {
    title: record.title,
    slug: record.slug,
    kind: record.kind,
    status: record.status,
    scheduledFor: instantValue(record.scheduledFor),
    canonicalUrl: textValue(record.canonicalUrl),
    seoTitle: textValue(record.seoTitle),
    seoDescription: textValue(record.seoDescription),
    noIndex: record.noIndex,
  }
}

async function loadCmsPages(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const pages = await safe(
    () =>
      prisma.page.findMany({
        orderBy: { updatedAt: 'desc' },
        take: list.limit,
        include: { _count: { select: { sections: true } } },
      }),
    [],
  )

  const columns: Column[] = [
    { label: 'Title', width: 'minmax(0,1.8fr)' },
    { label: 'Path', width: 'minmax(0,1.4fr)' },
    { label: 'Kind', width: '96px' },
    { label: 'Blocks', width: '76px', right: true },
    { label: 'Meta title', width: '104px', right: true },
    { label: 'Meta desc.', width: '108px', right: true },
    { label: 'Indexed', width: '92px' },
    { label: 'Status', width: '108px' },
    { label: 'Updated', width: '100px' },
  ]

  let noindexed = 0
  let overLength = 0

  const rows: Row[] = pages.map((record) => {
    // The two numbers Google actually shows, measured on the effective values
    // rather than the override alone — an empty SEO title still ships the page
    // title, and that is what has to fit.
    const metaTitle = (record.seoTitle ?? record.title).length
    const metaDescription = (record.seoDescription ?? '').length
    if (record.noIndex) noindexed += 1
    if (metaTitle > SEO_TITLE_MAX || metaDescription > SEO_DESCRIPTION_MAX) overLength += 1

    const values = cmsPageValues(record)

    const buckets = [0]
    if (record.status === 'PUBLISHED') buckets.push(1)
    if (record.status === 'SCHEDULED') buckets.push(2)
    if (record.status === 'DRAFT') buckets.push(3)

    return {
      id: record.id,
      open: form('page.edit', { recordId: record.id, title: record.title, values }),
      search: `${record.title} ${record.slug} ${humanise(record.status)}`,
      buckets,
      cells: [
        text(record.title, { strong: true }),
        text(`/${record.slug}`, { mono: true, dim: true }),
        text(humanise(record.kind), { dim: true }),
        text(count(record._count.sections), { mono: true, right: true }),
        {
          text: `${metaTitle}`,
          mono: true,
          right: true,
          tone: metaTitle > SEO_TITLE_MAX ? 'bad' : metaTitle < 30 ? 'warn' : 'good',
        },
        {
          text: metaDescription ? `${metaDescription}` : '—',
          mono: true,
          right: true,
          tone: metaDescription > SEO_DESCRIPTION_MAX ? 'bad' : metaDescription ? 'good' : 'warn',
        },
        statusCell(record.noIndex ? 'noindex' : 'Indexed', record.noIndex ? 'warn' : 'good'),
        statusCell(humanise(record.status), CONTENT_TONE[record.status] ?? 'neutral'),
        text(shortDate(record.updatedAt), { mono: true, dim: true }),
      ],
      inspector: {
        title: record.title,
        tag: humanise(record.status),
        tagTone: CONTENT_TONE[record.status] ?? 'neutral',
        groups: [
          {
            label: 'PAGE',
            fields: [
              { label: 'Path', value: `/${record.slug}`, mono: true },
              { label: 'Kind', value: humanise(record.kind) },
              { label: 'Blocks', value: count(record._count.sections), mono: true },
              { label: 'Published', value: record.publishedAt ? stamp(record.publishedAt) : '—', mono: true },
              {
                label: 'Scheduled',
                value: record.scheduledFor ? stamp(record.scheduledFor) : '—',
                mono: true,
              },
              { label: 'Updated', value: stamp(record.updatedAt), mono: true },
            ],
          },
          {
            label: 'SEARCH',
            fields: [
              {
                label: `Meta title (${metaTitle})`,
                value: record.seoTitle ?? `${record.title} — from the page title`,
                wrap: true,
              },
              {
                label: `Meta description (${metaDescription})`,
                value: record.seoDescription ?? 'Not set — Google will pick its own',
                wrap: true,
              },
              { label: 'Canonical', value: record.canonicalUrl ?? 'Itself', mono: true, wrap: true },
              {
                label: 'Crawlable',
                value: record.noIndex ? 'No — noindex is set' : 'Yes',
                strong: record.noIndex,
              },
              {
                label: 'Sitemap',
                value: 'Registered from Prisma in app/sitemap.ts',
                wrap: true,
              },
            ],
          },
        ],
        actions: [
          {
            label: 'Edit page…',
            shortcut: '⌘⏎',
            command: form('page.edit', { recordId: record.id, title: record.title, values }),
          },
          ...(record.status === 'PUBLISHED'
            ? []
            : [
                {
                  label: 'Publish',
                  shortcut: '⌘⇧P',
                  command: write('page.publish', record.id, {
                    confirm: `Publish ${record.title}? It goes live at /${record.slug} straight away.`,
                    success: `${record.title} is live`,
                  }),
                },
              ]),
          { label: 'View on the storefront…', shortcut: '⌘O', command: link(`/${record.slug}`) },
          {
            label: 'Delete page',
            danger: true,
            command: write('page.delete', record.id, {
              confirm: `Delete ${record.title}? A live page is better redirected than deleted — Google keeps the old URL either way.`,
              danger: true,
            }),
          },
          { label: 'Redirects', command: page('content.redirects'), shortcut: '⌘⇧B' },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} pages`),
      text(''),
      text(''),
      text(''),
      text(overLength ? `${count(overLength)} over length` : '', { tone: overLength ? 'bad' : 'muted' }),
      text(''),
      text(noindexed ? `${count(noindexed)} noindex` : '', { tone: noindexed ? 'warn' : 'muted' }),
      text(''),
      text(''),
    ],
  }
}

// ---------------------------------------------------------------------------
// Content · Banners
// ---------------------------------------------------------------------------

const BANNER_FILTERS = ['All banners', 'Live now', 'Scheduled', 'Drafts']

async function loadBanners(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const banners = await safe(
    () =>
      prisma.banner.findMany({
        orderBy: [{ placement: 'asc' }, { priority: 'desc' }, { updatedAt: 'desc' }],
        take: list.limit,
      }),
    [],
  )

  const columns: Column[] = [
    { label: 'Banner', width: 'minmax(0,1.5fr)' },
    { label: 'Headline', width: 'minmax(0,1.8fr)' },
    { label: 'Placement', width: '150px' },
    { label: 'Window', width: 'minmax(0,1.2fr)' },
    { label: 'Priority', width: '84px', right: true },
    { label: 'Status', width: '108px' },
  ]

  const now = new Date()
  let live = 0

  const rows: Row[] = banners.map((banner) => {
    // "Live" is the status *and* the dates agreeing — a published banner whose
    // window closed yesterday is not on the site, and should not read as if it is.
    const inWindow =
      (!banner.startsAt || banner.startsAt <= now) && (!banner.endsAt || banner.endsAt >= now)
    const showing = banner.status === 'PUBLISHED' && inWindow
    if (showing) live += 1

    const values: FormValues = {
      name: banner.name,
      placement: banner.placement,
      status: banner.status,
      headline: textValue(banner.headline),
      body: textValue(banner.body),
      ctaText: textValue(banner.ctaText),
      ctaHref: textValue(banner.ctaHref),
      imageUrl: textValue(banner.imageUrl),
      startsAt: instantValue(banner.startsAt),
      endsAt: instantValue(banner.endsAt),
      priority: banner.priority,
    }

    const window =
      banner.startsAt || banner.endsAt
        ? `${banner.startsAt ? shortDate(banner.startsAt) : 'now'} → ${
            banner.endsAt ? shortDate(banner.endsAt) : 'open'
          }`
        : 'Always'

    const buckets = [0]
    if (showing) buckets.push(1)
    if (banner.status === 'PUBLISHED' && !inWindow) buckets.push(2)
    if (banner.status === 'DRAFT') buckets.push(3)

    return {
      id: banner.id,
      open: form('banner.edit', { recordId: banner.id, title: banner.name, values }),
      search: `${banner.name} ${banner.headline ?? ''} ${humanise(banner.placement)}`,
      buckets,
      cells: [
        text(banner.name, { strong: true }),
        text(excerpt(banner.headline, 66) || '—', { dim: true }),
        text(humanise(banner.placement), { dim: true }),
        text(window, { mono: true, dim: true }),
        text(count(banner.priority), { mono: true, right: true }),
        statusCell(
          showing ? 'Showing' : humanise(banner.status),
          showing ? 'good' : CONTENT_TONE[banner.status] ?? 'neutral',
        ),
      ],
      inspector: {
        title: banner.name,
        tag: showing ? 'Showing' : humanise(banner.status),
        tagTone: showing ? 'good' : CONTENT_TONE[banner.status] ?? 'neutral',
        groups: [
          {
            label: 'BANNER',
            fields: [
              { label: 'Placement', value: humanise(banner.placement) },
              { label: 'Headline', value: banner.headline ?? '—', wrap: true },
              { label: 'Body', value: banner.body ?? '—', wrap: true },
              { label: 'Button', value: banner.ctaText ?? '—' },
              { label: 'Button link', value: banner.ctaHref ?? '—', mono: true, wrap: true },
              { label: 'Image', value: banner.imageUrl ?? '—', mono: true, wrap: true },
            ],
          },
          {
            label: 'WHEN & WHERE',
            fields: [
              { label: 'Starts', value: banner.startsAt ? stamp(banner.startsAt) : 'Immediately', mono: true },
              { label: 'Ends', value: banner.endsAt ? stamp(banner.endsAt) : 'Never', mono: true },
              { label: 'In its window', value: inWindow ? 'Yes' : 'No', strong: !inWindow },
              { label: 'Priority', value: count(banner.priority), mono: true },
              {
                label: 'Paths',
                value: banner.targetPaths.length ? banner.targetPaths.join(', ') : 'Every page',
                wrap: true,
              },
            ],
          },
        ],
        actions: [
          {
            label: 'Edit banner…',
            shortcut: '⌘⏎',
            command: form('banner.edit', { recordId: banner.id, title: banner.name, values }),
          },
          {
            label: 'Delete banner',
            danger: true,
            command: write('banner.delete', banner.id, {
              confirm: `Delete ${banner.name}?`,
              danger: true,
            }),
          },
          { label: 'Pages', command: page('content.pages'), shortcut: '⌘⇧P' },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} banners`),
      text(''),
      text(''),
      text(''),
      text(''),
      text(`${count(live)} showing`, { tone: live ? 'good' : 'muted' }),
    ],
  }
}

// ---------------------------------------------------------------------------
// Content · FAQs
// ---------------------------------------------------------------------------

const FAQ_FILTERS = ['All FAQs', 'Published', 'Drafts']

async function loadFaqs(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const faqs = await safe(
    () =>
      prisma.faqItem.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        take: list.limit,
        include: { category: { select: { name: true } } },
      }),
    [],
  )

  const columns: Column[] = [
    { label: 'Question', width: 'minmax(0,2.2fr)' },
    { label: 'Answer', width: 'minmax(0,2.2fr)' },
    { label: 'Category', width: 'minmax(0,1fr)' },
    { label: 'Order', width: '78px', right: true },
    { label: 'Status', width: '108px' },
  ]

  const rows: Row[] = faqs.map((faq) => {
    const values: FormValues = {
      question: faq.question,
      answer: faq.answer,
      status: faq.status,
      sortOrder: faq.sortOrder,
    }

    const buckets = [0]
    if (faq.status === 'PUBLISHED') buckets.push(1)
    if (faq.status === 'DRAFT') buckets.push(2)

    return {
      id: faq.id,
      open: form('faq.edit', { recordId: faq.id, title: excerpt(faq.question, 48), values }),
      search: `${faq.question} ${faq.answer} ${faq.category?.name ?? ''}`,
      buckets,
      cells: [
        text(faq.question, { strong: true }),
        text(excerpt(faq.answer, 90), { dim: true }),
        text(faq.category?.name ?? 'Uncategorised', { dim: !faq.category }),
        text(count(faq.sortOrder), { mono: true, right: true }),
        statusCell(humanise(faq.status), CONTENT_TONE[faq.status] ?? 'neutral'),
      ],
      inspector: {
        title: excerpt(faq.question, 60),
        tag: humanise(faq.status),
        tagTone: CONTENT_TONE[faq.status] ?? 'neutral',
        groups: [
          {
            label: 'QUESTION',
            fields: [
              { label: 'Question', value: faq.question, wrap: true },
              { label: 'Answer', value: faq.answer, wrap: true },
            ],
          },
          {
            label: 'PLACEMENT',
            fields: [
              { label: 'Category', value: faq.category?.name ?? 'Uncategorised' },
              { label: 'Sort order', value: count(faq.sortOrder), mono: true },
              { label: 'Added', value: shortDate(faq.createdAt), mono: true },
              { label: 'Updated', value: shortDate(faq.updatedAt), mono: true },
            ],
          },
        ],
        actions: [
          {
            label: 'Edit FAQ…',
            shortcut: '⌘⏎',
            command: form('faq.edit', { recordId: faq.id, title: excerpt(faq.question, 48), values }),
          },
          {
            label: 'Delete FAQ',
            danger: true,
            command: write('faq.delete', faq.id, {
              confirm: `Delete “${excerpt(faq.question, 60)}”?`,
              danger: true,
            }),
          },
          { label: 'Pages', command: page('content.pages'), shortcut: '⌘⇧P' },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} questions`),
      text(''),
      text(''),
      text(''),
      text(''),
    ],
  }
}

// ---------------------------------------------------------------------------
// Customers · Loyalty rewards
// ---------------------------------------------------------------------------

const REWARD_FILTERS = ['All rewards', 'Active', 'Off', 'Never redeemed']

async function loadLoyaltyRewards(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const rewards = await safe(
    () =>
      prisma.loyaltyReward.findMany({
        orderBy: [{ isActive: 'desc' }, { pointsCost: 'asc' }],
        take: list.limit,
        include: { _count: { select: { redemptions: true } } },
      }),
    [],
  )

  const columns: Column[] = [
    { label: 'Reward', width: 'minmax(0,1.6fr)' },
    { label: 'Points', width: '90px', right: true },
    { label: 'Discount', width: '96px', right: true },
    { label: 'Return', width: '82px', right: true },
    { label: 'Tier', width: '96px' },
    { label: 'Redeemed', width: '96px', right: true },
    { label: 'Status', width: '96px' },
  ]

  let redeemed = 0

  const rows: Row[] = rewards.map((reward) => {
    const value = toNumber(reward.rewardValue ?? 0)
    const back = rewardReturnPercent(reward.pointsCost, value, POINTS_PER_DOLLAR)
    const redemptions = reward._count.redemptions
    redeemed += reward.usedCount
    const redeemable = reward.rewardType === 'DISCOUNT'

    const values: FormValues = {
      name: reward.name,
      description: reward.description,
      pointsCost: numberValue(reward.pointsCost),
      rewardValue: moneyValue(reward.rewardValue),
      minimumTier: reward.minimumTier,
      maxRedemptions: numberValue(reward.maxRedemptions),
      isActive: reward.isActive,
    }
    const edit = form('reward.edit', { recordId: reward.id, title: reward.name, values })

    const buckets = [0, reward.isActive ? 1 : 2]
    if (reward.usedCount === 0) buckets.push(3)

    return {
      id: reward.id,
      open: edit,
      search: `${reward.name} ${reward.description} ${reward.minimumTier}`,
      buckets,
      cells: [
        text(reward.name, { strong: true }),
        text(count(reward.pointsCost), { mono: true, right: true }),
        text(money(value), { mono: true, right: true }),
        text(`${back.toFixed(1)}%`, { mono: true, right: true }),
        text(humanise(reward.minimumTier)),
        text(reward.maxRedemptions ? `${count(reward.usedCount)} / ${count(reward.maxRedemptions)}` : count(reward.usedCount), {
          mono: true,
          right: true,
        }),
        !redeemable
          ? statusCell('Not redeemable', 'bad')
          : statusCell(reward.isActive ? 'Active' : 'Off', reward.isActive ? 'good' : 'muted'),
      ],
      inspector: {
        title: reward.name,
        tag: `${humanise(reward.minimumTier)} and up`,
        tagTone: reward.isActive ? 'good' : 'muted',
        groups: [
          {
            label: 'REWARD',
            fields: [
              { label: 'Description', value: reward.description, wrap: true },
              { label: 'Costs', value: `${count(reward.pointsCost)} points`, mono: true, strong: true },
              { label: 'Gives', value: `${money(value)} off, single-use code`, mono: true },
              {
                label: 'Return',
                value: `${back.toFixed(1)}% of what the customer spent to earn it`,
                wrap: true,
              },
              ...(redeemable
                ? []
                : [{ label: 'Problem', value: 'Not a discount reward — checkout cannot honour it. Edit and save it.', wrap: true }]),
            ],
          },
          {
            label: 'USE',
            fields: [
              { label: 'Redeemed', value: count(reward.usedCount), mono: true },
              { label: 'Limit', value: reward.maxRedemptions ? count(reward.maxRedemptions) : 'Unlimited', mono: true },
              { label: 'Active', value: reward.isActive ? 'Yes' : 'No' },
              { label: 'Created', value: shortDate(reward.createdAt), mono: true },
            ],
          },
        ],
        actions: [
          { label: 'Edit reward…', shortcut: '⌘⏎', command: edit },
          {
            label: reward.isActive ? 'Turn off' : 'Turn on',
            shortcut: '⌘T',
            command: write('reward.toggle', reward.id),
          },
          ...(redemptions === 0
            ? [
                {
                  label: 'Delete reward',
                  danger: true,
                  command: write('reward.delete', reward.id, {
                    confirm: `Delete the ${reward.name} reward? Nobody has redeemed it, so nothing else changes.`,
                    danger: true,
                  }),
                },
              ]
            : []),
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} rewards`),
      text(''),
      text(''),
      text(''),
      text(''),
      text(count(redeemed), { right: true, strong: true }),
      text(''),
    ],
  }
}

// ---------------------------------------------------------------------------
// Content · Redirects
// ---------------------------------------------------------------------------

const REDIRECT_FILTERS = ['All redirects', 'Active', 'Off', 'Never hit']

async function loadRedirects(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const redirects = await safe(
    () => prisma.redirect.findMany({ orderBy: [{ isActive: 'desc' }, { hitCount: 'desc' }], take: list.limit }),
    [],
  )

  const columns: Column[] = [
    { label: 'From', width: 'minmax(0,1.8fr)' },
    { label: 'To', width: 'minmax(0,1.8fr)' },
    { label: 'Kind', width: '96px' },
    { label: 'Hits', width: '78px', right: true },
    { label: 'Last hit', width: '108px' },
    { label: 'Status', width: '96px' },
    { label: 'Note', width: 'minmax(0,1.2fr)' },
  ]

  let hits = 0

  const rows: Row[] = redirects.map((redirect) => {
    hits += redirect.hitCount

    const values: FormValues = {
      source: redirect.source,
      destination: redirect.destination,
      permanent: redirect.permanent,
      isActive: redirect.isActive,
      note: textValue(redirect.note),
    }

    const buckets = [0, redirect.isActive ? 1 : 2]
    if (redirect.hitCount === 0) buckets.push(3)

    return {
      id: redirect.id,
      open: form('redirect.edit', { recordId: redirect.id, title: redirect.source, values }),
      search: `${redirect.source} ${redirect.destination} ${redirect.note ?? ''}`,
      buckets,
      cells: [
        text(redirect.source, { mono: true, strong: true }),
        text(redirect.destination, { mono: true, dim: true }),
        text(redirect.permanent ? '301' : '302', { mono: true }),
        text(count(redirect.hitCount), { mono: true, right: true }),
        text(redirect.lastHitAt ? shortDate(redirect.lastHitAt) : 'Never', {
          mono: true,
          dim: !redirect.lastHitAt,
        }),
        statusCell(redirect.isActive ? 'Active' : 'Off', redirect.isActive ? 'good' : 'muted'),
        text(excerpt(redirect.note, 60) || '—', { dim: true }),
      ],
      inspector: {
        title: redirect.source,
        tag: redirect.permanent ? 'Permanent · 301' : 'Temporary · 302',
        tagTone: redirect.isActive ? 'good' : 'muted',
        groups: [
          {
            label: 'REDIRECT',
            fields: [
              { label: 'From', value: redirect.source, mono: true, wrap: true },
              { label: 'To', value: redirect.destination, mono: true, wrap: true },
              {
                label: 'Kind',
                value: redirect.permanent
                  ? '301 — Google drops the old URL'
                  : '302 — Google keeps the old URL indexed',
                wrap: true,
              },
              { label: 'Active', value: redirect.isActive ? 'Yes' : 'No' },
              { label: 'Note', value: redirect.note ?? '—', wrap: true },
            ],
          },
          {
            label: 'TRAFFIC',
            fields: [
              { label: 'Hits', value: count(redirect.hitCount), mono: true, strong: true },
              { label: 'Last hit', value: redirect.lastHitAt ? stamp(redirect.lastHitAt) : 'Never', mono: true },
              { label: 'Created', value: shortDate(redirect.createdAt), mono: true },
            ],
          },
        ],
        actions: [
          {
            label: 'Edit redirect…',
            shortcut: '⌘⏎',
            command: form('redirect.edit', { recordId: redirect.id, title: redirect.source, values }),
          },
          {
            label: redirect.isActive ? 'Turn off' : 'Turn on',
            shortcut: '⌘T',
            command: write('redirect.toggle', redirect.id),
          },
          {
            label: 'Delete redirect',
            danger: true,
            command: write('redirect.delete', redirect.id, {
              confirm: `Delete the redirect from ${redirect.source}? Anyone following an old link gets a 404 instead.`,
              danger: true,
            }),
          },
          { label: 'Pages', command: page('content.pages'), shortcut: '⌘⇧P' },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} redirects`),
      text(''),
      text(''),
      text(count(hits), { right: true, strong: true }),
      text(''),
      text(''),
      text(''),
    ],
  }
}

// ---------------------------------------------------------------------------
// Content · SEO
// ---------------------------------------------------------------------------

async function loadSeo(): Promise<SettingsPayload> {
  const [config, structured, publishedPosts, publishedPages, redirects, noIndexed] = await Promise.all([
    safe(() => prisma.seoConfiguration.findFirst({ orderBy: { createdAt: 'asc' } }), null),
    safe(() => prisma.structuredData.count(), 0),
    safe(() => prisma.blogPost.count({ where: { status: 'PUBLISHED' } }), 0),
    safe(() => prisma.page.count({ where: { status: 'PUBLISHED' } }), 0),
    safe(() => prisma.redirect.count({ where: { isActive: true } }), 0),
    safe(() => prisma.page.count({ where: { noIndex: true } }), 0),
  ])

  const values: FormValues = {
    siteName: textValue(config?.siteName),
    siteUrl: textValue(config?.siteUrl),
    siteDescription: textValue(config?.siteDescription),
    twitterHandle: textValue(config?.twitterHandle),
    defaultOgImage: textValue(config?.defaultOgImage),
    robotsTxt: textValue(config?.robotsTxt),
  }

  const edit = form('settings.seo', { recordId: config?.id, values })
  const descriptionLength = config?.siteDescription.length ?? 0

  return {
    view: 'settings',
    groups: [
      {
        label: 'SITE',
        rows: [
          { label: 'Site name', value: config?.siteName ?? 'Not set', tone: config ? 'neutral' : 'warn' },
          { label: 'Site URL', value: config?.siteUrl ?? 'Not set', mono: true },
          {
            label: `Description (${descriptionLength})`,
            value: config?.siteDescription ?? 'Not set',
            tone: descriptionLength > SEO_DESCRIPTION_MAX ? 'bad' : 'neutral',
          },
          { label: 'X / Twitter', value: config?.twitterHandle ?? '—', mono: true },
          { label: 'Default OG image', value: config?.defaultOgImage ?? 'Not set', mono: true },
        ],
        edit,
      },
      {
        label: 'CRAWLING',
        rows: [
          {
            label: 'robots.txt',
            value: config?.robotsTxt ? 'Custom rules set' : 'Built-in rules (app/robots.ts)',
            tone: config?.robotsTxt ? 'warn' : 'good',
          },
          { label: 'Pages kept out with noindex', value: count(noIndexed), mono: true },
          { label: 'Active redirects', value: count(redirects), mono: true },
          {
            label: 'Search Console',
            value: config?.gscProperty ?? 'No property recorded',
            mono: Boolean(config?.gscProperty),
          },
        ],
        edit,
      },
      {
        label: 'WHAT IS INDEXABLE',
        rows: [
          { label: 'Published pages', value: count(publishedPages), mono: true },
          { label: 'Published articles', value: count(publishedPosts), mono: true },
          { label: 'Structured-data blocks', value: count(structured), mono: true },
          { label: 'Sitemap', value: 'app/sitemap.ts, built from Prisma', mono: true },
        ],
      },
    ],
    inspector: {
      title: 'Search settings',
      tag: config ? 'Configured' : 'Never set',
      tagTone: config ? 'good' : 'warn',
      groups: [
        {
          label: 'READ THIS FIRST',
          fields: [
            {
              label: 'robots vs noindex',
              value:
                'A tree blocked in robots.txt is never crawled, so a noindex tag inside it is never read. They are not interchangeable.',
              wrap: true,
            },
            {
              label: 'Handed off',
              value:
                'URL Inspection, Removals and Change of Address are Search Console jobs. No account here can run them.',
              wrap: true,
            },
          ],
        },
        {
          label: 'BUDGETS',
          fields: [
            { label: 'Meta title', value: `30–${SEO_TITLE_MAX} characters`, mono: true },
            { label: 'Meta description', value: `${SEO_DESCRIPTION_MAX} characters at most`, mono: true },
          ],
        },
      ],
      actions: [
        { label: 'Edit search settings…', shortcut: '⌘⏎', command: edit },
        { label: 'Pages', command: page('content.pages'), shortcut: '⌘⇧P' },
        { label: 'Redirects', command: page('content.redirects'), shortcut: '⌘⇧B' },
      ],
    },
  }
}

// ---------------------------------------------------------------------------
// Leads · Campaigns
// ---------------------------------------------------------------------------

const LEAD_CAMPAIGN_FILTERS = ['All campaigns', 'Running', 'Finished', 'Failed']

const LEAD_CAMPAIGN_TONE: Record<string, Tone> = {
  DRAFT: 'muted',
  SCRAPING: 'warn',
  SCRAPE_COMPLETED: 'accent',
  PARSING_CONTACTS: 'warn',
  PARSING_COMPLETED: 'accent',
  SENDING_EMAILS: 'warn',
  COMPLETED: 'good',
  FAILED: 'bad',
}

const LEAD_CAMPAIGN_RUNNING = ['SCRAPING', 'PARSING_CONTACTS', 'SENDING_EMAILS']

async function loadLeadCampaigns(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const campaigns = await safe(
    () =>
      prisma.leadCampaign.findMany({
        orderBy: { createdAt: 'desc' },
        take: list.limit,
        include: {
          template: { select: { name: true } },
          _count: { select: { leads: true } },
        },
      }),
    [],
  )

  const columns: Column[] = [
    { label: 'Campaign', width: 'minmax(0,1.8fr)' },
    { label: 'Looking for', width: 'minmax(0,1.3fr)' },
    { label: 'Where', width: 'minmax(0,1.1fr)' },
    { label: 'Found', width: '80px', right: true },
    { label: 'Emails', width: '82px', right: true },
    { label: 'Sent', width: '78px', right: true },
    { label: 'Failed', width: '78px', right: true },
    { label: 'Status', width: '140px' },
  ]

  let found = 0
  let sent = 0

  const rows: Row[] = campaigns.map((campaign) => {
    found += campaign.totalFound
    sent += campaign.totalSent

    const buckets = [0]
    if (LEAD_CAMPAIGN_RUNNING.includes(campaign.status)) buckets.push(1)
    if (campaign.status === 'COMPLETED') buckets.push(2)
    if (campaign.status === 'FAILED') buckets.push(3)

    return {
      id: campaign.id,
      open: jump('leads'),
      search: `${campaign.name} ${campaign.city} ${campaign.state} ${humanise(campaign.leadType)}`,
      buckets,
      cells: [
        text(campaign.name, { strong: true }),
        text(campaign.businessCategory ?? humanise(campaign.leadType), { dim: true }),
        text(place({ city: campaign.city, state: campaign.state })),
        text(count(campaign.totalFound), { mono: true, right: true }),
        text(count(campaign.totalEmailsFound), { mono: true, right: true }),
        text(count(campaign.totalSent), { mono: true, right: true, strong: true }),
        {
          text: count(campaign.totalFailed),
          mono: true,
          right: true,
          tone: campaign.totalFailed > 0 ? 'bad' : 'muted',
        },
        statusCell(humanise(campaign.status), LEAD_CAMPAIGN_TONE[campaign.status] ?? 'neutral'),
      ],
      inspector: {
        title: campaign.name,
        tag: humanise(campaign.status),
        tagTone: LEAD_CAMPAIGN_TONE[campaign.status] ?? 'neutral',
        groups: [
          {
            label: 'SEARCH',
            fields: [
              { label: 'Lead type', value: humanise(campaign.leadType) },
              { label: 'Category', value: campaign.businessCategory ?? '—' },
              { label: 'School type', value: campaign.schoolType },
              { label: 'City', value: campaign.city },
              { label: 'State', value: campaign.state, mono: true },
              { label: 'District', value: campaign.district ?? '—' },
              { label: 'Radius', value: campaign.radius ?? '—' },
              { label: 'Query', value: campaign.searchQuery ?? '—', wrap: true },
              { label: 'Cap', value: campaign.limit ? count(campaign.limit) : 'No cap', mono: true },
            ],
          },
          {
            label: 'RESULTS',
            fields: [
              { label: 'Leads stored', value: count(campaign._count.leads), mono: true },
              { label: 'Found', value: count(campaign.totalFound), mono: true },
              { label: 'With an email', value: count(campaign.totalEmailsFound), mono: true },
              { label: 'Emails sent', value: count(campaign.totalSent), mono: true, strong: true },
              { label: 'Failed', value: count(campaign.totalFailed), mono: true },
              { label: 'Template', value: campaign.template?.name ?? 'None' },
              { label: 'Auto-send', value: campaign.autoSend ? 'On' : 'Off' },
              { label: 'Created', value: stamp(campaign.createdAt), mono: true },
            ],
          },
        ],
        actions: [
          { label: 'Leads from this campaign', shortcut: '⌘⏎', command: jump('leads') },
          // Scraping streams progress from BrightData/SerpAPI; the run itself
          // belongs on the page that can show it happening.
          { label: 'Run this campaign…', shortcut: '⌘⇧B', command: link(`/admin/lead-generation/${campaign.id}`) },
          { label: 'New campaign…', shortcut: '⌘N', command: form('leadCampaign.create') },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} campaigns`),
      text(''),
      text(''),
      text(count(found), { right: true }),
      text(''),
      text(count(sent), { right: true, strong: true }),
      text(''),
      text(''),
    ],
  }
}

// ---------------------------------------------------------------------------
// Reviews · Forms
// ---------------------------------------------------------------------------

const FORM_FILTERS = ['All forms', 'Published', 'Drafts', 'Archived']

const FORM_TONE: Record<string, Tone> = {
  DRAFT: 'muted',
  PUBLISHED: 'good',
  ARCHIVED: 'muted',
}

async function loadForms(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const [templates, captures] = await Promise.all([
    safe(
      () =>
        prisma.formTemplate.findMany({
          orderBy: { updatedAt: 'desc' },
          take: list.limit,
          include: { _count: { select: { versions: true } } },
        }),
      [],
    ),
    safe(() => prisma.formCapture.groupBy({ by: ['formType', 'status'], _count: { _all: true } }), []),
  ])

  const capturedTotal = captures.reduce((sum, row) => sum + row._count._all, 0)
  const awaitingReview = captures
    .filter((row) => row.status === 'UPLOADED' || row.status === 'NEEDS_REVIEW')
    .reduce((sum, row) => sum + row._count._all, 0)

  const columns: Column[] = [
    { label: 'Form', width: 'minmax(0,1.9fr)' },
    { label: 'Category', width: 'minmax(0,1.1fr)' },
    { label: 'Takes', width: '116px' },
    { label: 'Version', width: '84px', right: true },
    { label: 'Revisions', width: '92px', right: true },
    { label: 'Status', width: '110px' },
    { label: 'Updated', width: '104px' },
  ]

  const rows: Row[] = templates.map((template) => {
    const buckets = [0]
    if (template.status === 'PUBLISHED') buckets.push(1)
    if (template.status === 'DRAFT') buckets.push(2)
    if (template.status === 'ARCHIVED') buckets.push(3)

    return {
      id: template.id,
      // A form is a JSON structure edited in a builder; the desktop window shows
      // what exists and hands the builder itself over.
      open: link(`/admin/forms`),
      search: `${template.name} ${template.category} ${template.tags.join(' ')}`,
      buckets,
      cells: [
        text(template.name, { strong: true }),
        text(template.category, { dim: true }),
        text(template.estimatedCompletion ?? '—', { dim: true }),
        text(`v${template.version}`, { mono: true, right: true }),
        text(count(template._count.versions), { mono: true, right: true, dim: true }),
        statusCell(humanise(template.status), FORM_TONE[template.status] ?? 'neutral'),
        text(shortDate(template.updatedAt), { mono: true, dim: true }),
      ],
      inspector: {
        title: template.name,
        tag: humanise(template.status),
        tagTone: FORM_TONE[template.status] ?? 'neutral',
        groups: [
          {
            label: 'FORM',
            fields: [
              { label: 'Slug', value: template.slug, mono: true },
              { label: 'Category', value: template.category },
              { label: 'Description', value: template.description ?? '—', wrap: true },
              { label: 'Takes about', value: template.estimatedCompletion ?? '—' },
              { label: 'Tags', value: template.tags.join(', ') || '—', wrap: true },
              {
                label: 'Recommended for',
                value: template.recommendedUses.join(', ') || '—',
                wrap: true,
              },
            ],
          },
          {
            label: 'HISTORY',
            fields: [
              { label: 'Version', value: `v${template.version}`, mono: true },
              { label: 'Revisions kept', value: count(template._count.versions), mono: true },
              {
                label: 'Published',
                value: template.publishedAt ? stamp(template.publishedAt) : 'Never',
                mono: true,
              },
              { label: 'Updated', value: stamp(template.updatedAt), mono: true },
            ],
          },
          {
            label: 'PAPER CAPTURES',
            fields: [
              { label: 'Forms photographed', value: count(capturedTotal), mono: true },
              { label: 'Awaiting review', value: count(awaitingReview), mono: true, strong: awaitingReview > 0 },
            ],
          },
        ],
        actions: [
          { label: 'Open the form builder…', shortcut: '⌘⏎', command: link('/admin/forms') },
          { label: 'Reviews', command: jump('reviews'), shortcut: '⌘⇧B' },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} forms`),
      text(''),
      text(''),
      text(''),
      text(''),
      text(awaitingReview ? `${count(awaitingReview)} captures to review` : '', {
        tone: awaitingReview ? 'warn' : 'muted',
      }),
      text(''),
    ],
  }
}


// ---------------------------------------------------------------------------
// Analytics · Retention
// ---------------------------------------------------------------------------

/**
 * The window every desktop analytics page reads.
 *
 * The web reports take a range from the query string; this window has no place
 * to put one, so it picks the widest of them and says so in the totals row
 * rather than showing a shorter period that looks like the whole story.
 */
const ANALYTICS_RANGE: AnalyticsRangeKey = '365d'

const RETENTION_FILTERS = ['All cohorts', 'Returned', 'Never came back']

async function loadRetention(): Promise<TablePayload> {
  const report = await safe(() => getCohortReport(ANALYTICS_RANGE), null)

  const columns: Column[] = [
    { label: 'Cohort', width: '110px' },
    { label: 'First-time buyers', width: '148px', right: true },
    { label: 'Month 1', width: '104px', right: true },
    { label: 'Month 2', width: '104px', right: true },
    { label: 'Month 3', width: '104px', right: true },
    { label: 'Month 6', width: '104px', right: true },
    { label: 'Ever returned', width: '124px', right: true },
  ]

  const offsets = [1, 2, 3, 6]

  /** A cell for one offset: a rate, or an honest blank when it cannot be observed yet. */
  const offsetCell = (row: CohortRow | undefined, offset: number): Cell => {
    const value = row?.retentionByOffset[offset]
    if (value === undefined || value === null) return text('—', { mono: true, right: true, dim: true })
    return {
      text: percent(value * 100, 1),
      mono: true,
      right: true,
      tone: value >= 0.2 ? 'good' : value >= 0.08 ? 'warn' : 'muted',
    }
  }

  const rows: Row[] = (report?.cohorts ?? [])
    .slice()
    .reverse()
    .map((cohort) => {
      const returned = cohort.returnedByOffset
        .slice(1)
        .reduce<number>((sum, value) => sum + (value ?? 0), 0)
      const everRate = cohort.cohortSize > 0 ? returned / cohort.cohortSize : 0

      return {
        id: cohort.cohort,
        open: jump('customers'),
        search: cohort.cohort,
        buckets: [0, returned > 0 ? 1 : 2],
        cells: [
          text(cohort.cohort, { mono: true, strong: true }),
          text(count(cohort.cohortSize), { mono: true, right: true }),
          offsetCell(cohort, 1),
          offsetCell(cohort, 2),
          offsetCell(cohort, 3),
          offsetCell(cohort, 6),
          {
            text: percent(everRate * 100, 1),
            mono: true,
            right: true,
            strong: true,
            tone: everRate >= 0.25 ? 'good' : everRate > 0 ? 'warn' : 'bad',
          },
        ],
        inspector: {
          title: cohort.cohort,
          tag: `${count(cohort.cohortSize)} buyers`,
          tagTone: 'accent',
          groups: [
            {
              label: 'COHORT',
              fields: [
                { label: 'First seen', value: cohort.cohort, mono: true },
                { label: 'First-time buyers', value: count(cohort.cohortSize), mono: true, strong: true },
                { label: 'Came back at least once', value: count(returned), mono: true },
                { label: 'Ever-returned rate', value: percent(everRate * 100, 1), mono: true },
              ],
            },
            {
              label: 'BY MONTH',
              lines: offsets.map<InspectorLine>((offset) => {
                const rate = cohort.retentionByOffset[offset]
                const heads = cohort.returnedByOffset[offset]
                return {
                  name: `Month ${offset}`,
                  qty: heads === null || heads === undefined ? 'not yet' : count(heads),
                  amount: rate === null || rate === undefined ? '—' : percent(rate * 100, 1),
                }
              }),
            },
          ],
          actions: [
            { label: 'Customers', command: jump('customers'), shortcut: '⌘⏎' },
            { label: 'Analytics overview', command: jump('analytics'), shortcut: '⌘⇧A' },
            { label: 'Margin', command: page('analytics.margin'), shortcut: '⌘G' },
          ],
        },
      }
    })

  const repeat = report?.repeat
  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} cohorts`),
      text(count(repeat?.totalBuyers ?? 0), { right: true, strong: true }),
      text(''),
      text(''),
      text(''),
      text(''),
      text(repeat?.repeatRate === null || repeat?.repeatRate === undefined ? '—' : percent(repeat.repeatRate * 100, 1), {
        right: true,
        strong: true,
      }),
    ],
  }
}

// ---------------------------------------------------------------------------
// Analytics · Margin
// ---------------------------------------------------------------------------

const MARGIN_FILTERS = ['All products', 'Costed', 'No cost recorded']

async function loadMargin(): Promise<TablePayload> {
  const report = await safe(() => getMarginReport(ANALYTICS_RANGE), null)

  const columns: Column[] = [
    { label: 'Product', width: 'minmax(0,2fr)' },
    { label: 'SKU', width: '132px' },
    { label: 'Units', width: '84px', right: true },
    { label: 'Revenue', width: '112px', right: true },
    { label: 'Cost', width: '112px', right: true },
    { label: 'Gross profit', width: '124px', right: true },
    { label: 'Margin', width: '92px', right: true },
    { label: 'Costed', width: '92px', right: true },
  ]

  const rows: Row[] = (report?.products ?? []).map((product) => {
    const margin = product.summary.marginRatio

    return {
      id: product.productId,
      open: jump('products'),
      search: `${product.productName} ${product.productSku}`,
      buckets: [0, product.uncosted ? 2 : 1],
      cells: [
        text(product.productName, { strong: true }),
        text(product.productSku, { mono: true, dim: true }),
        text(count(product.summary.unitsTotal), { mono: true, right: true }),
        text(centsToMoney(product.summary.revenueCents), { mono: true, right: true }),
        text(product.uncosted ? '—' : centsToMoney(product.summary.costCents), {
          mono: true,
          right: true,
          dim: product.uncosted,
        }),
        text(product.uncosted ? '—' : centsToMoney(product.summary.grossProfitCents), {
          mono: true,
          right: true,
          strong: !product.uncosted,
        }),
        {
          text: margin === null ? '—' : percent(margin * 100, 1),
          mono: true,
          right: true,
          tone: margin === null ? 'muted' : margin >= 0.5 ? 'good' : margin >= 0.3 ? 'warn' : 'bad',
        },
        {
          text: percent(product.summary.coverageRatio * 100, 0),
          mono: true,
          right: true,
          tone: product.summary.coverageRatio >= 0.99 ? 'good' : product.summary.coverageRatio > 0 ? 'warn' : 'bad',
        },
      ],
      inspector: {
        title: product.productName,
        tag: margin === null ? 'No cost recorded' : percent(margin * 100, 1),
        tagTone: margin === null ? 'bad' : margin >= 0.5 ? 'good' : 'warn',
        groups: [
          {
            label: 'THIS PRODUCT',
            fields: [
              { label: 'SKU', value: product.productSku, mono: true },
              { label: 'Units sold', value: count(product.summary.unitsTotal), mono: true },
              { label: 'Revenue', value: centsToMoney(product.summary.revenueCents), mono: true },
              {
                label: 'Revenue with a cost',
                value: centsToMoney(product.summary.costedRevenueCents),
                mono: true,
              },
              { label: 'Cost', value: centsToMoney(product.summary.costCents), mono: true },
              {
                label: 'Gross profit',
                value: centsToMoney(product.summary.grossProfitCents),
                mono: true,
                strong: true,
              },
              { label: 'Margin', value: margin === null ? '—' : percent(margin * 100, 2), mono: true },
            ],
          },
          {
            label: 'HOW SURE',
            fields: [
              {
                label: 'Coverage',
                value: percent(product.summary.coverageRatio * 100, 1),
                mono: true,
              },
              {
                label: 'Lines costed',
                value: `${count(product.summary.linesCosted)} of ${count(product.summary.linesTotal)}`,
                mono: true,
              },
              {
                label: 'Note',
                value: product.uncosted
                  ? 'Nothing this product sold carried a unit cost, so it shows revenue and no profit. Set a cost price on the product.'
                  : 'Margin is measured against costed revenue only, never against revenue we cannot cost.',
                wrap: true,
              },
            ],
          },
        ],
        actions: [
          { label: 'Products', command: jump('products'), shortcut: '⌘⏎' },
          { label: 'Retention', command: page('analytics.retention'), shortcut: '⌘E' },
          { label: 'Attribution', command: page('analytics.attribution'), shortcut: '⌘T' },
        ],
      },
    }
  })

  const summary = report?.summary
  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} products · trailing year`),
      text(''),
      text(count(summary?.unitsTotal ?? 0), { right: true }),
      text(centsToMoney(summary?.revenueCents ?? 0), { right: true }),
      text(centsToMoney(summary?.costCents ?? 0), { right: true }),
      text(centsToMoney(summary?.grossProfitCents ?? 0), { right: true, strong: true }),
      text(
        summary?.marginRatio === null || summary?.marginRatio === undefined
          ? '—'
          : percent(summary.marginRatio * 100, 1),
        { right: true, strong: true },
      ),
      text(percent((summary?.coverageRatio ?? 0) * 100, 0), { right: true }),
    ],
  }
}

// ---------------------------------------------------------------------------
// Analytics · Attribution
// ---------------------------------------------------------------------------

const ATTRIBUTION_FILTERS = ['All sources', 'Attributed', 'Direct']

async function loadAttribution(): Promise<TablePayload> {
  const report = await safe(() => getAttributionReport(ANALYTICS_RANGE, 'source'), null)

  const columns: Column[] = [
    { label: 'Source', width: 'minmax(0,2fr)' },
    { label: 'Orders', width: '96px', right: true },
    { label: 'Revenue', width: '124px', right: true },
    { label: 'Share of revenue', width: '146px', right: true },
    { label: 'Average order', width: '128px', right: true },
  ]

  const totalRevenue = report?.summary.totalRevenueCents ?? 0

  const rows: Row[] = (report?.rows ?? []).map((row) => {
    const share = totalRevenue > 0 ? row.revenueCents / totalRevenue : 0

    return {
      id: row.key,
      open: jump('orders'),
      search: row.key,
      buckets: [0, row.direct ? 2 : 1],
      cells: [
        text(row.direct ? DIRECT_LABEL : row.key, { strong: !row.direct, dim: row.direct }),
        text(count(row.orders), { mono: true, right: true }),
        text(centsToMoney(row.revenueCents), { mono: true, right: true, strong: true }),
        {
          text: percent(share * 100, 1),
          mono: true,
          right: true,
          tone: row.direct ? 'muted' : 'accent',
        },
        text(row.aovCents === null ? '—' : centsToMoney(row.aovCents), { mono: true, right: true }),
      ],
      inspector: {
        title: row.direct ? DIRECT_LABEL : row.key,
        tag: row.direct ? 'No source captured' : 'Attributed',
        tagTone: row.direct ? 'muted' : 'good',
        groups: [
          {
            label: 'THIS SOURCE',
            fields: [
              { label: 'Orders', value: count(row.orders), mono: true },
              { label: 'Revenue', value: centsToMoney(row.revenueCents), mono: true, strong: true },
              { label: 'Share of revenue', value: percent(share * 100, 2), mono: true },
              {
                label: 'Average order',
                value: row.aovCents === null ? '—' : centsToMoney(row.aovCents),
                mono: true,
              },
            ],
          },
          {
            label: 'HOW COMPLETE',
            fields: [
              {
                label: 'Orders with a source',
                value: `${count(report?.summary.attributedOrders ?? 0)} of ${count(
                  report?.summary.totalOrders ?? 0,
                )}`,
                mono: true,
              },
              {
                label: 'Coverage',
                value: percent((report?.summary.coverageRatio ?? 0) * 100, 1),
                mono: true,
              },
              {
                label: 'Direct revenue',
                value: centsToMoney(report?.summary.directRevenueCents ?? 0),
                mono: true,
              },
              {
                label: 'Note',
                value:
                  'An order with no captured source is Direct, never folded into a campaign. Offline and pre-capture orders are honestly direct.',
                wrap: true,
              },
            ],
          },
        ],
        actions: [
          { label: 'Orders', command: jump('orders'), shortcut: '⌘⏎' },
          { label: 'Analytics overview', command: jump('analytics'), shortcut: '⌘⇧A' },
          { label: 'Retention', command: page('analytics.retention'), shortcut: '⌘E' },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} sources · trailing year`),
      text(count(report?.summary.totalOrders ?? 0), { right: true }),
      text(centsToMoney(totalRevenue), { right: true, strong: true }),
      text(`${percent((report?.summary.coverageRatio ?? 0) * 100, 1)} attributed`, { right: true }),
      text(''),
    ],
  }
}

// ---------------------------------------------------------------------------
// Media · Documents archive
// ---------------------------------------------------------------------------

const ARCHIVE_FILTERS = ['Everything', 'Text extracted', 'Needs OCR', 'Sensitive']

const SENSITIVITY_TONE: Record<string, Tone> = {
  PUBLIC: 'good',
  INTERNAL: 'muted',
  SENSITIVE: 'bad',
}

async function loadArchiveDocuments(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const documents = await safe(
    () =>
      prisma.archiveDocument.findMany({
        where: matching<Prisma.ArchiveDocumentWhereInput>(list.q, (word) => [
          { filename: word },
          { path: word },
          { category: word },
        ]),
        orderBy: [{ year: 'desc' }, { path: 'asc' }],
        take: list.limit,
      }),
    [],
  )

  const columns: Column[] = [
    { label: 'File', width: 'minmax(0,2fr)' },
    { label: 'Category', width: 'minmax(0,1.2fr)' },
    { label: 'Year', width: '76px', right: true },
    { label: 'Size', width: '90px', right: true },
    { label: 'Text', width: '92px', right: true },
    { label: 'Extraction', width: '132px' },
    { label: 'Sensitivity', width: '116px' },
  ]

  let stored = 0
  let needsOcr = 0

  const rows: Row[] = documents.map((document) => {
    stored += document.sizeBytes ?? 0
    if (document.needsOcr) needsOcr += 1

    const buckets = [0]
    if (document.extraction === 'EXTRACTED') buckets.push(1)
    if (document.needsOcr) buckets.push(2)
    if (document.sensitivity === 'SENSITIVE') buckets.push(3)

    return {
      id: document.id,
      search: `${document.filename} ${document.path} ${document.category}`,
      buckets,
      cells: [
        text(document.filename, { strong: true }),
        text(document.category, { dim: true }),
        text(document.year ? String(document.year) : '—', { mono: true, right: true, dim: !document.year }),
        text(document.sizeBytes ? bytes(document.sizeBytes) : '—', { mono: true, right: true, dim: true }),
        text(document.textChars ? count(document.textChars) : '—', {
          mono: true,
          right: true,
          dim: !document.textChars,
        }),
        statusCell(
          humanise(document.extraction),
          document.extraction === 'EXTRACTED' ? 'good' : document.needsOcr ? 'warn' : 'muted',
        ),
        statusCell(humanise(document.sensitivity), SENSITIVITY_TONE[document.sensitivity] ?? 'neutral'),
      ],
      inspector: {
        title: document.filename,
        tag: humanise(document.sensitivity),
        tagTone: SENSITIVITY_TONE[document.sensitivity] ?? 'neutral',
        groups: [
          {
            label: 'DOCUMENT',
            fields: [
              { label: 'Path', value: document.path, mono: true, wrap: true },
              { label: 'Category', value: document.category },
              { label: 'Year', value: document.year ? String(document.year) : '—', mono: true },
              { label: 'Type', value: document.ext ?? '—', mono: true },
              { label: 'Size', value: document.sizeBytes ? bytes(document.sizeBytes) : '—', mono: true },
              { label: 'MD5', value: document.md5 ?? '—', mono: true, wrap: true },
              { label: 'Originally', value: document.originalSource ?? '—', wrap: true },
            ],
          },
          {
            label: 'TEXT',
            fields: [
              { label: 'Extraction', value: humanise(document.extraction) },
              { label: 'Characters', value: count(document.textChars), mono: true },
              { label: 'Needs OCR', value: document.needsOcr ? 'Yes' : 'No' },
              { label: 'Preview', value: excerpt(document.textPreview, 240) || '—', wrap: true },
            ],
          },
          {
            label: 'IMPORT',
            fields: [
              { label: 'Source', value: document.importSource, mono: true },
              { label: 'Batch', value: document.importBatchId ?? '—', mono: true, wrap: true },
              { label: 'Imported', value: stamp(document.importedAt), mono: true },
            ],
          },
        ],
        actions: [
          { label: 'Media library', command: jump('media'), shortcut: '⌘⏎' },
          { label: 'Mileage log', command: page('media.mileage'), shortcut: '⌘⇧M' },
          { label: 'Show archive', command: page('media.shows'), shortcut: '⌘S' },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} documents`),
      text(''),
      text(''),
      text(bytes(stored), { right: true, strong: true }),
      text(''),
      text(needsOcr ? `${count(needsOcr)} need OCR` : '', { tone: needsOcr ? 'warn' : 'muted' }),
      text(''),
    ],
  }
}

// ---------------------------------------------------------------------------
// Media · Mileage log
// ---------------------------------------------------------------------------

const MILEAGE_FILTERS = ['All trips', 'Shows', 'Markets', 'Other']

async function loadMileage(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const trips = await safe(
    () =>
      prisma.mileageEntry.findMany({
        where: matching<Prisma.MileageEntryWhereInput>(list.q, (word, raw) => [
          { destination: word },
          { city: word },
          { state: word },
          { driver: word },
          ...(yearOf(raw) ? [{ year: yearOf(raw)! }] : []),
        ]),
        orderBy: { tripDate: 'desc' },
        take: list.limit,
      }),
    [],
  )

  const columns: Column[] = [
    { label: 'Date', width: '104px' },
    { label: 'Destination', width: 'minmax(0,2fr)' },
    { label: 'Where', width: 'minmax(0,1fr)' },
    { label: 'Driver', width: '112px' },
    { label: 'Miles', width: '86px', right: true },
    { label: 'Booth sales', width: '110px', right: true },
    { label: 'Kind', width: '132px' },
  ]

  let miles = 0
  let sales = 0

  const rows: Row[] = trips.map((trip) => {
    miles += trip.miles ?? 0
    sales += toNumber(trip.sales)

    const buckets = [0]
    if (trip.category === 'SHOW') buckets.push(1)
    else if (trip.category === 'FARMERS_MARKET') buckets.push(2)
    else buckets.push(3)

    return {
      id: trip.id,
      search: `${trip.destination} ${trip.city ?? ''} ${trip.driver ?? ''} ${trip.year}`,
      buckets,
      cells: [
        text(shortDate(trip.tripDate), { mono: true }),
        text(trip.destination, { strong: true }),
        text(place({ city: trip.city, state: trip.state }), { dim: true }),
        text(trip.driver ?? '—', { dim: !trip.driver }),
        text(trip.miles ? count(trip.miles) : '—', { mono: true, right: true, dim: !trip.miles }),
        text(trip.sales ? money(trip.sales) : '—', { mono: true, right: true, dim: !trip.sales }),
        text(trip.category ? humanise(trip.category) : 'Undetermined', { dim: !trip.category }),
      ],
      inspector: {
        title: trip.destination,
        tag: trip.category ? humanise(trip.category) : 'Undetermined',
        tagTone: trip.category ? 'accent' : 'muted',
        groups: [
          {
            label: 'TRIP',
            fields: [
              { label: 'Date', value: shortDate(trip.tripDate), mono: true },
              { label: 'Ends', value: trip.endDate ? shortDate(trip.endDate) : 'Same day', mono: true },
              { label: 'Where', value: place({ city: trip.city, state: trip.state }) },
              { label: 'Driver', value: trip.driver ?? '—' },
              { label: 'Round trip', value: trip.miles ? `${count(trip.miles)} mi` : '—', mono: true },
              { label: 'One way', value: trip.oneWayMiles ? `${count(trip.oneWayMiles)} mi` : '—', mono: true },
              {
                label: 'Odometer',
                value:
                  trip.odometerStart && trip.odometerEnd
                    ? `${count(trip.odometerStart)} → ${count(trip.odometerEnd)}`
                    : '—',
                mono: true,
              },
              { label: 'Booth sales', value: trip.sales ? money(trip.sales) : '—', mono: true },
            ],
          },
          {
            label: 'PROVENANCE',
            fields: [
              { label: 'Source file', value: trip.sourceFile, mono: true, wrap: true },
              { label: 'Sheet', value: trip.sourceSheet ?? '—', mono: true },
              { label: 'Row', value: trip.sourceRow === null ? '—' : String(trip.sourceRow), mono: true },
              { label: 'Imported', value: stamp(trip.importedAt), mono: true },
            ],
          },
        ],
        actions: [
          { label: 'Documents archive', command: page('media.documents'), shortcut: '⌘D' },
          { label: 'Show archive', command: page('media.shows'), shortcut: '⌘S' },
          { label: 'Financials', command: jump('ledger'), shortcut: '⌘⏎' },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} trips`),
      text(''),
      text(''),
      text(''),
      text(`${count(miles)} mi`, { right: true, strong: true }),
      text(money(sales), { right: true }),
      text(''),
    ],
  }
}

// ---------------------------------------------------------------------------
// Media · Show archive
// ---------------------------------------------------------------------------

const SHOW_ARCHIVE_FILTERS = ['All shows', 'Shows', 'Farmers markets', 'No sales figure']

async function loadShowArchive(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const shows = await safe(
    () =>
      prisma.archivedShowSale.findMany({
        where: matching<Prisma.ArchivedShowSaleWhereInput>(list.q, (word, raw) => [
          { showName: word },
          { salesPerson: word },
          { dateText: word },
          ...(yearOf(raw) ? [{ year: yearOf(raw)! }] : []),
        ]),
        orderBy: [{ year: 'desc' }, { showDate: 'desc' }],
        take: list.limit,
      }),
    [],
  )

  const columns: Column[] = [
    { label: 'Show', width: 'minmax(0,2fr)' },
    { label: 'Date', width: '128px' },
    { label: 'Year', width: '76px', right: true },
    { label: 'Kind', width: '150px' },
    { label: 'Sales', width: '110px', right: true },
    { label: 'Expenses', width: '110px', right: true },
    { label: 'Net', width: '110px', right: true },
    { label: 'Who', width: 'minmax(0,1fr)' },
  ]

  let sales = 0
  let expenses = 0

  const rows: Row[] = shows.map((show) => {
    const showSales = toNumber(show.sales)
    const showExpenses = toNumber(show.expenses)
    sales += showSales
    expenses += showExpenses
    const net = showSales - showExpenses

    const buckets = [0]
    if (show.eventType === 'SHOW') buckets.push(1)
    if (show.eventType === 'FARMERS_MARKET') buckets.push(2)
    if (show.sales === null) buckets.push(3)

    return {
      id: show.id,
      search: `${show.showName} ${show.salesPerson ?? ''} ${show.year ?? ''}`,
      buckets,
      cells: [
        text(show.showName, { strong: true }),
        text(show.showDate ? shortDate(show.showDate) : show.dateText ?? '—', { mono: true, dim: true }),
        text(show.year ? String(show.year) : '—', { mono: true, right: true, dim: !show.year }),
        text(humanise(show.eventType), { dim: true }),
        text(show.sales ? money(showSales) : '—', { mono: true, right: true, dim: !show.sales }),
        text(show.expenses ? money(showExpenses) : '—', { mono: true, right: true, dim: !show.expenses }),
        {
          text: show.sales ? money(net) : '—',
          mono: true,
          right: true,
          strong: Boolean(show.sales),
          tone: !show.sales ? 'muted' : net >= 0 ? 'good' : 'bad',
        },
        text(show.salesPerson ?? '—', { dim: !show.salesPerson }),
      ],
      inspector: {
        title: show.showName,
        tag: humanise(show.eventType),
        tagTone: 'accent',
        groups: [
          {
            label: 'SHOW',
            fields: [
              {
                label: 'Date',
                value: show.showDate ? shortDate(show.showDate) : show.dateText ?? '—',
                mono: true,
              },
              { label: 'Year', value: show.year ? String(show.year) : '—', mono: true },
              { label: 'Kind', value: humanise(show.eventType) },
              { label: 'Worked by', value: show.salesPerson ?? '—' },
            ],
          },
          {
            label: 'MONEY',
            fields: [
              { label: 'Sales', value: show.sales ? money(showSales) : 'Not recorded', mono: true },
              { label: 'Paid out', value: show.amountPaid ? money(show.amountPaid) : '—', mono: true },
              { label: 'Expenses', value: show.expenses ? money(showExpenses) : '—', mono: true },
              { label: 'Net', value: show.sales ? money(net) : '—', mono: true, strong: true },
            ],
          },
          {
            label: 'PROVENANCE',
            fields: [
              { label: 'Source file', value: show.sourceFile, mono: true, wrap: true },
              { label: 'Row', value: show.sourceRow === null ? '—' : String(show.sourceRow), mono: true },
              { label: 'Imported', value: stamp(show.importedAt), mono: true },
            ],
          },
        ],
        actions: [
          { label: 'Events & shows', command: jump('events'), shortcut: '⌘E' },
          { label: 'Reconciliation', command: page('ledger.reconciliation'), shortcut: '⌘⇧B' },
          { label: 'Mileage log', command: page('media.mileage'), shortcut: '⌘⇧M' },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} shows`),
      text(''),
      text(''),
      text(''),
      text(money(sales), { right: true, strong: true }),
      text(money(expenses), { right: true }),
      text(money(sales - expenses), { right: true, strong: true }),
      text(''),
    ],
  }
}

// ---------------------------------------------------------------------------
// Messages · Live chat
// ---------------------------------------------------------------------------

const LIVE_CHAT_FILTERS = ['All threads', 'Waiting', 'Active', 'Closed']

const CHAT_THREAD_TONE: Record<string, Tone> = {
  WAITING: 'warn',
  ACTIVE: 'good',
  CLOSED: 'muted',
  OFFLINE: 'bad',
}

async function loadLiveChat(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const threads = await safe(
    () =>
      prisma.chatThread.findMany({
        orderBy: { lastMessageAt: 'desc' },
        take: list.limit,
        include: {
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          _count: { select: { messages: true } },
        },
      }),
    [],
  )

  const columns: Column[] = [
    { label: 'Visitor', width: 'minmax(0,1.4fr)' },
    { label: 'Email', width: 'minmax(0,1.4fr)' },
    { label: 'Last message', width: 'minmax(0,2fr)' },
    { label: 'Messages', width: '96px', right: true },
    { label: 'Waiting', width: '100px', right: true },
    { label: 'Status', width: '104px' },
    { label: 'Last seen', width: '116px' },
  ]

  const now = Date.now()
  let waiting = 0

  const rows: Row[] = threads.map((thread) => {
    const latest = thread.messages[0]
    // How long the visitor has been on hold — the number that decides who to
    // pick up next, which a timestamp alone does not say.
    const waitingMinutes =
      thread.status === 'WAITING' ? Math.round((now - thread.lastMessageAt.getTime()) / 60000) : 0
    if (thread.status === 'WAITING') waiting += 1

    const values: FormValues = {
      status: thread.status,
      customerName: textValue(thread.customerName),
      customerEmail: textValue(thread.customerEmail),
    }

    const buckets = [0]
    if (thread.status === 'WAITING') buckets.push(1)
    if (thread.status === 'ACTIVE') buckets.push(2)
    if (thread.status === 'CLOSED') buckets.push(3)

    return {
      id: thread.id,
      // Replying is a live conversation with its own socket; the window shows
      // the queue and opens the transcript where the replying happens.
      open: link(`/admin/messages/live/${thread.id}`),
      search: `${thread.customerName ?? ''} ${thread.customerEmail ?? ''} ${latest?.content ?? ''}`,
      buckets,
      cells: [
        text(thread.customerName ?? 'Anonymous visitor', {
          strong: true,
          dim: !thread.customerName,
        }),
        text(thread.customerEmail ?? '—', { mono: true, dim: true }),
        text(excerpt(latest?.content, 88) || '—', { dim: true }),
        text(count(thread._count.messages), { mono: true, right: true }),
        {
          text: waitingMinutes > 0 ? `${count(waitingMinutes)}m` : '—',
          mono: true,
          right: true,
          tone: waitingMinutes > 10 ? 'bad' : waitingMinutes > 0 ? 'warn' : 'muted',
        },
        statusCell(humanise(thread.status), CHAT_THREAD_TONE[thread.status] ?? 'neutral'),
        text(stamp(thread.lastMessageAt), { mono: true, dim: true }),
      ],
      inspector: {
        title: thread.customerName ?? 'Anonymous visitor',
        tag: humanise(thread.status),
        tagTone: CHAT_THREAD_TONE[thread.status] ?? 'neutral',
        groups: [
          {
            label: 'VISITOR',
            fields: [
              { label: 'Name', value: thread.customerName ?? '—' },
              { label: 'Email', value: thread.customerEmail ?? '—', mono: true },
              { label: 'Source', value: thread.source ?? '—' },
              { label: 'Started', value: stamp(thread.startedAt), mono: true },
              { label: 'Last message', value: stamp(thread.lastMessageAt), mono: true },
              { label: 'Messages', value: count(thread._count.messages), mono: true },
              { label: 'Assigned to', value: thread.assignedAdminId ?? 'Nobody', mono: true },
            ],
          },
          {
            label: 'LATEST',
            fields: [
              { label: 'From', value: latest ? humanise(latest.senderType) : '—' },
              { label: 'Said', value: latest?.content ?? '—', wrap: true },
              { label: 'When', value: latest ? stamp(latest.createdAt) : '—', mono: true },
              { label: 'Closed', value: thread.closedAt ? stamp(thread.closedAt) : '—', mono: true },
              { label: 'Reason', value: thread.closedReason ?? '—', wrap: true },
            ],
          },
        ],
        actions: [
          { label: 'Open transcript…', shortcut: '⌘⏎', command: link(`/admin/messages/live/${thread.id}`) },
          {
            label: 'Edit thread…',
            shortcut: '⌘E',
            command: form('chat.edit', {
              recordId: thread.id,
              title: thread.customerName ?? 'Chat thread',
              values,
            }),
          },
          ...(thread.status === 'CLOSED'
            ? []
            : [
                {
                  label: 'Close thread',
                  danger: true,
                  command: write('chat.close', thread.id, {
                    confirm: 'Close this chat? The visitor can still start a new one.',
                    danger: true,
                  }),
                },
              ]),
          { label: 'Inbox', command: jump('messages'), shortcut: '⌘I' },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} threads`),
      text(''),
      text(''),
      text(''),
      text(waiting ? `${count(waiting)} waiting` : '', { right: true, tone: waiting ? 'warn' : 'muted' }),
      text(''),
      text(''),
    ],
  }
}

// ---------------------------------------------------------------------------
// Messages · Customer email
// ---------------------------------------------------------------------------

const CUSTOMER_EMAIL_FILTERS = ['Everything', 'Needs action', 'Answered', 'Resolved']

const INBOX_STATUS_TONE: Record<string, Tone> = {
  NEEDS_ACTION: 'bad',
  IN_PROGRESS: 'warn',
  REPLY_DRAFTED: 'warn',
  AUTO_ANSWERED: 'good',
  RESOLVED: 'muted',
  IGNORED: 'muted',
}

/**
 * The customer-email worklist.
 *
 * The desktop shell shows the same rows as `/admin/inbox`, but its real job here is the
 * checklist: the inspector lists every outstanding step as its own action, so the work can
 * be ticked off without leaving the window. A row whose steps are not done offers no
 * "clear" — that refusal lives in `lib/inbox/resolution.ts` and is enforced server-side
 * whichever surface asks.
 */
async function loadCustomerEmail(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const emails = await safe(
    () =>
      prisma.inboundEmail.findMany({
        where: { status: { not: 'IGNORED' } },
        orderBy: [{ resolvedAt: { sort: 'asc', nulls: 'first' } }, { receivedAt: 'desc' }],
        take: list.limit,
        include: { steps: { orderBy: { position: 'asc' } } },
      }),
    [],
  )

  const columns: Column[] = [
    { label: 'From', width: 'minmax(0,1.2fr)' },
    { label: 'Subject', width: 'minmax(0,2fr)' },
    { label: 'Category', width: 'minmax(0,1fr)' },
    { label: 'Status', width: '124px' },
    { label: 'Steps', width: '82px' },
    { label: 'Received', width: '116px' },
  ]

  let outstanding = 0

  const rows: Row[] = emails.map((email) => {
    const open = email.steps.filter((step) => !step.isOptional && step.completedAt === null)
    if (open.length > 0) outstanding += 1

    const needsWork = email.status === 'NEEDS_ACTION' || email.status === 'IN_PROGRESS'
    const buckets = [0]
    if (needsWork || email.status === 'REPLY_DRAFTED') buckets.push(1)
    if (email.status === 'AUTO_ANSWERED') buckets.push(2)
    if (email.status === 'RESOLVED') buckets.push(3)

    const who = email.fromName ?? email.fromEmail

    return {
      id: email.id,
      open: link(`/admin/inbox/${email.id}`),
      search: `${who} ${email.fromEmail} ${email.subject} ${email.summary}`,
      buckets,
      cells: [
        text(who, { strong: open.length > 0 }),
        text(excerpt(email.subject, 80), { dim: email.status === 'RESOLVED' }),
        text(humanise(email.category), { dim: true }),
        statusCell(humanise(email.status), INBOX_STATUS_TONE[email.status] ?? 'neutral'),
        text(open.length > 0 ? `${open.length} open` : '—', {
          tone: open.length > 0 ? 'warn' : 'muted',
          strong: open.length > 0,
        }),
        text(stamp(email.receivedAt), { mono: true, dim: true }),
      ],
      inspector: {
        title: email.subject,
        tag: humanise(email.status),
        tagTone: INBOX_STATUS_TONE[email.status] ?? 'neutral',
        groups: [
          {
            label: 'MESSAGE',
            fields: [
              { label: 'From', value: `${who} <${email.fromEmail}>`, wrap: true },
              { label: 'Wants', value: email.summary, wrap: true },
              { label: 'Category', value: humanise(email.category) },
              { label: 'Severity', value: humanise(email.severity) },
              { label: 'Confidence', value: `${email.confidence}%` },
              { label: 'Received', value: stamp(email.receivedAt), mono: true },
            ],
          },
          {
            label: 'HANDLING',
            fields: [
              {
                label: 'Reply',
                value: email.autoReplySent
                  ? `Sent automatically ${email.autoReplyAt ? stamp(email.autoReplyAt) : ''}`.trim()
                  : email.draftedReply
                    ? 'Drafted in Gmail, unsent'
                    : 'None written',
                wrap: true,
              },
              { label: 'What is owed', value: email.actionSummary ?? '—', wrap: true },
              { label: 'Gmail label', value: email.gmailLabel ?? '—' },
              {
                label: 'Resolved',
                value: email.resolvedAt ? stamp(email.resolvedAt) : 'Not yet',
                mono: true,
              },
            ],
          },
          ...(email.steps.length > 0
            ? [
                {
                  label: 'STEPS',
                  fields: email.steps.map((step, index) => ({
                    label: `${index + 1}${step.isOptional ? ' (optional)' : ''}`,
                    value: step.completedAt
                      ? `✓ ${step.instruction}`
                      : step.instruction,
                    wrap: true,
                  })),
                },
              ]
            : []),
        ],
        actions: [
          // One action per outstanding step, so the work is done from the row rather than
          // by going and finding the web panel.
          ...open.slice(0, 6).map((step) => ({
            label: `Done: ${excerpt(step.instruction, 44)}`,
            command: write('inboundEmail.completeStep', step.id, {
              success: 'Step completed',
            }),
          })),
          { label: 'Open the thread in Gmail…', shortcut: '⌘G', command: link(gmailThreadUrl(email.gmailThreadId)) },
          { label: 'Open the full email…', shortcut: '⌘⏎', command: link(`/admin/inbox/${email.id}`) },
          { label: 'Notifications', command: page('messages.notifications'), shortcut: '⌘N' },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} emails`),
      text(''),
      text(''),
      text(''),
      text(outstanding ? `${count(outstanding)} outstanding` : 'all handled', {
        tone: outstanding ? 'warn' : 'good',
      }),
      text(''),
    ],
  }
}

// ---------------------------------------------------------------------------
// Messages · Notifications
// ---------------------------------------------------------------------------

const NOTIFICATION_FILTERS = ['Everything', 'Unread', 'Critical', 'Read']

const NOTIFICATION_TONE: Record<string, Tone> = {
  INFO: 'muted',
  WARNING: 'warn',
  CRITICAL: 'bad',
}

async function loadNotifications(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const notifications = await safe(
    () =>
      prisma.notification.findMany({
        orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
        take: list.limit,
      }),
    [],
  )

  const columns: Column[] = [
    { label: 'Notification', width: 'minmax(0,1.7fr)' },
    { label: 'Detail', width: 'minmax(0,2.2fr)' },
    { label: 'Kind', width: 'minmax(0,1.2fr)' },
    { label: 'Severity', width: '110px' },
    { label: 'Read', width: '92px' },
    { label: 'Raised', width: '116px' },
  ]

  let unread = 0

  const rows: Row[] = notifications.map((notification) => {
    if (!notification.isRead) unread += 1

    const buckets = [0]
    if (!notification.isRead) buckets.push(1)
    if (notification.severity === 'CRITICAL') buckets.push(2)
    if (notification.isRead) buckets.push(3)

    return {
      id: notification.id,
      open: notification.isRead
        ? link(notification.link ?? '/admin/notifications')
        : write('notification.markRead', notification.id, { success: 'Marked read' }),
      search: `${notification.title} ${notification.message} ${humanise(notification.type)}`,
      buckets,
      cells: [
        text(notification.title, { strong: !notification.isRead, dim: notification.isRead }),
        text(excerpt(notification.message, 96), { dim: true }),
        text(humanise(notification.type), { dim: true }),
        statusCell(humanise(notification.severity), NOTIFICATION_TONE[notification.severity] ?? 'neutral'),
        text(notification.isRead ? 'Read' : 'Unread', {
          tone: notification.isRead ? 'muted' : 'accent',
          strong: !notification.isRead,
        }),
        text(stamp(notification.createdAt), { mono: true, dim: true }),
      ],
      inspector: {
        title: notification.title,
        tag: humanise(notification.severity),
        tagTone: NOTIFICATION_TONE[notification.severity] ?? 'neutral',
        groups: [
          {
            label: 'NOTIFICATION',
            fields: [
              { label: 'Message', value: notification.message, wrap: true },
              { label: 'Kind', value: humanise(notification.type) },
              { label: 'Severity', value: humanise(notification.severity) },
              { label: 'Raised', value: stamp(notification.createdAt), mono: true },
              { label: 'Read', value: notification.readAt ? stamp(notification.readAt) : 'Not yet', mono: true },
            ],
          },
          {
            label: 'ABOUT',
            fields: [
              { label: 'Entity', value: notification.entityType ?? '—' },
              { label: 'Record', value: notification.entityId ?? '—', mono: true, wrap: true },
              { label: 'Link', value: notification.link ?? '—', mono: true, wrap: true },
              { label: 'Dedupe key', value: notification.dedupeKey ?? '—', mono: true, wrap: true },
            ],
          },
        ],
        actions: [
          ...(notification.isRead
            ? []
            : [
                {
                  label: 'Mark read',
                  shortcut: '⌘⏎',
                  command: write('notification.markRead', notification.id, { success: 'Marked read' }),
                },
              ]),
          ...(notification.link ? [{ label: 'Open what it is about…', shortcut: '⌘O', command: link(notification.link) }] : []),
          {
            label: 'Mark everything read',
            shortcut: '⌘⇧A',
            command: {
              kind: 'write' as const,
              op: 'notification.markAllRead' as const,
              confirm: 'Mark every unread notification as read?',
            },
          },
          { label: 'Inbox', command: jump('messages'), shortcut: '⌘I' },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} notifications`),
      text(''),
      text(''),
      text(''),
      text(unread ? `${count(unread)} unread` : 'all read', { tone: unread ? 'warn' : 'good' }),
      text(''),
    ],
  }
}

// ---------------------------------------------------------------------------
// Users · Credential vault
// ---------------------------------------------------------------------------

const CREDENTIAL_FILTERS = ['All credentials', 'Rotated this year', 'Never rotated']

async function loadCredentials(list: ListQuery = DEFAULT_LIST): Promise<TablePayload> {
  const [credentials, grants] = await Promise.all([
    safe(
      () =>
        prisma.serviceCredential.findMany({
          orderBy: [{ serviceName: 'asc' }, { label: 'asc' }],
          take: list.limit,
          // Never the encrypted value, its IV or its tag. This window lists what
          // is in the vault; revealing a secret is the vault UI's own job, behind
          // its own confirmation.
          select: {
            id: true,
            serviceName: true,
            label: true,
            username: true,
            url: true,
            notes: true,
            createdAt: true,
            updatedAt: true,
            passwordChangedAt: true,
          },
        }),
      [],
    ),
    safe(
      () => prisma.credentialAccessGrant.findMany({ where: { revokedAt: null }, orderBy: { email: 'asc' } }),
      [],
    ),
  ])

  const columns: Column[] = [
    { label: 'Service', width: 'minmax(0,1.4fr)' },
    { label: 'Label', width: 'minmax(0,1.6fr)' },
    { label: 'Username', width: 'minmax(0,1.3fr)' },
    { label: 'Where', width: 'minmax(0,1.4fr)' },
    { label: 'Rotated', width: '116px' },
    { label: 'Age', width: '96px', right: true },
  ]

  const now = Date.now()
  const yearAgo = now - 365 * 24 * 60 * 60 * 1000
  let stale = 0

  const rows: Row[] = credentials.map((credential) => {
    const rotated = credential.passwordChangedAt
    const ageDays = Math.round((now - (rotated ?? credential.createdAt).getTime()) / 86_400_000)
    const isStale = !rotated || rotated.getTime() < yearAgo
    if (isStale) stale += 1

    return {
      id: credential.id,
      // The vault reveals and edits secrets behind its own confirmation, and
      // that is deliberately the only place it happens.
      open: link('/admin/credentials'),
      search: `${credential.serviceName} ${credential.label} ${credential.username ?? ''}`,
      buckets: [0, isStale ? 2 : 1],
      cells: [
        text(credential.serviceName, { strong: true }),
        text(credential.label),
        text(credential.username ?? '—', { mono: true, dim: true }),
        text(credential.url ?? '—', { mono: true, dim: true }),
        text(rotated ? shortDate(rotated) : 'Never', { mono: true, dim: !rotated }),
        {
          text: `${count(ageDays)}d`,
          mono: true,
          right: true,
          tone: isStale ? 'warn' : 'good',
        },
      ],
      inspector: {
        title: credential.label,
        tag: credential.serviceName,
        tagTone: isStale ? 'warn' : 'good',
        groups: [
          {
            label: 'CREDENTIAL',
            fields: [
              { label: 'Service', value: credential.serviceName },
              { label: 'Username', value: credential.username ?? '—', mono: true },
              { label: 'URL', value: credential.url ?? '—', mono: true, wrap: true },
              { label: 'Notes', value: credential.notes ?? '—', wrap: true },
              { label: 'Added', value: stamp(credential.createdAt), mono: true },
              { label: 'Updated', value: stamp(credential.updatedAt), mono: true },
              {
                label: 'Rotated',
                value: rotated ? stamp(rotated) : 'Never rotated since it was stored',
                mono: Boolean(rotated),
                strong: !rotated,
              },
              {
                label: 'Secret',
                value: 'Encrypted at rest. This window never reads it — reveal it in the vault.',
                wrap: true,
              },
            ],
          },
          {
            label: 'WHO CAN SEE THE VAULT',
            lines: grants.map<InspectorLine>((grant) => ({
              name: grant.email,
              qty: grant.canEdit ? 'edit' : grant.canView ? 'view' : 'none',
              amount: grant.canDelete ? 'delete' : '',
            })),
          },
        ],
        actions: [
          { label: 'Open the vault…', shortcut: '⌘⏎', command: link('/admin/credentials') },
          { label: 'Staff accounts', command: jump('users'), shortcut: '⌘U' },
          { label: 'Integrations', command: page('settings.integrations'), shortcut: '⌘T' },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} credentials`),
      text(`${count(grants.length)} people granted access`, { dim: true }),
      text(''),
      text(''),
      text(stale ? `${count(stale)} never rotated or over a year old` : '', {
        tone: stale ? 'warn' : 'good',
      }),
      text(''),
    ],
  }
}

// ---------------------------------------------------------------------------
// Settings · Payments
// ---------------------------------------------------------------------------

async function loadPaymentSettings(): Promise<SettingsPayload> {
  const [providers, recent] = await Promise.all([
    safe(() => prisma.paymentProviderConfig.findMany({ orderBy: { provider: 'asc' } }), []),
    safe(
      () =>
        prisma.payment.groupBy({
          by: ['provider', 'status'],
          _sum: { amount: true },
        }),
      [],
    ),
  ])

  // What each provider has actually taken, so a row says more than on/off.
  const takenBy = new Map<string, number>()
  for (const row of recent) {
    if (row.status !== 'SUCCEEDED' || !row.provider) continue
    takenBy.set(row.provider, (takenBy.get(row.provider) ?? 0) + toNumber(row._sum.amount))
  }

  const rows = providers.map((provider) => ({
    label: humanise(provider.provider),
    value: `${provider.isActive ? 'Live' : 'Off'}${provider.testMode ? ' · test mode' : ''} · ${money(
      takenBy.get(provider.provider) ?? 0,
    )} taken`,
    tone: (provider.isActive && !provider.testMode
      ? 'good'
      : provider.isActive
        ? 'warn'
        : 'muted') as Tone,
  }))

  const methods = providers.flatMap((provider) => provider.supportedMethods)

  return {
    view: 'settings',
    groups: [
      {
        label: 'PROVIDERS',
        rows: rows.length
          ? rows
          : [{ label: 'No provider configured', value: 'Checkout falls back to Stripe', tone: 'warn' as Tone }],
      },
      {
        label: 'WHAT CHECKOUT ACCEPTS',
        rows: [
          { label: 'Methods', value: [...new Set(methods)].map(humanise).join(', ') || '—' },
          {
            label: 'Live providers',
            value: count(providers.filter((provider) => provider.isActive && !provider.testMode).length),
            mono: true,
          },
          {
            label: 'In test mode',
            value: count(providers.filter((provider) => provider.testMode).length),
            mono: true,
          },
        ],
      },
      {
        label: 'KEYS',
        rows: [
          {
            label: 'Secret keys',
            value: 'Held in Vercel environment variables and the credential vault — never here',
          },
          { label: 'Webhooks', value: '/api/webhooks/{stripe,paypal,square} finalise every order', mono: true },
        ],
      },
    ],
    inspector: {
      title: 'Payments',
      tag: providers.some((provider) => provider.isActive) ? 'Taking money' : 'Nothing live',
      tagTone: providers.some((provider) => provider.isActive && !provider.testMode) ? 'good' : 'warn',
      groups: [
        {
          label: 'PROVIDERS',
          lines: providers.map<InspectorLine>((provider) => ({
            name: humanise(provider.provider),
            qty: provider.isActive ? (provider.testMode ? 'test' : 'live') : 'off',
            amount: money(takenBy.get(provider.provider) ?? 0),
          })),
        },
        {
          label: 'WHY THIS IS READ-ONLY',
          fields: [
            {
              label: 'Keys',
              value:
                'A provider key is a secret. Rotating one is done in Vercel or the credential vault, where it is written once and never shown back.',
              wrap: true,
            },
          ],
        },
      ],
      actions: [
        // Entering a key is a secret-handling flow with its own masking.
        { label: 'Payment keys…', shortcut: '⌘⏎', command: link('/admin/settings/payments') },
        { label: 'Store settings', command: jump('settings'), shortcut: '⌘S' },
        { label: 'Orders', command: jump('orders'), shortcut: '⌘O' },
      ],
    },
  }
}

// ---------------------------------------------------------------------------
// Settings · Shipping
// ---------------------------------------------------------------------------

interface OriginAddress {
  street1?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
}

async function loadShippingSettings(): Promise<SettingsPayload> {
  const [settings, carriers, labels] = await Promise.all([
    safe(() => prisma.shippingSettings.findFirst({ orderBy: { createdAt: 'asc' } }), null),
    safe(() => prisma.shippingCarrier.findMany({ orderBy: { name: 'asc' } }), []),
    safe(() => prisma.shippingLabel.count(), 0),
  ])

  const origin = (settings?.originAddress ?? null) as OriginAddress | null

  const values: FormValues = {
    originStreet: textValue(origin?.street1),
    originCity: textValue(origin?.city),
    originState: textValue(origin?.state),
    originZip: textValue(origin?.zip),
    defaultCarrier: textValue(settings?.defaultCarrier),
    flatRateCents: settings?.flatRateCents ?? '',
    weightSurchargeThresholdLb: settings?.weightSurchargeThresholdLb ?? '',
    weightSurchargeBaseCents: settings?.weightSurchargeBaseCents ?? '',
    weightSurchargePerLbCents: settings?.weightSurchargePerLbCents ?? '',
    internationalRateCents: settings?.internationalRateCents ?? '',
  }

  const edit = form('settings.shipping', { recordId: settings?.id, values })
  const hasOrigin = Boolean(origin?.city && origin?.state && origin?.zip)

  return {
    view: 'settings',
    groups: [
      {
        label: 'SHIP FROM',
        rows: [
          {
            label: 'Origin',
            value: hasOrigin
              ? `${origin?.street1 ?? ''} ${origin?.city}, ${origin?.state} ${origin?.zip}`.trim()
              : 'Not set — rates fall back to the built-in origin',
            tone: hasOrigin ? 'good' : 'bad',
          },
          { label: 'Default carrier', value: settings?.defaultCarrier ?? 'None' },
          {
            label: 'Enabled carriers',
            value: settings?.enabledCarriers.length ? settings.enabledCarriers.join(', ') : 'All',
          },
        ],
        edit,
      },
      {
        label: 'FALLBACK RATES',
        rows: [
          {
            label: 'Flat rate',
            value: settings?.flatRateCents ? centsToMoney(settings.flatRateCents) : 'Built-in default',
            mono: true,
          },
          {
            label: 'Weight surcharge over',
            value: settings?.weightSurchargeThresholdLb
              ? `${count(settings.weightSurchargeThresholdLb)} lb`
              : 'Built-in default',
            mono: true,
          },
          {
            label: 'Surcharge base',
            value: settings?.weightSurchargeBaseCents
              ? centsToMoney(settings.weightSurchargeBaseCents)
              : 'Built-in default',
            mono: true,
          },
          {
            label: 'Surcharge per lb',
            value: settings?.weightSurchargePerLbCents
              ? centsToMoney(settings.weightSurchargePerLbCents)
              : 'Built-in default',
            mono: true,
          },
          {
            label: 'International',
            value: settings?.internationalRateCents
              ? centsToMoney(settings.internationalRateCents)
              : 'Built-in default',
            mono: true,
          },
        ],
        edit,
      },
      {
        label: 'CARRIERS',
        rows: carriers.length
          ? carriers.map((carrier) => ({
              label: carrier.name,
              value: `${carrier.code}${carrier.isActive ? '' : ' · off'}`,
              mono: true,
              tone: (carrier.isActive ? 'good' : 'muted') as Tone,
            }))
          : [{ label: 'No carriers configured', value: 'EasyPost quotes directly', tone: 'muted' as Tone }],
      },
    ],
    inspector: {
      title: 'Shipping',
      tag: hasOrigin ? 'Quoting live' : 'No origin set',
      tagTone: hasOrigin ? 'good' : 'bad',
      groups: [
        {
          label: 'STATE OF PLAY',
          fields: [
            { label: 'Labels bought', value: count(labels), mono: true },
            { label: 'Carriers configured', value: count(carriers.length), mono: true },
            { label: 'Last saved', value: settings ? stamp(settings.updatedAt) : 'Never', mono: true },
            {
              label: 'Why the origin matters',
              value:
                'Without an origin the calculator quotes from the built-in fallback address, which is not Zanesville and will misprice every rate.',
              wrap: true,
            },
            {
              label: 'Jar weight',
              value: 'Product weight is recorded in ounces. A jar is 16 oz, not 16 lb.',
              wrap: true,
            },
          ],
        },
      ],
      actions: [
        { label: 'Edit shipping…', shortcut: '⌘⏎', command: edit },
        { label: 'Shipping labels', command: page('orders.shipping'), shortcut: '⌘L' },
        { label: 'Integrations', command: page('settings.integrations'), shortcut: '⌘T' },
      ],
    },
  }
}

// ---------------------------------------------------------------------------
// Settings · Integrations
// ---------------------------------------------------------------------------

const INTEGRATION_FILTERS = ['All integrations', 'Enabled', 'Configured', 'Failing']

async function loadIntegrations(): Promise<TablePayload> {
  const integrations = await safe(
    () => prisma.thirdPartyIntegration.findMany({ orderBy: [{ type: 'asc' }, { name: 'asc' }] }),
    [],
  )

  const columns: Column[] = [
    { label: 'Integration', width: 'minmax(0,1.6fr)' },
    { label: 'Kind', width: '132px' },
    { label: 'Configured', width: '116px' },
    { label: 'Last sync', width: '124px' },
    { label: 'Status', width: '112px' },
    { label: 'Last error', width: 'minmax(0,1.8fr)' },
  ]

  let enabled = 0
  let failing = 0

  const rows: Row[] = integrations.map((integration) => {
    if (integration.isActive) enabled += 1
    if (integration.lastError) failing += 1

    const buckets = [0]
    if (integration.isActive) buckets.push(1)
    if (integration.isConfigured) buckets.push(2)
    if (integration.lastError) buckets.push(3)

    return {
      id: integration.id,
      open: integration.isActive
        ? write('integration.disable', integration.id, {
            confirm: `Disable ${integration.name}? Anything relying on it stops working.`,
            danger: true,
          })
        : write('integration.enable', integration.id, { confirm: `Enable ${integration.name}?` }),
      search: `${integration.name} ${humanise(integration.type)}`,
      buckets,
      cells: [
        text(integration.name, { strong: true }),
        text(humanise(integration.type), { dim: true }),
        statusCell(
          integration.isConfigured ? 'Configured' : 'No credentials',
          integration.isConfigured ? 'good' : 'warn',
        ),
        text(integration.lastSyncAt ? stamp(integration.lastSyncAt) : 'Never', {
          mono: true,
          dim: !integration.lastSyncAt,
        }),
        statusCell(integration.isActive ? 'Enabled' : 'Off', integration.isActive ? 'good' : 'muted'),
        text(excerpt(integration.lastError, 90) || '—', {
          dim: !integration.lastError,
          tone: integration.lastError ? 'bad' : undefined,
        }),
      ],
      inspector: {
        title: integration.name,
        tag: integration.isActive ? 'Enabled' : 'Off',
        tagTone: integration.lastError ? 'bad' : integration.isActive ? 'good' : 'muted',
        groups: [
          {
            label: 'INTEGRATION',
            fields: [
              { label: 'Kind', value: humanise(integration.type) },
              { label: 'Configured', value: integration.isConfigured ? 'Yes' : 'No credentials stored' },
              { label: 'Enabled', value: integration.isActive ? 'Yes' : 'No' },
              { label: 'Webhook', value: integration.webhookUrl ?? '—', mono: true, wrap: true },
              {
                label: 'Last sync',
                value: integration.lastSyncAt ? stamp(integration.lastSyncAt) : 'Never',
                mono: true,
              },
              { label: 'Last error', value: integration.lastError ?? 'None', wrap: true },
            ],
          },
        ],
        actions: [
          integration.isActive
            ? {
                label: 'Disable',
                shortcut: '⌘⏎',
                danger: true,
                command: write('integration.disable', integration.id, {
                  confirm: `Disable ${integration.name}? Anything relying on it stops working.`,
                  danger: true,
                }),
              }
            : {
                label: 'Enable',
                shortcut: '⌘⏎',
                command: write('integration.enable', integration.id, {
                  confirm: `Enable ${integration.name}?`,
                }),
              },
          // Credentials are entered where they can be masked.
          { label: 'Configure credentials…', shortcut: '⌘⇧K', command: link('/admin/settings/integrations') },
          { label: 'Credential vault', command: page('users.credentials'), shortcut: '⌘⇧V' },
        ],
      },
    }
  })

  return {
    view: 'table',
    columns,
    rows,
    totals: [
      text(`${count(rows.length)} integrations`),
      text(''),
      text(''),
      text(''),
      text(`${count(enabled)} enabled`, { tone: enabled ? 'good' : 'muted' }),
      text(failing ? `${count(failing)} reporting errors` : '', { tone: failing ? 'bad' : 'muted' }),
    ],
  }
}

// ---------------------------------------------------------------------------
// Section assembly
// ---------------------------------------------------------------------------

const AUDIT_FILTERS = ['All activity', 'People', 'System']
const DATABASE_FILTERS = ['All tables', 'With rows', 'Empty']

interface SectionMeta {
  eyebrow: string
  filters: string[]
  actions: SectionPayload['actions']
}

function meta(section: DesktopSection): SectionMeta {
  /**
   * The escape hatch, on every section.
   *
   * The window does the work now, but a handful of jobs still live only in the
   * web panel — a Stripe key, a UploadThing drop zone, a streaming scraper run.
   * This keeps the door to them one click away without pretending the shell
   * cannot do the rest.
   */
  const open = { label: 'Open in web admin', icon: 'i-chev', command: link(section.path) }

  switch (section.id) {
    case 'dashboard':
      return {
        eyebrow: 'MADE WITH LOVE, SERVED WITH PRIDE',
        filters: ['Today'],
        actions: [
          { label: 'New order', icon: 'i-plus', command: form('order.create'), primary: true },
          { label: 'New ledger entry', icon: 'i-wallet', command: form('ledger.create') },
          open,
        ],
      }
    case 'orders':
      return {
        eyebrow: 'ALL CHANNELS',
        filters: ORDER_FILTERS,
        actions: [
          { label: 'New order', icon: 'i-plus', command: form('order.create'), primary: true },
          { label: 'Customers', icon: 'i-users', command: jump('customers') },
          open,
        ],
      }
    case 'products':
      return {
        eyebrow: 'JARS & CATALOGUE',
        filters: PRODUCT_FILTERS,
        actions: [
          { label: 'New product', icon: 'i-plus', command: form('product.create'), primary: true },
          { label: 'Inventory', icon: 'i-boxes', command: jump('inventory') },
          open,
        ],
      }
    case 'inventory':
      return {
        eyebrow: 'ZANESVILLE KITCHEN',
        filters: INVENTORY_FILTERS,
        actions: [
          { label: 'New purchase order', icon: 'i-plus', command: form('purchase.create'), primary: true },
          { label: 'Scan stock', icon: 'i-boxes', command: { kind: 'scan' } },
          { label: 'Purchase orders', icon: 'i-truck', command: jump('purchase') },
          open,
        ],
      }
    case 'customers':
      return {
        eyebrow: 'EVERYONE WHO HAS BOUGHT',
        filters: CUSTOMER_FILTERS,
        actions: [
          { label: 'New customer', icon: 'i-plus', command: form('customer.create'), primary: true },
          { label: 'Import CSV', icon: 'i-down', command: link('/admin/customers/import') },
          open,
        ],
      }
    case 'fundraisers':
      return {
        eyebrow: 'PARTICIPANTS ACROSS EVERY CAMPAIGN',
        filters: FUNDRAISER_FILTERS,
        actions: [
          { label: 'New fundraiser', icon: 'i-plus', command: form('fundraiser.create'), primary: true },
          { label: 'Add participant', icon: 'i-users', command: form('participant.create') },
          open,
        ],
      }
    case 'events':
      return {
        eyebrow: 'ON THE MOVE',
        filters: EVENT_FILTERS,
        actions: [
          { label: 'New show', icon: 'i-plus', command: form('event.create'), primary: true },
          { label: 'Calendar sync', icon: 'i-calendar', command: link('/admin/events/calendar') },
          open,
        ],
      }
    case 'ledger':
      return {
        eyebrow: 'GENERAL LEDGER',
        filters: LEDGER_FILTERS,
        actions: [
          { label: 'New entry', icon: 'i-plus', command: form('ledger.create'), primary: true },
          { label: 'Reconciliation', icon: 'i-check', command: page('ledger.reconciliation') },
          { label: 'Export', icon: 'i-down', command: link('/admin/financials/ledger') },
        ],
      }
    case 'analytics':
      return {
        eyebrow: 'TRAILING 12 MONTHS',
        filters: ['12 months'],
        actions: [{ label: 'Report builder', icon: 'i-chart', command: link('/admin/data'), primary: true }, open],
      }
    case 'settings':
      return {
        eyebrow: 'STORE CONFIGURATION',
        filters: ['Everything'],
        actions: [
          { label: 'Store settings', icon: 'i-settings', command: form('settings.store'), primary: true },
          { label: 'Search settings', icon: 'i-target', command: form('settings.seo') },
          open,
        ],
      }
    case 'audit':
      return { eyebrow: 'WHO DID WHAT', filters: AUDIT_FILTERS, actions: [open] }
    case 'database':
      return {
        eyebrow: 'POSTGRES · ROW COUNTS',
        filters: DATABASE_FILTERS,
        actions: [
          { label: 'Database Console', icon: 'i-database', command: jump('database'), primary: true },
        ],
      }
    case 'purchase':
      return {
        eyebrow: 'INBOUND SUPPLY',
        filters: PURCHASE_FILTERS,
        actions: [
          { label: 'New PO', icon: 'i-plus', command: form('purchase.create'), primary: true },
          { label: 'New supplier', icon: 'i-truck', command: form('supplier.create') },
          open,
        ],
      }
    case 'invoices':
      return {
        eyebrow: 'ACCOUNTS RECEIVABLE',
        filters: INVOICE_FILTERS,
        actions: [
          { label: 'New invoice', icon: 'i-plus', command: form('invoice.create'), primary: true },
          { label: 'Returns & RMAs', icon: 'i-file', command: page('orders.returns') },
          open,
        ],
      }
    case 'wholesale':
      return {
        eyebrow: 'TRADE ACCOUNTS',
        filters: WHOLESALE_FILTERS,
        actions: [
          { label: 'New wholesale order', icon: 'i-plus', command: form('order.create'), primary: true },
          { label: 'Store locator', icon: 'i-pin', command: page('wholesale.locations') },
          open,
        ],
      }
    case 'email':
      return {
        eyebrow: 'CAMPAIGNS & AUTOMATIONS',
        filters: EMAIL_FILTERS,
        actions: [
          { label: 'New campaign', icon: 'i-plus', command: form('campaign.create'), primary: true },
          { label: 'Automations', icon: 'i-mail', command: page('email.automations') },
          open,
        ],
      }
    case 'social':
      return {
        eyebrow: 'SCHEDULED & PUBLISHED',
        filters: SOCIAL_FILTERS,
        actions: [
          { label: 'New post', icon: 'i-plus', command: form('social.create'), primary: true },
          { label: 'Reach', icon: 'i-chart', command: page('social.analytics') },
          open,
        ],
      }
    case 'content':
      return {
        eyebrow: 'PAGES, POSTS & BANNERS',
        filters: CONTENT_FILTERS,
        actions: [
          { label: 'New post', icon: 'i-plus', command: form('post.create'), primary: true },
          { label: 'SEO', icon: 'i-target', command: page('content.seo') },
          open,
        ],
      }
    case 'leads':
      return {
        eyebrow: 'PROSPECTING PIPELINE',
        filters: LEAD_FILTERS,
        actions: [
          { label: 'New campaign', icon: 'i-plus', command: form('leadCampaign.create'), primary: true },
          { label: 'Campaigns', icon: 'i-target', command: page('leads.campaigns') },
        ],
      }
    case 'reviews':
      return {
        eyebrow: 'CUSTOMER FEEDBACK',
        filters: REVIEW_FILTERS,
        actions: [
          { label: 'Products', icon: 'i-package', command: jump('products') },
          { label: 'Review forms', icon: 'i-file', command: page('reviews.forms') },
          open,
        ],
      }
    case 'media':
      return {
        eyebrow: 'LIBRARY & ARCHIVE',
        filters: MEDIA_FILTERS,
        actions: [
          { label: 'Add by URL', icon: 'i-plus', command: form('media.upload'), primary: true },
          { label: 'Upload files', icon: 'i-down', command: link('/admin/media') },
          open,
        ],
      }
    case 'messages':
      return {
        eyebrow: 'INBOX',
        filters: MESSAGE_FILTERS,
        actions: [
          { label: 'Live chat', icon: 'i-message', command: page('messages.live'), primary: true },
          { label: 'Notifications', icon: 'i-alert', command: page('messages.notifications') },
          open,
        ],
      }
    case 'users':
      return {
        eyebrow: 'STAFF ACCOUNTS',
        filters: USER_FILTERS,
        actions: [
          { label: 'New user', icon: 'i-plus', command: form('user.create'), primary: true },
          { label: 'Credentials', icon: 'i-shield', command: page('users.credentials') },
          open,
        ],
      }
    default:
      return { eyebrow: section.label.toUpperCase(), filters: ['Overview'], actions: [open] }
  }
}

/**
 * The Developer Console's overview, read through the same helpers as
 * `/admin/developer` so the two always agree. The console's tools — the SQL
 * console, the file explorer, the blog — stay web pages; the inspector opens
 * them.
 */
async function loadDeveloper(): Promise<SettingsPayload> {
  const [checks, stats, audit] = await Promise.all([getStatusChecks(), getPlatformStats(), getRecentAudit()])
  const failing = checks.filter((check) => !check.ok).length
  const stat = (value: number | null) => (value === null ? 'Unavailable' : count(value))

  return {
    view: 'settings',
    groups: [
      {
        label: 'SYSTEM STATUS',
        rows: checks.map((check) => ({ label: check.label, value: check.detail, tone: check.ok ? 'good' : 'bad' })),
      },
      {
        label: 'PLATFORM',
        rows: [
          { label: 'Users', value: stat(stats.users), mono: true },
          { label: 'Orders', value: stat(stats.orders), mono: true },
          { label: 'Products', value: stat(stats.products), mono: true },
          { label: 'Developer blog posts', value: stat(stats.posts), mono: true },
        ],
      },
      {
        label: 'RECENT ACTIVITY',
        rows:
          audit.length === 0
            ? [{ label: 'Audit trail', value: 'No entries yet', tone: 'muted' }]
            : audit.map((entry) => ({
                label: [entry.action, entry.entityType].filter(Boolean).join(' · '),
                value: stamp(entry.createdAt),
                mono: true,
              })),
      },
    ],
    inspector: {
      title: 'Developer Console',
      tag: failing === 0 ? 'All systems configured' : `${failing} need attention`,
      tagTone: failing === 0 ? 'good' : 'bad',
      groups: [
        {
          label: 'TOOLS',
          fields: [
            { label: 'SQL console', value: 'Guarded queries against the platform database' },
            { label: 'File explorer', value: 'The josemadridsalsa-blob store' },
            { label: 'Developer blog', value: 'Posts on /developer' },
          ],
        },
      ],
      actions: [
        { label: 'SQL console…', command: link('/admin/developer/database') },
        { label: 'File explorer…', command: link('/admin/developer/files') },
        { label: 'Developer blog…', command: link('/admin/developer/blog') },
        { label: 'Page content…', command: link('/admin/developer/content') },
        { label: 'Salsadocs…', command: link('/admin/developer/salsadocs') },
        { label: 'Credential vault', command: page('users.credentials') },
        { label: 'Audit logs', command: jump('audit') },
      ],
    },
  }
}

async function loadBody(section: DesktopSection, list: ListQuery): Promise<SectionPayload['body']> {
  switch (section.id) {
    case 'dashboard':
      return loadDashboard()
    case 'orders':
      return loadOrders(list)
    case 'products':
      return loadProducts(list)
    case 'inventory':
      return loadInventory(list)
    case 'customers':
      return loadCustomers(list)
    case 'fundraisers':
      return loadFundraisers(list)
    case 'events':
      return loadEvents(list)
    case 'ledger':
      return loadLedger(list)
    case 'analytics':
      return loadAnalytics()
    case 'settings':
      return loadSettings()
    case 'audit':
      return loadAudit(list)
    case 'database':
      return loadDatabase()
    case 'purchase':
      return loadPurchase(list)
    case 'invoices':
      return loadInvoices(list)
    case 'wholesale':
      return loadWholesale(list)
    case 'email':
      return loadEmail(list)
    case 'social':
      return loadSocial(list)
    case 'content':
      return loadContent(list)
    case 'leads':
      return loadLeads(list)
    case 'reviews':
      return loadReviews(list)
    case 'media':
      return loadMedia(list)
    case 'messages':
      return loadMessages(list)
    case 'users':
      return loadUsers(list)
    default:
      return {
        view: 'link',
        note: 'This page lives in the web admin. It keeps its place in the sidebar, its shortcut and its command palette entry — pick a view to open it in this window.',
        views: pagesFor(section).map((entry) => ({ label: entry.label, path: entry.path })),
      } satisfies LinkPayload
  }
}

// ---------------------------------------------------------------------------
// Pages inside a section
// ---------------------------------------------------------------------------

/**
 * The header for one page inside a section.
 *
 * A section's own list keeps the chrome `meta` already gives it. Everything
 * else is a page this window used to hand off, so its eyebrow names the section
 * it belongs to and its buttons are the ones that page actually needs.
 */
function pageMeta(section: DesktopSection, entry: DesktopPage): SectionMeta {
  const eyebrow = section.label.toUpperCase()
  const back = { label: section.label, icon: 'i-chev', command: jump(section.id) }

  switch (entry.id) {
    case 'orders.returns':
      return {
        eyebrow,
        filters: RETURN_FILTERS,
        actions: [
          { label: 'Shipping labels', icon: 'i-truck', command: page('orders.shipping') },
          back,
        ],
      }
    case 'orders.shipping':
      return {
        eyebrow,
        filters: LABEL_FILTERS,
        actions: [
          { label: 'Returns', icon: 'i-file', command: page('orders.returns') },
          { label: 'Shipping settings', icon: 'i-settings', command: page('settings.shipping') },
          back,
        ],
      }
    case 'purchase.suppliers':
      return {
        eyebrow,
        filters: SUPPLIER_FILTERS,
        actions: [
          { label: 'New supplier', icon: 'i-plus', command: form('supplier.create'), primary: true },
          { label: 'New purchase order', icon: 'i-truck', command: form('purchase.create') },
          back,
        ],
      }
    case 'fundraisers.arena':
      return {
        eyebrow,
        filters: ARENA_FILTERS,
        actions: [
          { label: 'Fundraisers', icon: 'i-gift', command: jump('fundraisers') },
          { label: 'Open the arena…', icon: 'i-chev', command: link('/admin/fundraisers/battle-arena') },
        ],
      }
    case 'events.manifests':
      return {
        eyebrow,
        filters: MANIFEST_FILTERS,
        actions: [
          { label: 'Calendar', icon: 'i-calendar', command: jump('events') },
          { label: 'Inventory', icon: 'i-boxes', command: jump('inventory') },
        ],
      }
    case 'wholesale.locations':
      return {
        eyebrow,
        filters: LOCATION_FILTERS,
        actions: [
          { label: 'New stockist', icon: 'i-plus', command: form('location.create'), primary: true },
          back,
        ],
      }
    case 'ledger.reconciliation':
      return {
        eyebrow,
        filters: RECONCILIATION_FILTERS,
        actions: [
          { label: 'Import a statement', icon: 'i-down', command: link('/admin/financials/ledger/import') },
          { label: 'Show archive', icon: 'i-history', command: page('media.shows') },
          back,
        ],
      }
    case 'email.templates':
      return {
        eyebrow,
        filters: EMAIL_TEMPLATE_FILTERS,
        actions: [
          { label: 'New campaign', icon: 'i-plus', command: form('campaign.create'), primary: true },
          { label: 'Brand kit', icon: 'i-image', command: page('email.brand') },
          back,
        ],
      }
    case 'email.automations':
      return {
        eyebrow,
        filters: AUTOMATION_FILTERS,
        actions: [{ label: 'Campaigns', icon: 'i-mail', command: jump('email') }, back],
      }
    case 'email.lists':
      return {
        eyebrow,
        filters: SUBSCRIBER_FILTERS,
        actions: [
          { label: 'Add subscriber', icon: 'i-plus', command: form('subscriber.create'), primary: true },
          { label: 'New list', icon: 'i-users', command: form('list.create') },
          { label: 'Suppressions', icon: 'i-shield', command: page('email.suppressions') },
        ],
      }
    case 'email.suppressions':
      return {
        eyebrow,
        filters: SUPPRESSION_FILTERS,
        actions: [
          { label: 'Suppress an address', icon: 'i-plus', command: form('suppression.create'), primary: true },
          { label: 'Subscribers', icon: 'i-users', command: page('email.lists') },
        ],
      }
    case 'email.logs':
      return {
        eyebrow,
        filters: EMAIL_LOG_FILTERS,
        actions: [
          { label: 'Campaigns', icon: 'i-mail', command: jump('email') },
          { label: 'Suppressions', icon: 'i-shield', command: page('email.suppressions') },
        ],
      }
    case 'email.brand':
      return {
        eyebrow,
        filters: ['Brand kit'],
        actions: [
          { label: 'Edit brand kit', icon: 'i-settings', command: form('settings.brand'), primary: true },
          back,
        ],
      }
    case 'social.accounts':
      return {
        eyebrow,
        filters: SOCIAL_ACCOUNT_FILTERS,
        actions: [
          { label: 'Connect an account', icon: 'i-plus', command: link('/admin/social'), primary: true },
          { label: 'Reach', icon: 'i-chart', command: page('social.analytics') },
        ],
      }
    case 'social.feeds':
      return {
        eyebrow,
        filters: FEED_FILTERS,
        actions: [
          { label: 'Run a feed sync', icon: 'i-rotate', command: link('/admin/feeds') },
          { label: 'Products', icon: 'i-package', command: jump('products') },
        ],
      }
    case 'social.analytics':
      return {
        eyebrow,
        filters: REACH_FILTERS,
        actions: [
          { label: 'Connected accounts', icon: 'i-share', command: page('social.accounts') },
          back,
        ],
      }
    case 'content.pages':
      return {
        eyebrow,
        filters: CMS_PAGE_FILTERS,
        actions: [
          { label: 'New page', icon: 'i-plus', command: form('page.create'), primary: true },
          { label: 'Redirects', icon: 'i-share', command: page('content.redirects') },
          { label: 'SEO', icon: 'i-target', command: page('content.seo') },
        ],
      }
    case 'content.banners':
      return {
        eyebrow,
        filters: BANNER_FILTERS,
        actions: [
          { label: 'New banner', icon: 'i-plus', command: form('banner.create'), primary: true },
          { label: 'Pages', icon: 'i-file', command: page('content.pages') },
        ],
      }
    case 'content.faqs':
      return {
        eyebrow,
        filters: FAQ_FILTERS,
        actions: [
          { label: 'New FAQ', icon: 'i-plus', command: form('faq.create'), primary: true },
          { label: 'Pages', icon: 'i-file', command: page('content.pages') },
        ],
      }
    case 'customers.rewards':
      return {
        eyebrow: 'WHAT POINTS BUY',
        filters: REWARD_FILTERS,
        actions: [
          { label: 'New reward', icon: 'i-plus', command: form('reward.create'), primary: true },
          { label: 'Customers', icon: 'i-users', command: jump('customers') },
        ],
      }
    case 'content.redirects':
      return {
        eyebrow,
        filters: REDIRECT_FILTERS,
        actions: [
          { label: 'New redirect', icon: 'i-plus', command: form('redirect.create'), primary: true },
          { label: 'Pages', icon: 'i-file', command: page('content.pages') },
        ],
      }
    case 'database.developer':
      return {
        eyebrow: 'DEVELOPER CONSOLE',
        filters: ['Overview'],
        actions: [
          { label: 'Tables', icon: 'i-database', command: page('database') },
          { label: 'Open full console', icon: 'i-chev', command: link('/admin/developer') },
        ],
      }
    case 'content.seo':
      return {
        eyebrow,
        filters: ['Search settings'],
        actions: [
          { label: 'Edit search settings', icon: 'i-settings', command: form('settings.seo'), primary: true },
          { label: 'Redirects', icon: 'i-share', command: page('content.redirects') },
        ],
      }
    case 'leads.campaigns':
      return {
        eyebrow,
        filters: LEAD_CAMPAIGN_FILTERS,
        actions: [
          { label: 'New campaign', icon: 'i-plus', command: form('leadCampaign.create'), primary: true },
          { label: 'Leads', icon: 'i-target', command: jump('leads') },
        ],
      }
    case 'reviews.forms':
      return {
        eyebrow,
        filters: FORM_FILTERS,
        actions: [
          { label: 'Open the form builder', icon: 'i-chev', command: link('/admin/forms') },
          back,
        ],
      }
    case 'analytics.retention':
      return {
        eyebrow,
        filters: RETENTION_FILTERS,
        actions: [
          { label: 'Margin', icon: 'i-chart', command: page('analytics.margin') },
          { label: 'Customers', icon: 'i-users', command: jump('customers') },
        ],
      }
    case 'analytics.margin':
      return {
        eyebrow,
        filters: MARGIN_FILTERS,
        actions: [
          { label: 'Attribution', icon: 'i-target', command: page('analytics.attribution') },
          { label: 'Products', icon: 'i-package', command: jump('products') },
        ],
      }
    case 'analytics.attribution':
      return {
        eyebrow,
        filters: ATTRIBUTION_FILTERS,
        actions: [
          { label: 'Retention', icon: 'i-chart', command: page('analytics.retention') },
          { label: 'Orders', icon: 'i-receipt', command: jump('orders') },
        ],
      }
    case 'media.documents':
      return {
        eyebrow,
        filters: ARCHIVE_FILTERS,
        actions: [
          { label: 'Mileage log', icon: 'i-truck', command: page('media.mileage') },
          { label: 'Show archive', icon: 'i-history', command: page('media.shows') },
        ],
      }
    case 'media.mileage':
      return {
        eyebrow,
        filters: MILEAGE_FILTERS,
        actions: [
          { label: 'Documents archive', icon: 'i-file', command: page('media.documents') },
          { label: 'Show archive', icon: 'i-history', command: page('media.shows') },
        ],
      }
    case 'media.shows':
      return {
        eyebrow,
        filters: SHOW_ARCHIVE_FILTERS,
        actions: [
          { label: 'Events & shows', icon: 'i-calendar', command: jump('events') },
          { label: 'Reconciliation', icon: 'i-wallet', command: page('ledger.reconciliation') },
        ],
      }
    case 'messages.email':
      return {
        eyebrow,
        filters: CUSTOMER_EMAIL_FILTERS,
        actions: [
          { label: 'Triage settings', icon: 'i-settings', command: link('/admin/inbox/settings') },
          { label: 'Notifications', icon: 'i-alert', command: page('messages.notifications') },
        ],
      }
    case 'messages.live':
      return {
        eyebrow,
        filters: LIVE_CHAT_FILTERS,
        actions: [
          { label: 'Open live chat', icon: 'i-chev', command: link('/admin/messages/live') },
          { label: 'Notifications', icon: 'i-alert', command: page('messages.notifications') },
        ],
      }
    case 'messages.notifications':
      return {
        eyebrow,
        filters: NOTIFICATION_FILTERS,
        actions: [
          {
            label: 'Mark everything read',
            icon: 'i-check',
            command: {
              kind: 'write',
              op: 'notification.markAllRead',
              confirm: 'Mark every unread notification as read?',
            },
          },
          { label: 'Live chat', icon: 'i-message', command: page('messages.live') },
        ],
      }
    case 'users.credentials':
      return {
        eyebrow,
        filters: CREDENTIAL_FILTERS,
        actions: [
          { label: 'Open the vault', icon: 'i-chev', command: link('/admin/credentials') },
          back,
        ],
      }
    case 'settings.payments':
      return {
        eyebrow,
        filters: ['Payments'],
        actions: [
          { label: 'Payment keys', icon: 'i-chev', command: link('/admin/settings/payments') },
          back,
        ],
      }
    case 'settings.shipping':
      return {
        eyebrow,
        filters: ['Shipping'],
        actions: [
          { label: 'Edit shipping', icon: 'i-settings', command: form('settings.shipping'), primary: true },
          { label: 'Shipping labels', icon: 'i-truck', command: page('orders.shipping') },
        ],
      }
    case 'settings.integrations':
      return {
        eyebrow,
        filters: INTEGRATION_FILTERS,
        actions: [
          { label: 'Configure credentials', icon: 'i-chev', command: link('/admin/settings/integrations') },
          { label: 'Credential vault', icon: 'i-shield', command: page('users.credentials') },
        ],
      }
    default:
      return meta(section)
  }
}

/** The body for one page inside a section, or `null` when it is the section's own list. */
async function loadPageBody(pageId: string, list: ListQuery): Promise<SectionPayload['body'] | null> {
  switch (pageId) {
    case 'database.developer':
      return loadDeveloper()
    case 'orders.returns':
      return loadReturns(list)
    case 'orders.shipping':
      return loadShippingLabels(list)
    case 'purchase.suppliers':
      return loadSuppliers(list)
    case 'fundraisers.arena':
      return loadArena(list)
    case 'events.manifests':
      return loadManifests(list)
    case 'wholesale.locations':
      return loadLocations(list)
    case 'ledger.reconciliation':
      return loadReconciliation()
    case 'email.templates':
      return loadEmailTemplates(list)
    case 'email.automations':
      return loadAutomations(list)
    case 'email.lists':
      return loadSubscribers(list)
    case 'email.suppressions':
      return loadSuppressions(list)
    case 'email.logs':
      return loadEmailLogs(list)
    case 'email.brand':
      return loadBrandKit()
    case 'social.accounts':
      return loadSocialAccounts(list)
    case 'social.feeds':
      return loadFeeds(list)
    case 'social.analytics':
      return loadSocialReach(list)
    case 'content.pages':
      return loadCmsPages(list)
    case 'content.banners':
      return loadBanners(list)
    case 'content.faqs':
      return loadFaqs(list)
    case 'content.redirects':
      return loadRedirects(list)
    case 'customers.rewards':
      return loadLoyaltyRewards(list)
    case 'content.seo':
      return loadSeo()
    case 'leads.campaigns':
      return loadLeadCampaigns(list)
    case 'reviews.forms':
      return loadForms(list)
    case 'analytics.retention':
      return loadRetention()
    case 'analytics.margin':
      return loadMargin()
    case 'analytics.attribution':
      return loadAttribution()
    case 'media.documents':
      return loadArchiveDocuments(list)
    case 'media.mileage':
      return loadMileage(list)
    case 'media.shows':
      return loadShowArchive(list)
    case 'messages.email':
      return loadCustomerEmail(list)
    case 'messages.live':
      return loadLiveChat(list)
    case 'messages.notifications':
      return loadNotifications(list)
    case 'users.credentials':
      return loadCredentials(list)
    case 'settings.payments':
      return loadPaymentSettings()
    case 'settings.shipping':
      return loadShippingSettings()
    case 'settings.integrations':
      return loadIntegrations()
    default:
      return null
  }
}

/**
 * Load one page of the desktop shell.
 *
 * `id` is either a section id — the section's own list — or a page id inside
 * one. `permissions`, when supplied, filters the page strip down to the tabs
 * this account may actually load, so the window never offers a tab that would
 * answer 403; omitting it (a test, an older caller) shows every page.
 */
export async function loadSection(
  id: DesktopSectionId | string,
  permissions?: Iterable<string>,
  requested: ListQuery = DEFAULT_LIST,
): Promise<SectionPayload> {
  const entry = findPage(id) ?? (findSection(id) ? { section: findSection(id)!, page: undefined } : undefined)
  if (!entry) throw new Error(`Unknown desktop page: ${id}`)

  const { section } = entry
  const current = entry.page ?? pagesFor(section)[0]
  const isDefault = current.id === section.id

  const { eyebrow, filters, actions } = isDefault ? meta(section) : pageMeta(section, current)
  const searchable = SEARCHABLE_PAGES.has(current.id)
  // A page that cannot search the database ignores `q`; the filter box narrows
  // its rows instead, and the payload says so.
  const list = searchable ? requested : { ...requested, q: '' }
  const body = (await loadPageBody(current.id, list)) ?? (await loadBody(section, list))
  const rowCount = body.view === 'table' || body.view === 'events' ? body.rows.length : null
  const visible = permissions ? allowedPages(section, permissions) : pagesFor(section)

  return {
    id: section.id,
    page: current.id,
    pages: visible.map((entry) => ({ id: entry.id, label: entry.label })),
    kind: pageKind(section, current),
    eyebrow,
    heading: isDefault ? section.label : current.label,
    path: current.path,
    filters,
    actions,
    body,
    loadedAt: new Date().toISOString(),
    list: rowCount === null ? undefined : { ...list, more: rowCount >= list.limit, searchable },
  }
}

/** Sidebar badges — the few counts worth a red dot next to the section name. */
export async function loadBadges(): Promise<DesktopBadges> {
  const [orders, lowStock, fundraisers, conversations, chats] = await Promise.all([
    safe(
      () =>
        prisma.order.count({
          where: { fulfillmentStatus: { in: ['UNFULFILLED', 'PARTIALLY_FULFILLED'] }, ...SOLD },
        }),
      0,
    ),
    safe(
      () =>
        prisma.product.findMany({
          where: { isActive: true },
          select: { inventory: true, stockReserved: true, lowStockThreshold: true },
        }),
      [],
    ),
    safe(() => prisma.fundraiser.count({ where: { status: 'ACTIVE' } }), 0),
    safe(() => prisma.conversation.count({ where: { status: 'OPEN' } }), 0),
    safe(() => prisma.chatThread.count({ where: { status: 'WAITING' } }), 0),
  ])

  const below = lowStock.filter(
    (product) => product.inventory - product.stockReserved <= product.lowStockThreshold,
  ).length

  return {
    orders: orders || undefined,
    inventory: below || undefined,
    fundraisers: fundraisers || undefined,
    messages: conversations + chats || undefined,
  }
}
