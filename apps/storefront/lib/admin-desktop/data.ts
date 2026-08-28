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

import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { isMissingTableError } from '@/lib/prisma-errors'
import { findSection, type DesktopSection, type DesktopSectionId } from './sections'
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
import type {
  AnalyticsPayload,
  Cell,
  Column,
  DashboardPayload,
  DesktopBadges,
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

/** How many rows any one section will load. */
const ROW_LIMIT = 250

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
// Orders
// ---------------------------------------------------------------------------

const ORDER_FILTERS = ['All channels', 'Online', 'Wholesale', 'Fundraiser', 'Shows']
const ORDER_FILTER_CHANNELS = ['', 'WEBSITE', 'WHOLESALE', 'FUNDRAISER', 'EVENT']

async function loadOrders(): Promise<TablePayload> {
  const orders = await safe(
    () =>
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: ROW_LIMIT,
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
      href: `/admin/orders/${order.id}`,
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
      text(rows.length === ROW_LIMIT ? `latest ${ROW_LIMIT}` : '', { dim: true }),
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

async function loadProducts(): Promise<TablePayload> {
  const products = await safe(
    () =>
      prisma.product.findMany({
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        take: ROW_LIMIT,
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
      href: `/admin/products/${product.id}`,
      search: `${product.name} ${product.sku} ${product.category.name}`,
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

async function loadInventory(): Promise<TablePayload> {
  const products = await safe(
    () =>
      prisma.product.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        take: ROW_LIMIT,
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
      href: `/admin/inventory`,
      search: `${product.name} ${product.sku}`,
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

async function loadCustomers(): Promise<TablePayload> {
  const customers = await safe(
    () =>
      prisma.customer.findMany({
        orderBy: [{ totalSpent: 'desc' }, { email: 'asc' }],
        take: ROW_LIMIT,
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
      // No /admin/customers/[id] page exists; the list filters to one row by email.
      href: `/admin/customers?search=${encodeURIComponent(customer.email)}`,
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

async function loadFundraisers(): Promise<TablePayload> {
  const participants = await safe(
    () =>
      prisma.fundraiserParticipant.findMany({
        orderBy: [{ totalRevenue: 'desc' }, { name: 'asc' }],
        take: ROW_LIMIT,
        include: {
          fundraiser: {
            select: {
              name: true,
              organizationName: true,
              status: true,
              goal: true,
              totalRevenue: true,
              commissionRate: true,
              startDate: true,
              endDate: true,
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

    return {
      id: participant.id,
      href: `/admin/fundraisers`,
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

async function loadEvents(): Promise<EventsPayload> {
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
          take: ROW_LIMIT,
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
      // No /admin/events/[id] index page exists; edit is the detail view.
      href: `/admin/events/${event.id}/edit`,
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

async function loadLedger(): Promise<TablePayload> {
  const entries = await safe(
    () =>
      prisma.ledgerEntry.findMany({
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: ROW_LIMIT,
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
      href: '/admin/financials/ledger',
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
    href: '/admin/developer/database',
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
      name: product.name,
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
      href: `/admin/orders/${order.id}`,
    })),
    lowStock: lowStock.slice(0, 8).map((entry) => ({
      name: entry.name,
      available: count(entry.available),
      gap: `−${count(Math.max(entry.reorder - entry.available, 0))}`,
    })),
    nextEvents: upcoming.map((event) => ({
      date: shortDate(event.startDate),
      name: event.title,
      city: place(event) === '—' ? (event.location ?? '—') : place(event),
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
    },
  }
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

async function loadSettings(): Promise<SettingsPayload> {
  const [seo, quickbooks, payments, carriers, integrations, subscribers] = await Promise.all([
    safe(() => prisma.seoConfiguration.findFirst(), null),
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
          { label: 'Site name', value: seo?.siteName ?? '—' },
          { label: 'Site URL', value: seo?.siteUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? '—', mono: true },
          { label: 'Time zone', value: STORE_TIME_ZONE, mono: true },
          { label: 'Currency', value: 'USD', mono: true },
          { label: 'Subscribed customers', value: count(subscribers), mono: true },
        ],
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
      tag: 'Read only',
      tagTone: 'muted',
      groups: [
        {
          label: 'ABOUT THIS VIEW',
          fields: [
            { label: 'Source', value: 'Live database', wrap: true },
            { label: 'Editing', value: 'Open Settings in the web admin', wrap: true },
          ],
        },
      ],
    },
  }
}

// ---------------------------------------------------------------------------
// Audit logs
// ---------------------------------------------------------------------------

async function loadAudit(): Promise<TablePayload> {
  const logs = await safe(
    () => prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: ROW_LIMIT }),
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
      href: '/admin/audit-logs',
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
      text(rows.length === ROW_LIMIT ? `latest ${ROW_LIMIT}` : '', { dim: true }),
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

async function loadPurchase(): Promise<TablePayload> {
  const orders = await safe(
    () =>
      prisma.purchaseOrder.findMany({
        orderBy: { createdAt: 'desc' },
        take: ROW_LIMIT,
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
      href: `/admin/purchase-orders/${order.id}`,
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
          { label: 'Open purchase order…', href: `/admin/purchase-orders/${order.id}`, shortcut: '⌘⏎' },
          { label: 'Receive into stock…', href: `/admin/purchase-orders/${order.id}`, shortcut: '⌘R' },
          { label: 'Suppliers…', href: '/admin/purchase-orders/suppliers', shortcut: '⌘U' },
          { label: 'Inventory…', href: '/admin/inventory', shortcut: '⌘I' },
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
      text(rows.length === ROW_LIMIT ? `latest ${ROW_LIMIT}` : '', { dim: true }),
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

/** An invoice's `lines` column is free-form JSON; read it defensively. */
function invoiceLines(value: Prisma.JsonValue | null | undefined): InspectorLine[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((entry) => {
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

async function loadInvoices(): Promise<TablePayload> {
  const invoices = await safe(
    () => prisma.invoice.findMany({ orderBy: { createdAt: 'desc' }, take: ROW_LIMIT }),
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
    // An unpaid invoice past its due date reads as overdue even if a nightly
    // job has not moved the stored status along yet.
    const lapsed = !settled && invoice.dueDate.getTime() < now
    const label = lapsed && invoice.status !== 'OVERDUE' ? 'Overdue' : humanise(invoice.status)
    const tone = lapsed ? 'bad' : (INVOICE_TONE[invoice.status] ?? 'muted')

    return {
      id: invoice.id,
      href: `/admin/invoices/${invoice.id}`,
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
          { label: 'Open invoice…', href: `/admin/invoices/${invoice.id}`, shortcut: '⌘⏎' },
          ...(invoice.orderId
            ? [{ label: 'Open order…', href: `/admin/orders/${invoice.orderId}`, shortcut: '⌘O' }]
            : []),
          { label: 'All invoices…', href: '/admin/invoices', shortcut: '⌘L' },
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

async function loadWholesale(): Promise<TablePayload> {
  // The design's price tier and year-to-date columns have no schema behind
  // them; the account's own discount, minimum and self-reported volume are the
  // nearest things that are actually true.
  const accounts = await safe(
    () =>
      prisma.wholesaleAccount.findMany({
        orderBy: { createdAt: 'desc' },
        take: ROW_LIMIT,
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
      href: '/admin/wholesale',
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
          { label: 'Wholesale accounts…', href: '/admin/wholesale', shortcut: '⌘⏎' },
          { label: 'Store locator…', href: '/admin/locations', shortcut: '⌘L' },
          { label: 'Merchandise…', href: '/admin/merchandise', shortcut: '⌘M' },
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

async function loadEmail(): Promise<TablePayload> {
  const campaigns = await safe(
    () =>
      prisma.emailCampaign.findMany({
        orderBy: { createdAt: 'desc' },
        take: ROW_LIMIT,
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
      href: `/admin/email-campaigns/${campaign.id}`,
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
          { label: 'Open campaign…', href: `/admin/email-campaigns/${campaign.id}`, shortcut: '⌘⏎' },
          { label: 'Send log…', href: '/admin/email-marketing/logs', shortcut: '⌘L' },
          { label: 'Automations…', href: '/admin/email-marketing/automations', shortcut: '⌘A' },
          { label: 'Lists & subscribers…', href: '/admin/communications/lists', shortcut: '⌘U' },
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

async function loadSocial(): Promise<TablePayload> {
  const posts = await safe(
    () =>
      prisma.socialMediaPost.findMany({
        orderBy: { createdAt: 'desc' },
        take: ROW_LIMIT,
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
      href: '/admin/social',
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
          { label: 'Scheduled posts…', href: '/admin/social', shortcut: '⌘⏎' },
          { label: 'Social analytics…', href: '/admin/analytics/social', shortcut: '⌘A' },
          { label: 'Product feeds…', href: '/admin/feeds', shortcut: '⌘F' },
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

async function loadContent(): Promise<TablePayload> {
  // Pages, banners and FAQs are edited through `/admin/content` but are not one
  // queryable list, so this table is the blog — the content the schema models as
  // rows. The other views stay one ⌘K away.
  const posts = await safe(
    () =>
      prisma.blogPost.findMany({
        orderBy: { updatedAt: 'desc' },
        take: ROW_LIMIT,
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
      href: `/admin/blog/posts/${post.slug}`,
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
          { label: 'Edit post…', href: `/admin/blog/posts/${post.slug}`, shortcut: '⌘⏎' },
          { label: 'View on storefront…', href: url, shortcut: '⌘O' },
          { label: 'Pages…', href: '/admin/content/pages', shortcut: '⌘P' },
          { label: 'SEO…', href: '/admin/seo', shortcut: '⌘S' },
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

async function loadLeads(): Promise<TablePayload> {
  const leads = await safe(
    () =>
      prisma.lead.findMany({
        orderBy: { createdAt: 'desc' },
        take: ROW_LIMIT,
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
      href: `/admin/lead-generation/${lead.campaign.id}`,
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
          { label: 'Open campaign…', href: `/admin/lead-generation/${lead.campaign.id}`, shortcut: '⌘⏎' },
          ...(lead.googleMapsUrl
            ? [{ label: 'Open in Google Maps…', href: lead.googleMapsUrl, shortcut: '⌘O' }]
            : []),
          { label: 'All campaigns…', href: '/admin/lead-generation', shortcut: '⌘L' },
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

async function loadReviews(): Promise<TablePayload> {
  const reviews = await safe(
    () =>
      prisma.review.findMany({
        orderBy: { createdAt: 'desc' },
        take: ROW_LIMIT,
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
      href: '/admin/reviews',
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
          { label: 'Moderate reviews…', href: '/admin/reviews', shortcut: '⌘⏎' },
          { label: 'Open product…', href: `/admin/products/${review.product.id}`, shortcut: '⌘O' },
          { label: 'Review forms…', href: '/admin/forms', shortcut: '⌘F' },
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

async function loadMedia(): Promise<TablePayload> {
  const files = await safe(
    () =>
      prisma.media.findMany({
        orderBy: { createdAt: 'desc' },
        take: ROW_LIMIT,
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
      href: '/admin/media',
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
          { label: 'Media library…', href: '/admin/media', shortcut: '⌘⏎' },
          { label: 'Open file…', href: file.url, shortcut: '⌘O' },
          { label: 'Documents archive…', href: '/admin/archive/documents', shortcut: '⌘D' },
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

const MESSAGE_FILTERS = ['All', 'Web form', 'Live chat', 'Open']

const CHAT_TONE: Record<string, Tone> = {
  WAITING: 'warn',
  ACTIVE: 'good',
  CLOSED: 'muted',
  OFFLINE: 'muted',
}

async function loadMessages(): Promise<TablePayload> {
  // Two tables feed one inbox: the contact form and the live-chat handoff. They
  // are merged here and sorted together so the operator reads one list rather
  // than switching between two.
  const [submissions, threads] = await Promise.all([
    safe(
      () => prisma.contactSubmission.findMany({ orderBy: { createdAt: 'desc' }, take: ROW_LIMIT }),
      [],
    ),
    safe(
      () =>
        prisma.chatThread.findMany({
          orderBy: { lastMessageAt: 'desc' },
          take: ROW_LIMIT,
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

  const formRows: (Row & { at: Date })[] = submissions.map((entry) => ({
    at: entry.createdAt,
    id: `contact-${entry.id}`,
    href: '/admin/messages',
    search: `${entry.name} ${entry.email} ${entry.subject} ${entry.message}`,
    buckets: [0, 1],
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
        { label: 'Inbox…', href: '/admin/messages', shortcut: '⌘⏎' },
        { label: 'Notifications…', href: '/admin/notifications', shortcut: '⌘N' },
      ],
    },
  }))

  const chatRows: (Row & { at: Date })[] = threads.map((thread) => {
    const who = thread.customerName ?? thread.customerEmail ?? 'Anonymous'
    const open = thread.status === 'WAITING' || thread.status === 'ACTIVE'

    return {
      at: thread.lastMessageAt,
      id: `chat-${thread.id}`,
      href: `/admin/messages/${thread.id}`,
      search: `${who} ${thread.customerEmail ?? ''} live chat`,
      buckets: [0, 2, ...(open ? [3] : [])],
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
          { label: 'Open thread…', href: `/admin/messages/${thread.id}`, shortcut: '⌘⏎' },
          { label: 'Live chat…', href: '/admin/messages/live', shortcut: '⌘L' },
          { label: 'Notifications…', href: '/admin/notifications', shortcut: '⌘N' },
        ],
      },
    }
  })

  const merged = [...formRows, ...chatRows]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, ROW_LIMIT)

  const open = merged.filter((row) => row.buckets.includes(3)).length
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

async function loadUsers(): Promise<TablePayload> {
  const users = await safe(
    () =>
      prisma.user.findMany({
        where: { role: { in: [...STAFF_ROLES] } },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        take: ROW_LIMIT,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
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
      href: `/admin/users/${user.id}`,
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
          { label: 'Edit user…', href: `/admin/users/${user.id}/edit`, shortcut: '⌘⏎' },
          { label: 'Open user…', href: `/admin/users/${user.id}`, shortcut: '⌘O' },
          { label: 'Credential vault…', href: '/admin/credentials', shortcut: '⌘V' },
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
  const open = { label: 'Open in web admin', icon: 'i-chev', href: section.path }

  switch (section.id) {
    case 'dashboard':
      return {
        eyebrow: 'MADE WITH LOVE, SERVED WITH PRIDE',
        filters: ['Today'],
        actions: [{ label: 'New order', icon: 'i-plus', href: '/admin/orders/new', primary: true }, open],
      }
    case 'orders':
      return {
        eyebrow: 'ALL CHANNELS',
        filters: ORDER_FILTERS,
        actions: [{ label: 'New order', icon: 'i-plus', href: '/admin/orders/new', primary: true }, open],
      }
    case 'products':
      return {
        eyebrow: 'JARS & CATALOGUE',
        filters: PRODUCT_FILTERS,
        actions: [{ label: 'New product', icon: 'i-plus', href: '/admin/products/new', primary: true }, open],
      }
    case 'inventory':
      return {
        eyebrow: 'ZANESVILLE KITCHEN',
        filters: INVENTORY_FILTERS,
        actions: [{ label: 'Purchase orders', icon: 'i-truck', href: '/admin/purchase-orders' }, open],
      }
    case 'customers':
      return {
        eyebrow: 'EVERYONE WHO HAS BOUGHT',
        filters: CUSTOMER_FILTERS,
        actions: [{ label: 'Import CSV', icon: 'i-down', href: '/admin/customers/import' }, open],
      }
    case 'fundraisers':
      return {
        eyebrow: 'PARTICIPANTS ACROSS EVERY CAMPAIGN',
        filters: FUNDRAISER_FILTERS,
        actions: [{ label: 'New fundraiser', icon: 'i-plus', href: '/admin/fundraisers', primary: true }, open],
      }
    case 'events':
      return {
        eyebrow: 'ON THE MOVE',
        filters: EVENT_FILTERS,
        actions: [{ label: 'New show', icon: 'i-plus', href: '/admin/events', primary: true }, open],
      }
    case 'ledger':
      return {
        eyebrow: 'GENERAL LEDGER',
        filters: LEDGER_FILTERS,
        actions: [
          { label: 'Reconciliation', icon: 'i-check', href: '/admin/financials/reconciliation' },
          { label: 'Export', icon: 'i-down', href: '/admin/financials/ledger' },
        ],
      }
    case 'analytics':
      return {
        eyebrow: 'TRAILING 12 MONTHS',
        filters: ['12 months'],
        actions: [{ label: 'Report builder', icon: 'i-chart', href: '/admin/data', primary: true }, open],
      }
    case 'settings':
      return { eyebrow: 'STORE CONFIGURATION', filters: ['Everything'], actions: [open] }
    case 'audit':
      return { eyebrow: 'WHO DID WHAT', filters: AUDIT_FILTERS, actions: [open] }
    case 'database':
      return {
        eyebrow: 'POSTGRES · ROW COUNTS',
        filters: DATABASE_FILTERS,
        actions: [{ label: 'Database Console', icon: 'i-database', href: '/admin/developer/database', primary: true }],
      }
    case 'purchase':
      return {
        eyebrow: 'INBOUND SUPPLY',
        filters: PURCHASE_FILTERS,
        actions: [
          { label: 'New PO', icon: 'i-plus', href: '/admin/purchase-orders/new', primary: true },
          { label: 'Suppliers', icon: 'i-truck', href: '/admin/purchase-orders/suppliers' },
          open,
        ],
      }
    case 'invoices':
      return {
        eyebrow: 'ACCOUNTS RECEIVABLE',
        filters: INVOICE_FILTERS,
        actions: [{ label: 'Returns & RMAs', icon: 'i-file', href: '/admin/returns' }, open],
      }
    case 'wholesale':
      return {
        eyebrow: 'TRADE ACCOUNTS',
        filters: WHOLESALE_FILTERS,
        actions: [{ label: 'Store locator', icon: 'i-pin', href: '/admin/locations' }, open],
      }
    case 'email':
      return {
        eyebrow: 'CAMPAIGNS & AUTOMATIONS',
        filters: EMAIL_FILTERS,
        actions: [
          { label: 'New campaign', icon: 'i-plus', href: '/admin/email-campaigns/new', primary: true },
          { label: 'Automations', icon: 'i-mail', href: '/admin/email-marketing/automations' },
          open,
        ],
      }
    case 'social':
      return {
        eyebrow: 'SCHEDULED & PUBLISHED',
        filters: SOCIAL_FILTERS,
        actions: [{ label: 'Social analytics', icon: 'i-chart', href: '/admin/analytics/social' }, open],
      }
    case 'content':
      return {
        eyebrow: 'PAGES, POSTS & BANNERS',
        filters: CONTENT_FILTERS,
        actions: [
          { label: 'New post', icon: 'i-plus', href: '/admin/blog/posts/new', primary: true },
          { label: 'SEO', icon: 'i-target', href: '/admin/seo' },
          open,
        ],
      }
    case 'leads':
      return {
        eyebrow: 'PROSPECTING PIPELINE',
        filters: LEAD_FILTERS,
        actions: [{ label: 'Campaigns', icon: 'i-target', href: '/admin/lead-generation', primary: true }],
      }
    case 'reviews':
      return {
        eyebrow: 'CUSTOMER FEEDBACK',
        filters: REVIEW_FILTERS,
        actions: [{ label: 'Review forms', icon: 'i-file', href: '/admin/forms' }, open],
      }
    case 'media':
      return {
        eyebrow: 'LIBRARY & ARCHIVE',
        filters: MEDIA_FILTERS,
        actions: [{ label: 'Documents archive', icon: 'i-file', href: '/admin/archive/documents' }, open],
      }
    case 'messages':
      return {
        eyebrow: 'INBOX',
        filters: MESSAGE_FILTERS,
        actions: [
          { label: 'Live chat', icon: 'i-message', href: '/admin/messages/live', primary: true },
          { label: 'Notifications', icon: 'i-alert', href: '/admin/notifications' },
          open,
        ],
      }
    case 'users':
      return {
        eyebrow: 'STAFF ACCOUNTS',
        filters: USER_FILTERS,
        actions: [
          { label: 'New user', icon: 'i-plus', href: '/admin/users/new', primary: true },
          { label: 'Credentials', icon: 'i-shield', href: '/admin/credentials' },
          open,
        ],
      }
    default:
      return { eyebrow: section.label.toUpperCase(), filters: ['Overview'], actions: [open] }
  }
}

async function loadBody(section: DesktopSection): Promise<SectionPayload['body']> {
  switch (section.id) {
    case 'dashboard':
      return loadDashboard()
    case 'orders':
      return loadOrders()
    case 'products':
      return loadProducts()
    case 'inventory':
      return loadInventory()
    case 'customers':
      return loadCustomers()
    case 'fundraisers':
      return loadFundraisers()
    case 'events':
      return loadEvents()
    case 'ledger':
      return loadLedger()
    case 'analytics':
      return loadAnalytics()
    case 'settings':
      return loadSettings()
    case 'audit':
      return loadAudit()
    case 'database':
      return loadDatabase()
    case 'purchase':
      return loadPurchase()
    case 'invoices':
      return loadInvoices()
    case 'wholesale':
      return loadWholesale()
    case 'email':
      return loadEmail()
    case 'social':
      return loadSocial()
    case 'content':
      return loadContent()
    case 'leads':
      return loadLeads()
    case 'reviews':
      return loadReviews()
    case 'media':
      return loadMedia()
    case 'messages':
      return loadMessages()
    case 'users':
      return loadUsers()
    default:
      return {
        view: 'link',
        note: 'This section lives in the web admin. It keeps its place in the sidebar, its shortcut and its command palette entry — pick a view to open it in this window.',
        views: section.views ?? [{ label: section.label, path: section.path }],
      } satisfies LinkPayload
  }
}

export async function loadSection(id: DesktopSectionId): Promise<SectionPayload> {
  const section = findSection(id)
  if (!section) throw new Error(`Unknown desktop section: ${id}`)

  const { eyebrow, filters, actions } = meta(section)
  const body = await loadBody(section)

  return {
    id: section.id,
    kind: section.kind,
    eyebrow,
    heading: section.label,
    path: section.path,
    filters,
    actions,
    body,
    loadedAt: new Date().toISOString(),
  }
}

/** Sidebar badges — the few counts worth a red dot next to the section name. */
export async function loadBadges(): Promise<DesktopBadges> {
  const [orders, lowStock, fundraisers] = await Promise.all([
    safe(
      () =>
        prisma.order.count({
          where: { fulfillmentStatus: { in: ['UNFULFILLED', 'PARTIALLY_FULFILLED'] }, ...SOLD },
        }),
      0,
    ),
    safe(() => prisma.product.findMany({ where: { isActive: true } }), []),
    safe(() => prisma.fundraiser.count({ where: { status: 'ACTIVE' } }), 0),
  ])

  const below = lowStock.filter(
    (product) => product.inventory - product.stockReserved <= product.lowStockThreshold,
  ).length

  return {
    orders: orders || undefined,
    inventory: below || undefined,
    fundraisers: fundraisers || undefined,
  }
}
