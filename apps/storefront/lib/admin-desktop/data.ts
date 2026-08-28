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
  centsToMoney,
  channelLabel,
  channelTone,
  count,
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
      href: `/admin/customers/${customer.id}`,
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
      href: `/admin/events/${event.id}`,
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
